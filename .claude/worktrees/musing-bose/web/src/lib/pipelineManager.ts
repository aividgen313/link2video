import { saveToHistory, saveProjectState, loadProjectState, type ProjectState } from "./videoHistory";
import { uploadProjectAssets } from "./cloudStorage";
import type { ScriptData, Scene, QualityTier, VideoDimension } from "@/context/AppContext";
import { QUALITY_TIERS, POLLEN_COSTS } from "@/context/AppContext";

// ═══════════════════════════════════════════════════════════════
// PipelineManager — singleton orchestrator for video generation
// Runs independently of any page so generation continues in the background.
// Follows the same subscriber pattern as exportManager.ts
// ═══════════════════════════════════════════════════════════════

export type PipelinePhase =
  | "idle"
  | "images_audio"
  | "video"
  | "stitch"
  | "upload"
  | "complete"
  | "error"
  | "cancelled";

export type SceneAssetStatus = {
  image: boolean;
  audio: boolean;
  video: boolean;   // true if video generated OR not needed
  done: boolean;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  duration?: number;
  error?: string;
};

export interface PipelineProgressData {
  phase: PipelinePhase;
  progress: number;
  status: string;
  error: string | null;
  projectId: string | null;
  startedAt: number;
  elapsedTime: number;
  completedScenes: number;
  totalScenes: number;
  sceneStatuses: Record<number, SceneAssetStatus>;
  finalVideoUrl: string | null;
}

export interface PipelineConfig {
  scriptData: ScriptData;
  qualityTier: QualityTier;
  selectedVoice: string;
  videoDimension: VideoDimension;
  musicEnabled: boolean;
  captionsEnabled: boolean;
  storyboardImages: Record<number, string>;
  url: string;
  mode: string;
  audioFile: string | null;
  activeStyle?: string | null;
  settingText?: string;
}

/** Bridge to push results back into React context */
export interface ContextBridge {
  setSceneAudioUrls: (urls: Record<number, string>) => void;
  setSceneVideoUrls: (urls: Record<number, string>) => void;
  setSceneDurations: (durations: Record<number, number>) => void;
  setStoryboardImages: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
  setFinalVideoUrl: (url: string | null) => void;
  setPollenUsed: (amount: number) => void;
  setIsGenerating: (val: boolean) => void;
}

type Subscriber = (data: PipelineProgressData) => void;

// ─── Audio duration helper ───────────────────────────────────
function getAudioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (dur: number) => { if (!resolved) { resolved = true; resolve(dur); } };
    try {
      const audio = new Audio(dataUrl);
      audio.addEventListener("loadedmetadata", () => {
        console.log(`[pipeline] Audio duration measured: ${audio.duration}s`);
        done(audio.duration || 8);
      });
      audio.addEventListener("error", () => {
        console.warn("[pipeline] Audio duration measurement failed, using fallback");
        done(8);
      });
    } catch {
      console.warn("[pipeline] Audio element creation failed, using fallback");
      done(8);
    }
    // Hard timeout — never hang
    setTimeout(() => {
      if (!resolved) console.warn("[pipeline] Audio duration timeout, using fallback");
      done(8);
    }, 3000);
  });
}

// ─── Video concurrency semaphore ─────────────────────────────
const VIDEO_CONCURRENCY = 2;

function createSemaphore(max: number) {
  let active = 0;
  const waiters: (() => void)[] = [];
  return {
    acquire(): Promise<void> {
      if (active < max) { active++; return Promise.resolve(); }
      return new Promise((r) => waiters.push(r));
    },
    release() {
      active--;
      if (waiters.length > 0) { active++; waiters.shift()!(); }
    },
  };
}

// ═══════════════════════════════════════════════════════════════

class PipelineManager {
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  private data: PipelineProgressData = {
    phase: "idle",
    progress: 0,
    status: "",
    error: null,
    projectId: null,
    startedAt: 0,
    elapsedTime: 0,
    completedScenes: 0,
    totalScenes: 0,
    sceneStatuses: {},
    finalVideoUrl: null,
  };

  private subscribers = new Set<Subscriber>();

  // ── Subscriber pattern ──────────────────────────────────────

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    callback({ ...this.data });
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb({ ...this.data }));
  }

  private update(partial: Partial<PipelineProgressData>) {
    this.data = { ...this.data, ...partial };
    this.notify();
  }

  getState(): PipelineProgressData {
    return { ...this.data };
  }

  get isRunning(): boolean {
    return this.data.phase !== "idle" && this.data.phase !== "complete" && this.data.phase !== "error" && this.data.phase !== "cancelled";
  }

  // ── Lifecycle ────────────────────────────────────────────────

  cancel() {
    this.controller?.abort();
    this.cleanup();
    this.update({ phase: "cancelled", status: "Generation cancelled" });
  }

  reset() {
    this.cleanup();
    this.update({
      phase: "idle",
      progress: 0,
      status: "",
      error: null,
      projectId: null,
      startedAt: 0,
      elapsedTime: 0,
      completedScenes: 0,
      totalScenes: 0,
      sceneStatuses: {},
      finalVideoUrl: null,
    });
  }

  private cleanup() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // ── Scene-level asset generators ─────────────────────────────

  /** Build a character identity prefix from scriptData to prepend to every image prompt */
  private buildCharacterPrefix(config: PipelineConfig, scene: Scene): string {
    // Source 1: character_identities from Gemini (top-level on scriptData)
    const identities = config.scriptData.character_identities;
    // Source 2: characterProfiles from user input
    const profiles = config.scriptData.characterProfiles;
    // Which characters appear in this scene?
    const sceneChars = scene.characters || [];

    const parts: string[] = [];

    if (identities && Object.keys(identities).length > 0) {
      // Use Gemini-generated locked identities
      for (const [name, desc] of Object.entries(identities)) {
        // If scene has a characters list, only include relevant ones
        if (sceneChars.length === 0 || sceneChars.some(c => c.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.toLowerCase()))) {
          parts.push(`${name}: ${desc}`);
        }
      }
    } else if (profiles && profiles.length > 0) {
      // Fallback to user-provided profiles
      for (const p of profiles) {
        if (sceneChars.length === 0 || sceneChars.some(c => c.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(c.toLowerCase()))) {
          let desc = `${p.name}: ${p.appearance}`;
          if (p.clothing) desc += `, wearing ${p.clothing}`;
          parts.push(desc);
        }
      }
    }

    if (parts.length === 0) return "";
    return parts.join(". ") + ". ";
  }

  private async generateImage(
    scene: Scene,
    storyboardImages: Record<number, string>,
    signal: AbortSignal,
    characterPrefix: string = ""
  ): Promise<{ imageURL: string; imageUUID: string } | null> {
    // Use cached storyboard image if available
    if (storyboardImages[scene.id]) {
      return { imageURL: storyboardImages[scene.id], imageUUID: `cached-${scene.id}` };
    }
    // Prepend character identity to ensure consistency across scenes
    const enhancedPrompt = characterPrefix
      ? `${characterPrefix}${scene.visual_prompt}`
      : scene.visual_prompt;
    const res = await fetch("/api/runware/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: enhancedPrompt, width: 1280, height: 768 }),
      signal,
    });
    if (!res.ok) throw new Error(`Image API error: ${res.status}`);
    const data = await res.json();
    if (data.success && data.images?.[0]) {
      return { imageURL: data.images[0].imageURL, imageUUID: data.images[0].imageUUID };
    }
    throw new Error(data.error || "Image generation failed");
  }

  private async generateAudio(
    scene: Scene,
    voice: string,
    useEdgeTTS: boolean,
    signal: AbortSignal
  ): Promise<string | null> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scene.narration, voice, useEdgeTTS }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    const data = await res.json();
    return data.success && data.audioUrl ? data.audioUrl : null;
  }

  private async generateVideo(
    scene: Scene,
    duration: number,
    signal: AbortSignal
  ): Promise<string | null> {
    const res = await fetch("/api/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: scene.visual_prompt,
        duration: Math.min(Math.ceil(duration), 15),
        mode: "ai",
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Video API error: ${res.status}`);
    const data = await res.json();
    if (data.success && data.videoUrl && !data.useKenBurns) return data.videoUrl;
    return null;
  }

  private async generateMusic(title: string, signal: AbortSignal): Promise<string | null> {
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `cinematic background music for a documentary video about: ${title}`,
          duration: 60,
        }),
        signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success && data.audioUrl ? data.audioUrl : null;
    } catch { return null; }
  }

  // ── Determine video strategy ────────────────────────────────

  private getVideoSceneIndices(tier: (typeof QUALITY_TIERS)[keyof typeof QUALITY_TIERS], totalScenes: number): Set<number> {
    const indices = new Set<number>();
    const strategy = (tier.videoSceneStrategy as string) || "none";

    if (strategy === "all") {
      for (let i = 0; i < totalScenes; i++) indices.add(i);
    } else if (strategy === "alternating") {
      const groupSize = (tier as any).alternatingGroupSize || 3;
      for (let i = 0; i < totalScenes; i++) {
        if (Math.floor(i / groupSize) % 2 === 0) indices.add(i);
      }
    } else if (strategy === "key_scenes") {
      const maxVideo = (tier as any).maxVideoScenes || totalScenes;
      indices.add(0);
      if (totalScenes > 2) indices.add(Math.floor(totalScenes / 2));
      if (totalScenes > 1) indices.add(totalScenes - 1);
      const climax = Math.floor(totalScenes / 2);
      for (let offset = 1; indices.size < Math.min(maxVideo, totalScenes) && offset < totalScenes; offset++) {
        if (climax + offset < totalScenes) indices.add(climax + offset);
        if (indices.size >= maxVideo) break;
        if (climax - offset >= 0) indices.add(climax - offset);
      }
    }
    return indices;
  }

  // ── Main pipeline ───────────────────────────────────────────

  async startPipeline(config: PipelineConfig, bridge: ContextBridge) {
    if (this.isRunning) return;

    this.reset();
    this.controller = new AbortController();
    const signal = this.controller.signal;

    const tier = QUALITY_TIERS[config.qualityTier];
    const isMusicVideo = config.mode === "music-video";
    const scenes = config.scriptData.scenes;
    const totalScenes = scenes.length;
    const projectId = Date.now().toString();

    // Init state
    const initStatuses: Record<number, SceneAssetStatus> = {};
    scenes.forEach((s) => {
      initStatuses[s.id] = { image: false, audio: false, video: false, done: false };
    });

    this.startTime = Date.now();
    this.timer = setInterval(() => {
      this.update({ elapsedTime: Date.now() - this.startTime });
    }, 500);

    this.update({
      phase: "images_audio",
      progress: 5,
      status: "Starting generation...",
      projectId,
      startedAt: this.startTime,
      totalScenes,
      completedScenes: 0,
      sceneStatuses: initStatuses,
    });

    bridge.setIsGenerating(true);

    try {
      // ── Background music (runs in parallel with everything) ──
      const musicPromise = (!isMusicVideo && config.musicEnabled)
        ? this.generateMusic(config.scriptData.title || "a documentary", signal)
        : Promise.resolve(null);

      // ── Determine video strategy upfront ──
      const videoSceneIndices = tier.useAIVideo
        ? this.getVideoSceneIndices(tier, totalScenes)
        : new Set<number>();

      const videoSemaphore = createSemaphore(VIDEO_CONCURRENCY);

      // Accumulated results
      const imageMap: Record<number, string> = {};
      const audioMap: Record<number, string> = {};
      const videoMap: Record<number, string> = {};
      const durationMap: Record<number, number> = {};
      const sceneAssets: { image: string; audio: string | null; duration: number; narration: string; aiVideoUrl: string | null; sceneId: number }[] = new Array(totalScenes);
      let completedCount = 0;

      // ── Process all scenes (overlapped: image+audio → video) ──

      const scenePromises = scenes.map(async (scene, index) => {
        try {
        if (signal.aborted) return;

        console.log(`[pipeline] Scene ${index + 1}/${totalScenes}: starting image + audio...`);

        // Step A: Image + Audio in parallel
        const charPrefix = this.buildCharacterPrefix(config, scene);
        const [imgResult, audioResult] = await Promise.allSettled([
          this.generateImage(scene, config.storyboardImages, signal, charPrefix),
          isMusicVideo ? Promise.resolve(null) : this.generateAudio(scene, config.selectedVoice, config.qualityTier === "basic", signal),
        ]);

        if (signal.aborted) return;

        const img = imgResult.status === "fulfilled" ? imgResult.value : null;
        const audio = audioResult.status === "fulfilled" ? audioResult.value : null;

        console.log(`[pipeline] Scene ${index + 1}: image=${img ? "ok" : "FAIL"}, audio=${audio ? "ok" : isMusicVideo ? "skipped" : "FAIL"}`);

        if (!img) {
          this.update({
            sceneStatuses: {
              ...this.data.sceneStatuses,
              [scene.id]: { ...this.data.sceneStatuses[scene.id], done: true, error: "Image failed" },
            },
          });
          return;
        }

        // Measure actual audio duration
        let actualDuration = scene.duration_estimate_seconds;
        if (!isMusicVideo && audio) {
          const audioDur = await getAudioDuration(audio);
          actualDuration = Math.max(audioDur + 1.5, scene.duration_estimate_seconds);
          console.log(`[pipeline] Scene ${index + 1}: duration=${actualDuration}s`);
        }

        imageMap[scene.id] = img.imageURL;
        if (audio) audioMap[scene.id] = audio;
        durationMap[scene.id] = actualDuration;

        this.update({
          sceneStatuses: {
            ...this.data.sceneStatuses,
            [scene.id]: { ...this.data.sceneStatuses[scene.id], image: true, audio: !!audio || isMusicVideo, imageUrl: img.imageURL, audioUrl: audio || undefined, duration: actualDuration },
          },
        });

        // Step B: AI video if needed (respects concurrency limit)
        let aiVideoUrl: string | null = null;
        if (videoSceneIndices.has(index)) {
          await videoSemaphore.acquire();
          if (signal.aborted) { videoSemaphore.release(); return; }
          this.update({
            phase: "video",
            status: `Generating AI video ${index + 1}/${totalScenes}...`,
          });
          try {
            aiVideoUrl = await this.generateVideo(scene, actualDuration, signal);
            if (aiVideoUrl) videoMap[scene.id] = aiVideoUrl;
          } catch (err) {
            console.warn(`Scene ${index + 1}: AI video failed, using Ken Burns:`, err);
          } finally {
            videoSemaphore.release();
          }
        }

        this.update({
          sceneStatuses: {
            ...this.data.sceneStatuses,
            [scene.id]: {
              ...this.data.sceneStatuses[scene.id],
              video: true,
              videoUrl: aiVideoUrl || undefined,
              done: true,
            },
          },
        });

        sceneAssets[index] = {
          image: img.imageURL,
          audio,
          duration: actualDuration,
          narration: scene.narration,
          aiVideoUrl,
          sceneId: scene.id,
        };

        completedCount++;
        const progressPct = Math.round(10 + (completedCount / totalScenes) * 60);
        this.update({
          progress: progressPct,
          completedScenes: completedCount,
          status: `Scene ${completedCount}/${totalScenes} complete`,
        });
        console.log(`[pipeline] Scene ${index + 1} fully complete`);
        } catch (sceneErr) {
          console.error(`[pipeline] Scene ${index + 1} unexpected error:`, sceneErr);
          this.update({
            sceneStatuses: {
              ...this.data.sceneStatuses,
              [scene.id]: { ...this.data.sceneStatuses[scene.id], done: true, error: String(sceneErr) },
            },
          });
        }
      });

      console.log(`[pipeline] Waiting for all ${totalScenes} scene promises to settle...`);
      const settledResults = await Promise.allSettled(scenePromises);
      console.log(`[pipeline] All scenes settled. Results:`, settledResults.map((r, i) => `Scene ${i + 1}: ${r.status}`));
      if (signal.aborted) { console.log("[pipeline] Aborted after scenes"); return; }

      // Filter out failed scenes
      const validAssets = sceneAssets.filter(Boolean);
      console.log(`[pipeline] Valid assets: ${validAssets.length}/${totalScenes}`);
      if (validAssets.length === 0) {
        throw new Error("Every scene failed to generate. Check your connection and try again.");
      }

      // Push results to React context
      bridge.setSceneAudioUrls(audioMap);
      bridge.setSceneVideoUrls(videoMap);
      bridge.setSceneDurations(durationMap);

      // ── Save draft checkpoint (before stitch) ──
      const totalSecs = validAssets.reduce((sum, a) => sum + (a.duration || 8), 0);
      const firstImg = validAssets[0]?.image;

      await saveToHistory({
        id: projectId,
        title: config.scriptData.title || "Untitled Video",
        topic: config.url || "",
        angle: config.scriptData.angle || "",
        thumbnailUrl: firstImg,
        quality: config.qualityTier,
        dimensionId: config.videoDimension.id,
        dimensionLabel: config.videoDimension.label,
        totalSeconds: totalSecs,
        activeStyle: config.activeStyle || null,
        settingText: config.settingText || "",
        createdAt: new Date().toISOString(),
      });

      await saveProjectState({
        id: projectId,
        scriptData: config.scriptData,
        storyboardImages: imageMap,
        sceneAudioUrls: audioMap,
        sceneVideoUrls: videoMap,
        sceneDurations: durationMap,
        musicUrl: null,
        finalVideoUrl: null,
      });

      // ── Server stitch ──
      console.log(`[pipeline] Starting stitch with ${validAssets.length} scenes...`);
      this.update({ phase: "stitch", progress: 75, status: "Stitching video on server..." });

      const resolvedMusicUrl = await musicPromise;

      const stitchScenes = validAssets.map((a) => ({
        image: a.image,
        audio: a.audio ?? undefined,
        duration: a.duration,
        narration: a.narration,
        video: a.aiVideoUrl ?? undefined,
      }));

      // Fake-progress ticker while server works
      let fakeP = 78;
      const fakeTimer = setInterval(() => {
        fakeP = Math.min(fakeP + 0.4, 94);
        const pct = Math.round(((fakeP - 78) / (94 - 78)) * 100);
        let statusMsg = "Uploading scenes to server...";
        if (pct >= 60) statusMsg = "Joining scenes into final video...";
        else if (pct >= 30) statusMsg = "Encoding video clips...";
        this.update({ progress: Math.round(fakeP), status: statusMsg });
      }, 800);

      const stitchBody = JSON.stringify({
        scenes: stitchScenes,
        resolution: { width: config.videoDimension.width, height: config.videoDimension.height },
        musicUrl: (!isMusicVideo && resolvedMusicUrl) ? resolvedMusicUrl : null,
        userAudioDataUrl: isMusicVideo ? config.audioFile : null,
        captionsEnabled: config.captionsEnabled,
      });

      // Retry stitch up to 3 times (deploy interruptions, timeouts, etc.)
      const MAX_STITCH_RETRIES = 3;
      let stitchRes: Response | null = null;
      for (let attempt = 1; attempt <= MAX_STITCH_RETRIES; attempt++) {
        if (signal.aborted) break;
        console.log(`[pipeline] Stitch attempt ${attempt}/${MAX_STITCH_RETRIES} (${stitchScenes.length} scenes, musicUrl=${!!resolvedMusicUrl}, userAudio=${isMusicVideo && !!config.audioFile})`);
        this.update({ status: attempt > 1 ? `Retrying stitch (attempt ${attempt})...` : "Stitching video on server..." });
        try {
          stitchRes = await fetch("/api/stitch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: stitchBody,
            signal,
          });
          if (stitchRes.ok) break; // Success
          const errData = await stitchRes.json().catch(() => ({}));
          console.warn(`[pipeline] Stitch attempt ${attempt} failed: ${stitchRes.status}`, errData);
          stitchRes = null;
        } catch (fetchErr) {
          if (signal.aborted) break;
          console.warn(`[pipeline] Stitch attempt ${attempt} network error:`, fetchErr);
          stitchRes = null;
        }
        if (attempt < MAX_STITCH_RETRIES) {
          const delay = attempt * 5000; // 5s, 10s backoff
          console.log(`[pipeline] Waiting ${delay / 1000}s before retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      clearInterval(fakeTimer);

      if (!stitchRes || !stitchRes.ok) {
        throw new Error(`Server stitching failed after ${MAX_STITCH_RETRIES} attempts`);
      }

      this.update({ progress: 96, status: "Downloading your video..." });

      const videoBlob = await stitchRes!.blob();
      const videoObjectUrl = URL.createObjectURL(videoBlob);
      bridge.setFinalVideoUrl(videoObjectUrl);

      // Convert to data URL for persistent storage
      let videoPersistUrl: string | null = null;
      try {
        videoPersistUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(videoBlob);
        });
      } catch {
        console.warn("Could not convert video blob to data URL for persistence");
      }

      // ── Cloud upload ──
      this.update({ phase: "upload", progress: 97, status: "Saving to cloud..." });

      let cloudImages = imageMap;
      let cloudAudio = audioMap;
      let cloudVideo = videoMap;
      let cloudFinalVideo: string | null = null;

      try {
        const cloudAssets = await uploadProjectAssets(projectId, {
          storyboardImages: imageMap,
          sceneAudioUrls: audioMap,
          sceneVideoUrls: videoMap,
          finalVideoUrl: videoPersistUrl,
        });
        cloudImages = cloudAssets.storyboardImages;
        cloudAudio = cloudAssets.sceneAudioUrls;
        cloudVideo = cloudAssets.sceneVideoUrls;
        cloudFinalVideo = cloudAssets.finalVideoUrl;
        bridge.setSceneAudioUrls(cloudAudio);
        bridge.setSceneVideoUrls(cloudVideo);
      } catch (uploadErr) {
        console.warn("Cloud upload failed (assets saved locally only):", uploadErr);
      }

      // ── Track credits ──
      const actualVideoScenes = validAssets.filter((a) => a.aiVideoUrl).length;
      const creditsUsed =
        tier.pollenFixed +
        tier.pollenPerImageScene * validAssets.length +
        tier.pollenPerTTS * validAssets.length +
        tier.pollenPerVideoScene * actualVideoScenes +
        (resolvedMusicUrl ? POLLEN_COSTS.musicGeneration : 0);

      bridge.setPollenUsed(creditsUsed);

      // ── Final save ──
      await saveToHistory({
        id: projectId,
        title: config.scriptData.title || "Untitled Video",
        topic: config.url || "",
        angle: config.scriptData.angle || "",
        thumbnailUrl: cloudImages[scenes[0]?.id] || firstImg,
        quality: config.qualityTier,
        dimensionId: config.videoDimension.id,
        dimensionLabel: config.videoDimension.label,
        totalSeconds: totalSecs,
        activeStyle: config.activeStyle || null,
        settingText: config.settingText || "",
        createdAt: new Date().toISOString(),
      });

      await saveProjectState({
        id: projectId,
        scriptData: { ...config.scriptData, id: projectId },
        storyboardImages: cloudImages,
        sceneAudioUrls: cloudAudio,
        sceneVideoUrls: cloudVideo,
        sceneDurations: durationMap,
        musicUrl: resolvedMusicUrl || null,
        finalVideoUrl: cloudFinalVideo || videoPersistUrl,
      });

      this.update({
        phase: "complete",
        progress: 100,
        status: "Video ready!",
        finalVideoUrl: videoObjectUrl,
      });
    } catch (err) {
      if (signal.aborted) { console.log("[pipeline] Aborted"); return; }
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[pipeline] Pipeline error:", err);
      this.update({ phase: "error", status: "Generation failed", error: msg });
    } finally {
      console.log("[pipeline] Pipeline finished. Final phase:", this.data.phase);
      bridge.setIsGenerating(false);
      this.cleanup();
    }
  }

  // ── Resume from checkpoint ──────────────────────────────────

  async resumePipeline(projectId: string, config: PipelineConfig, bridge: ContextBridge) {
    const state = await loadProjectState(projectId);
    if (!state) {
      console.warn("No checkpoint found for project", projectId);
      return this.startPipeline(config, bridge);
    }

    // Pre-populate storyboard images from checkpoint
    const mergedImages = { ...config.storyboardImages, ...state.storyboardImages };
    const resumeConfig: PipelineConfig = { ...config, storyboardImages: mergedImages };

    // Start pipeline with cached images — generateImage will skip cached scenes
    return this.startPipeline(resumeConfig, bridge);
  }
}

export const pipelineManager = new PipelineManager();
