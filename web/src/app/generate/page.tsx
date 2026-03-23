"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, Scene, QUALITY_TIERS, VIDEO_DIMENSIONS, POLLEN_COSTS, calculateTotalCost } from "@/context/AppContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useRef } from "react";
import { saveToHistory, saveProjectState } from "@/lib/videoHistory";
import { uploadProjectAssets } from "@/lib/cloudStorage";
import SocialCopyPanel from "@/components/SocialCopyPanel";

type SceneStatus = {
  phase: "queued" | "image" | "video" | "complete" | "error";
  imageURL?: string;
  imageUUID?: string;
  videoURL?: string;
  audioURL?: string;
  error?: string;
  progress: number;
};

/** Measure actual audio duration from a data URL using HTML Audio element */
function getAudioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(dataUrl);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration || 8);
    });
    audio.addEventListener('error', () => {
      resolve(8); // fallback
    });
    // Timeout fallback in case metadata never loads
    setTimeout(() => resolve(8), 5000);
  });
}

export default function VideoGeneration() {
  const {
    scriptData,
    finalVideoUrl,
    setFinalVideoUrl,
    qualityTier,
    videoDimension,
    selectedVoice,
    musicEnabled,
    captionsEnabled,
    pollenUsed, setPollenUsed,
    storyboardImages,
    referenceImages,
    url,
    mode,
    audioFile,
    setSceneAudioUrls,
    setSceneVideoUrls,
    setSceneDurations,
    generateRequested,
    setGenerateRequested,
  } = useAppContext();
  const router = useRouter();
  const isMusicVideo = mode === "music-video";
  const tier = QUALITY_TIERS[qualityTier];
  const dim = videoDimension || VIDEO_DIMENSIONS[0];
  const [progress, setProgress] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [sceneStatuses, setSceneStatuses] = useState<Record<number, SceneStatus>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [stitchStatus, setStitchStatus] = useState<string>("");
  const [previewSceneId, setPreviewSceneId] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressHistoryRef = useRef<{ time: number; progress: number }[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  // Prevent double-run across StrictMode AND page refreshes.
  // sessionStorage key is tied to this specific script title so a genuinely new
  // generation (different script) is allowed to start fresh.
  const pipelineSessionKey = `pipeline_running_${scriptData?.title ?? ""}`;
  const pipelineStartedRef = useRef(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Elapsed time timer
  useEffect(() => {
    if (isGenerating && !finalVideoUrl) {
      setElapsedSeconds(0);
      progressHistoryRef.current = [];
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isGenerating, finalVideoUrl]);

  // ETA calculation based on progress rate
  useEffect(() => {
    if (!isGenerating || finalVideoUrl || progress <= 0) {
      setEtaSeconds(null);
      return;
    }
    // Record progress snapshots
    const now = elapsedSeconds;
    const history = progressHistoryRef.current;
    if (history.length === 0 || history[history.length - 1].progress !== progress) {
      history.push({ time: now, progress });
      // Keep last 10 entries
      if (history.length > 10) history.shift();
    }
    // Need at least 2 data points
    if (history.length < 2 || progress >= 100) {
      // Provide rough estimates based on scene count and tier
      const scenes = scriptData?.scenes?.length || 5;
      const hasAIVideo = tier.useAIVideo;
      const roughTotal = hasAIVideo ? scenes * 35 + 60 : scenes * 8 + 30; // seconds
      const remaining = Math.max(5, roughTotal - now);
      setEtaSeconds(remaining);
      return;
    }
    // Calculate rate from recent history
    const oldest = history[0];
    const latest = history[history.length - 1];
    const timeDelta = latest.time - oldest.time;
    const progressDelta = latest.progress - oldest.progress;
    if (timeDelta > 0 && progressDelta > 0) {
      const rate = progressDelta / timeDelta; // percent per second
      const remaining = (100 - progress) / rate;
      setEtaSeconds(Math.max(5, Math.round(remaining)));
    }
  }, [elapsedSeconds, progress, isGenerating, finalVideoUrl, scriptData?.scenes?.length, tier.useAIVideo]);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
    return () => {
      try { ffmpegRef.current?.terminate(); } catch {}
      ffmpegRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (finalVideoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(finalVideoUrl);
      }
    };
  }, [finalVideoUrl]);

  const updateSceneStatus = useCallback((sceneId: number, update: Partial<SceneStatus>) => {
    setSceneStatuses(prev => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], ...update },
    }));
  }, []);

  // Generate image for a scene — uses storyboard cache if available
  const generateSceneImage = useCallback(async (scene: Scene): Promise<{ imageURL: string; imageUUID: string } | null> => {
    try {
      // Use cached storyboard image if available
      if (storyboardImages[scene.id]) {
        updateSceneStatus(scene.id, { phase: "image", progress: 50, imageURL: storyboardImages[scene.id], imageUUID: `cached-${scene.id}` });
        return { imageURL: storyboardImages[scene.id], imageUUID: `cached-${scene.id}` };
      }

      updateSceneStatus(scene.id, { phase: "image", progress: 20 });
      // All tiers use Pollinations (nanobanana-pro/seedream-pro) for images — NO flux
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visual_prompt,
          width: 1280,
          height: 768,
        }),
      });
      if (!res.ok) throw new Error(`Image API error: ${res.status}`);

      const data = await res.json();
      if (data.success && data.images?.[0]) {
        const img = data.images[0];
        updateSceneStatus(scene.id, { phase: "image", progress: 50, imageURL: img.imageURL, imageUUID: img.imageUUID });
        return { imageURL: img.imageURL, imageUUID: img.imageUUID };
      }
      throw new Error(data.error || "Image generation failed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Image generation failed";
      updateSceneStatus(scene.id, { phase: "error", error: errorMsg });
      return null;
    }
  }, [updateSceneStatus, storyboardImages]);

  // Generate TTS voiceover for a scene via Pollinations
  const generateSceneAudio = useCallback(async (scene: Scene): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scene.narration,
          voice: selectedVoice,
          useEdgeTTS: qualityTier === "basic", // free mode uses Edge TTS
        }),
      });
      if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
      const data = await res.json();
      if (data.success && data.audioUrl) {
        updateSceneStatus(scene.id, { audioURL: data.audioUrl });
        return data.audioUrl;
      }
      return null;
    } catch (err) {
      console.error("TTS generation error:", err);
      return null;
    }
  }, [updateSceneStatus]);

  // Generate background music via Pollinations
  const generateMusic = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `cinematic background music for a documentary video about: ${scriptData?.title || "a documentary"}`,
          duration: 60,
        }),
      });
      if (!res.ok) throw new Error(`Music API error: ${res.status}`);
      const data = await res.json();
      if (data.success && data.audioUrl) {
        setMusicUrl(data.audioUrl);
        return data.audioUrl;
      }
      return null;
    } catch (err) {
      console.error("Music generation error:", err);
      return null;
    }
  }, [scriptData?.title]);

  // Main generation pipeline
  useEffect(() => {
    if (!scriptData || isGenerating || finalVideoUrl || !userStarted) return;
    // Prevent double-run: check both the in-memory ref (StrictMode) and
    // sessionStorage (page refresh during FFmpeg loading)
    if (pipelineStartedRef.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(pipelineSessionKey) === "running") {
      console.log("[Pipeline] Detected prior run in sessionStorage — skipping duplicate start");
      return;
    }
    pipelineStartedRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(pipelineSessionKey, "running");

    const runPipeline = async () => {
      setIsGenerating(true);
      setProgress(5);

      // Initial statuses
      const initialStatuses: Record<number, SceneStatus> = {};
      scriptData.scenes.forEach(s => {
        initialStatuses[s.id] = { phase: "queued", progress: 0 };
      });
      setSceneStatuses(initialStatuses);

      // Music Video mode: no background music generation (audio IS the music)
      // Link/Story mode: generate background music if enabled
      const musicPromise = (!isMusicVideo && musicEnabled) ? generateMusic() : Promise.resolve(null);

      const totalScenes = scriptData.scenes.length;
      let completedScenes = 0;

      // Step 1: Generate images + TTS for all scenes in parallel (these are fast)
      setStitchStatus("Generating images & voiceovers...");
      const imageAudioResults = await Promise.all(
        scriptData.scenes.map(async (scene, index) => {
          setActiveSceneIndex(index);
          const audioPromise = isMusicVideo ? Promise.resolve(null) : generateSceneAudio(scene);
          const imageResult = await generateSceneImage(scene);
          if (!imageResult) throw new Error(`Scene ${index + 1} image failed`);
          const audioUrl = await audioPromise;
          let actualDuration = scene.duration_estimate_seconds;
          if (!isMusicVideo && audioUrl) {
            const audioDur = await getAudioDuration(audioUrl);
            actualDuration = Math.max(audioDur + 1.5, scene.duration_estimate_seconds);
            console.log(`Scene ${index + 1}: estimated=${scene.duration_estimate_seconds}s, audio=${audioDur.toFixed(1)}s, using=${actualDuration.toFixed(1)}s`);
          }

          completedScenes++;
          setProgress(Math.round(10 + (completedScenes / totalScenes) * 30));

          return { image: imageResult.imageURL, audio: audioUrl, duration: actualDuration, narration: scene.narration, scene };
        })
      );

      // Save audio URLs and actual measured durations to AppContext so editor can use them
      const audioMap: Record<number, string> = {};
      const durationMap: Record<number, number> = {};
      imageAudioResults.forEach(r => {
        if (r.audio) audioMap[r.scene.id] = r.audio;
        durationMap[r.scene.id] = r.duration; // actual duration (audio length + 1.5s padding)
      });
      if (Object.keys(audioMap).length > 0) setSceneAudioUrls(audioMap);
      if (Object.keys(durationMap).length > 0) setSceneDurations(durationMap);

      // Save a draft history entry NOW — before FFmpeg stitching — so the user
      // sees their project in Recent Videos even if stitching fails or page closes
      const draftHistoryId = Date.now().toString();
      const firstSceneImgDraft = imageAudioResults[0]?.image;
      const totalSecsDraft = imageAudioResults.reduce((sum, a) => sum + (a.duration || 8), 0);
      await saveToHistory({
        id: draftHistoryId,
        title: scriptData?.title || "Untitled Video",
        topic: url || "",
        angle: scriptData?.angle || "",
        thumbnailUrl: firstSceneImgDraft,
        quality: qualityTier,
        dimensionId: dim.id,
        dimensionLabel: dim.label,
        totalSeconds: totalSecsDraft,
        createdAt: new Date().toISOString(),
      });

      const imagesMap: Record<number, string> = {};
      imageAudioResults.forEach(r => {
        imagesMap[r.scene.id] = r.image;
      });

      await saveProjectState({
        id: draftHistoryId,
        scriptData,
        storyboardImages: imagesMap,
        sceneAudioUrls: audioMap,
        sceneVideoUrls: {},
        sceneDurations: durationMap,
        musicUrl: null,
        finalVideoUrl: null
      });

      // Step 2: Determine which scenes get AI video vs Ken Burns
      // "key_scenes" strategy: first scene (hook), middle scene (climax), last scene (ending)
      // "all" strategy: every scene gets AI video
      // "none" strategy: all Ken Burns
      const videoStrategy: string = tier.videoSceneStrategy || "none";
      const maxVideoScenes = (tier as any).maxVideoScenes || imageAudioResults.length;
      let videoSceneIndices: Set<number> = new Set();

      if (videoStrategy === "all") {
        // All scenes get video
        for (let i = 0; i < imageAudioResults.length; i++) videoSceneIndices.add(i);
      } else if (videoStrategy === "alternating" && imageAudioResults.length > 0) {
        // Alternating pattern: 3 AI video, 3 Ken Burns, repeating
        const groupSize = (tier as any).alternatingGroupSize || 3;
        for (let i = 0; i < imageAudioResults.length; i++) {
          const groupIndex = Math.floor(i / groupSize);
          // Even groups (0, 2, 4...) = AI video, odd groups (1, 3, 5...) = Ken Burns
          if (groupIndex % 2 === 0) videoSceneIndices.add(i);
        }
      } else if (videoStrategy === "key_scenes" && imageAudioResults.length > 0) {
        // Pick the most impactful scenes: first (hook), climax (middle), last (ending)
        const total = imageAudioResults.length;
        videoSceneIndices.add(0);
        if (total > 2) videoSceneIndices.add(Math.floor(total / 2));
        if (total > 1) videoSceneIndices.add(total - 1);
        while (videoSceneIndices.size < Math.min(maxVideoScenes, total)) {
          const climax = Math.floor(total / 2);
          for (let offset = 1; offset < total; offset++) {
            if (videoSceneIndices.size >= maxVideoScenes) break;
            if (climax + offset < total) videoSceneIndices.add(climax + offset);
            if (videoSceneIndices.size >= maxVideoScenes) break;
            if (climax - offset >= 0) videoSceneIndices.add(climax - offset);
          }
        }
      }

      console.log(`Video strategy: ${videoStrategy}, video scenes: [${[...videoSceneIndices].join(",")}] of ${imageAudioResults.length} total`);

      // Step 3: Generate AI videos SEQUENTIALLY for selected scenes
      const sceneAssets: { image: string; audio: string | null; duration: number; narration: string; aiVideoUrl: string | null }[] = [];
      if (tier.useAIVideo && videoSceneIndices.size > 0) {
        const videoCount = videoSceneIndices.size;
        let videosCompleted = 0;
        setStitchStatus(`Generating ${videoCount} AI video clips + ${imageAudioResults.length - videoCount} Ken Burns...`);

        for (let i = 0; i < imageAudioResults.length; i++) {
          const result = imageAudioResults[i];
          const scene = result.scene;
          let aiVideoUrl: string | null = null;

          if (videoSceneIndices.has(i)) {
            // This scene gets AI video
            try {
              updateSceneStatus(scene.id, { phase: "video", progress: 70 });
              const videoRes = await fetch("/api/video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: scene.visual_prompt,
                  duration: Math.min(Math.ceil(result.duration), 15),
                  mode: "ai",
                }),
              });
              if (!videoRes.ok) throw new Error(`Video API error: ${videoRes.status}`);
              const videoData = await videoRes.json();
              if (videoData.success && videoData.videoUrl && !videoData.useKenBurns) {
                aiVideoUrl = videoData.videoUrl;
                console.log(`Scene ${i + 1}: AI Video generated ✓`);
              } else {
                console.warn(`Scene ${i + 1}: AI Video unavailable, using Ken Burns`);
              }
            } catch (videoErr) {
              console.warn(`Scene ${i + 1}: AI Video error, using Ken Burns:`, videoErr);
            }
            videosCompleted++;
          } else {
            // This scene uses Ken Burns (just image)
            console.log(`Scene ${i + 1}: Ken Burns`);
          }

          updateSceneStatus(scene.id, {
            phase: "complete",
            progress: 100,
            videoURL: aiVideoUrl || undefined,
            audioURL: result.audio || undefined,
          });

          setProgress(Math.round(40 + ((i + 1) / imageAudioResults.length) * 30));
          sceneAssets.push({ image: result.image, audio: result.audio, duration: result.duration, narration: result.narration, aiVideoUrl });
        }
      } else {
        // No AI video — all Ken Burns, just mark complete
        for (const result of imageAudioResults) {
          updateSceneStatus(result.scene.id, {
            phase: "complete",
            progress: 100,
            audioURL: result.audio || undefined,
          });
          sceneAssets.push({ image: result.image, audio: result.audio, duration: result.duration, narration: result.narration, aiVideoUrl: null });
        }
      }

      // Save video URLs to AppContext so editor can use them
      const videoMap: Record<number, string> = {};
      sceneAssets.forEach((a, i) => {
        const sceneId = scriptData.scenes[i]?.id;
        if (sceneId != null && a.aiVideoUrl) videoMap[sceneId] = a.aiVideoUrl;
      });
      if (Object.keys(videoMap).length > 0) setSceneVideoUrls(videoMap);

      try {
        const resolvedMusicUrl = await musicPromise;

        setProgress(75);

        if (sceneAssets.length > 0) {
          setStitchStatus("🎬 Sending scenes to server...");
          setProgress(78);

          // Build scene payload for server-side stitching
          const stitchScenes = sceneAssets.map((asset) => ({
            image: asset.image,
            audio: asset.audio ?? undefined,
            duration: asset.duration,
            narration: asset.narration,
          }));

          // Smooth fake-progress ticker: crawls 78 → 94 while server works
          let fakeP = 78;
          const fakeTimer = setInterval(() => {
            fakeP = Math.min(fakeP + 0.4, 94);
            setProgress(Math.round(fakeP));
            const pct = Math.round(((fakeP - 78) / (94 - 78)) * 100);
            if (pct < 30) setStitchStatus("🎬 Uploading scenes to server...");
            else if (pct < 60) setStitchStatus("⚙️ Encoding video clips...");
            else setStitchStatus("🔗 Joining scenes into final video...");
          }, 800);

          let stitchRes: Response;
          try {
            stitchRes = await fetch("/api/stitch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scenes: stitchScenes,
                resolution: { width: dim.width, height: dim.height },
                musicUrl: (!isMusicVideo && resolvedMusicUrl) ? resolvedMusicUrl : null,
                captionsEnabled,
              }),
            });
          } finally {
            clearInterval(fakeTimer);
          }

          if (!stitchRes!.ok) {
            const errData = await stitchRes!.json().catch(() => ({}));
            throw new Error(errData.error ?? `Server stitching failed (${stitchRes!.status})`);
          }

          setStitchStatus("📦 Downloading your video...");
          setProgress(96);

          const videoBlob = await stitchRes!.blob();
          const videoObjectUrl = URL.createObjectURL(videoBlob);
          setFinalVideoUrl(videoObjectUrl);


          setStitchStatus("");
          setProgress(100);

          // Track credits — use accurate per-operation calculation
          const actualVideoScenes = sceneAssets.filter(a => a.aiVideoUrl).length;
          const creditsForThis =
            tier.pollenFixed +
            (tier.pollenPerImageScene * sceneAssets.length) +
            (tier.pollenPerTTS * sceneAssets.length) +
            (tier.pollenPerVideoScene * actualVideoScenes) +
            (resolvedMusicUrl ? POLLEN_COSTS.musicGeneration : 0);
          setPollenUsed(pollenUsed + creditsForThis);

          // Upload all assets to cloud storage (if configured)
          // This replaces base64 data URLs with persistent cloud URLs
          setStitchStatus("Saving to cloud...");
          let cloudImages = imagesMap;
          let cloudAudio = audioMap;
          let cloudVideo = videoMap;
          let cloudFinalVideo: string | null = null;

          try {
            // Get the final video blob URL as a data URL for upload
            let finalVideoDataUrl: string | null = null;
            // We can't easily convert blob URL back, so upload individual assets
            const cloudAssets = await uploadProjectAssets(draftHistoryId, {
              storyboardImages: imagesMap,
              sceneAudioUrls: audioMap,
              sceneVideoUrls: videoMap,
              finalVideoUrl: finalVideoDataUrl,
            });
            cloudImages = cloudAssets.storyboardImages;
            cloudAudio = cloudAssets.sceneAudioUrls;
            cloudVideo = cloudAssets.sceneVideoUrls;
            cloudFinalVideo = cloudAssets.finalVideoUrl;

            // Update AppContext with cloud URLs so editor/assets can use them
            setSceneAudioUrls(cloudAudio);
            setSceneVideoUrls(cloudVideo);
          } catch (uploadErr) {
            console.warn("Cloud upload failed (assets saved locally only):", uploadErr);
          }
          setStitchStatus("");

          // Update draft history entry with final stats (reuse same ID so it overwrites)
          const totalSecs = sceneAssets.reduce((sum, a) => sum + (a.duration || 8), 0);
          await saveToHistory({
            id: draftHistoryId,
            title: scriptData?.title || "Untitled Video",
            topic: url || "",
            angle: scriptData?.angle || "",
            thumbnailUrl: cloudImages[scriptData.scenes[0]?.id] || sceneAssets[0]?.image || firstSceneImgDraft,
            quality: qualityTier,
            dimensionId: dim.id,
            dimensionLabel: dim.label,
            totalSeconds: totalSecs,
            createdAt: new Date().toISOString(),
          });

          await saveProjectState({
            id: draftHistoryId,
            scriptData,
            storyboardImages: cloudImages,
            sceneAudioUrls: cloudAudio,
            sceneVideoUrls: cloudVideo,
            sceneDurations: durationMap,
            musicUrl: resolvedMusicUrl || null,
            finalVideoUrl: cloudFinalVideo,
          });
        }
      } catch (err) {
        console.error("Pipeline error:", err);
        setStitchStatus("Error: " + (err as Error).message);
      } finally {
        setIsGenerating(false);
      // Clear session guard so user can start a fresh generation
      if (typeof window !== "undefined") sessionStorage.removeItem(pipelineSessionKey);
      }
    };

    runPipeline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptData, finalVideoUrl, userStarted]);

  // Auto-start only if user came via pipeline (generateRequested flag)
  // MUST be before any early returns to comply with React Hook rules
  useEffect(() => {
    if (hasMounted && generateRequested && !userStarted) {
      setGenerateRequested(false);
      setUserStarted(true);
    }
  }, [hasMounted, generateRequested, userStarted, setGenerateRequested]);

  if (!hasMounted) return null;

  if (!scriptData) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-outline/30 mb-4">movie</span>
      <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No Video to Generate</h3>
      <p className="text-outline text-sm max-w-md mb-6">Create a script first, then come here to generate your video.</p>
      <a href="/" className="primary-gradient text-white px-6 py-3 rounded-xl font-headline font-bold flex items-center gap-2 shadow-md">
        <span className="material-symbols-outlined">home</span>
        Go to Dashboard
      </a>
    </div>
  );

  if (!isGenerating && !finalVideoUrl && !userStarted) return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
      <span className="material-symbols-outlined text-6xl text-primary/40">movie</span>
      <h3 className="font-headline font-bold text-xl text-on-surface">Ready to Generate</h3>
      <p className="text-outline text-sm max-w-md">
        Your script has {scriptData.scenes.length} scenes. Click below to start generating images, voiceovers, and video.
      </p>
      <button
        onClick={() => setUserStarted(true)}
        className="primary-gradient text-white font-headline font-bold px-8 py-4 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
        Start Generation
      </button>
    </div>
  );

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/script" className="text-outline hover:text-primary transition-colors">Script Builder</Link>
          <span className="material-symbols-outlined text-outline-variant text-sm">chevron_right</span>
          <span className="font-headline font-bold text-on-surface">Video Generation</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header & Global Progress */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="font-headline text-display-lg text-4xl font-extrabold tracking-tight">Video Generation</h2>
              <div className="flex flex-wrap items-center gap-2 text-outline">
                <span className={`font-label text-xs uppercase tracking-widest px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}>{tier.label}</span>
                <span className="font-label text-xs uppercase tracking-widest">{dim.label}</span>
                {musicEnabled && <span className="font-label text-xs text-primary flex items-center gap-1"><span className="material-symbols-outlined text-xs">music_note</span>Music On</span>}
              </div>
            </div>
            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-semibold text-primary">Rendering Progress</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-tighter">{tier.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono text-sm text-outline tabular-nums block">
                      {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                    </span>
                    {etaSeconds != null && progress < 100 && progress > 0 && (
                      <span className="font-mono text-[10px] text-primary/70 tabular-nums block">
                        ~{etaSeconds >= 60 ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : `${etaSeconds}s`} left
                      </span>
                    )}
                  </div>
                  <span className="font-headline text-2xl font-bold">{progress}%</span>
                </div>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_12px_rgba(75,142,255,0.4)] transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Bento Layout */}
          <div className="grid grid-cols-12 gap-6 pb-20">
            {/* Main Preview Player */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="relative aspect-video rounded-xl bg-surface-container-lowest overflow-hidden group border border-outline-variant/10">
                {finalVideoUrl ? (
                  <video src={finalVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                ) : (
                  <>
                    {(() => {
                      const activeStatus = scriptData?.scenes[activeSceneIndex]
                        ? sceneStatuses[scriptData.scenes[activeSceneIndex].id]
                        : undefined;
                      if (activeStatus?.imageURL) {
                        return <img alt="Scene Preview" className="w-full h-full object-cover" src={activeStatus.imageURL} />;
                      }
                      return (
                        <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-outline/30">movie</span>
                        </div>
                      );
                    })()}

                    <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        <span className="bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/30">Generating</span>
                      </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary">auto_fix_high</span>
                        </div>
                        <p className="font-body text-sm font-medium text-on-surface drop-shadow-md">
                          {stitchStatus || (() => {
                            const activeStatus = scriptData?.scenes[activeSceneIndex]
                              ? sceneStatuses[scriptData.scenes[activeSceneIndex].id]
                              : undefined;
                            if (activeStatus?.phase === "image") return `Generating image for scene ${activeSceneIndex + 1}/${scriptData?.scenes.length}...`;
                            if (activeStatus?.phase === "video") return `Creating AI video for scene ${activeSceneIndex + 1}/${scriptData?.scenes.length}...`;
                            return `Processing scene ${activeSceneIndex + 1}/${scriptData?.scenes.length}...`;
                          })()}
                        </p>
                        {etaSeconds != null && progress < 100 && progress > 0 && (
                          <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">timer</span>
                            <span className="text-white/90 text-xs font-mono tabular-nums">
                              {etaSeconds >= 60 ? `~${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s remaining` : `~${etaSeconds}s remaining`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 glass-card rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (finalVideoUrl) {
                        const a = document.createElement('a');
                        a.href = finalVideoUrl;
                        a.download = `${scriptData?.title || 'video'}.mp4`;
                        a.click();
                      }
                    }}
                    disabled={!finalVideoUrl}
                    className="px-6 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <span className="material-symbols-outlined">download</span>
                    Download Video
                  </button>
                  <button
                    onClick={() => router.push("/editor")}
                    disabled={!finalVideoUrl}
                    className="px-6 py-3 rounded-xl bg-secondary text-on-secondary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <span className="material-symbols-outlined">movie_edit</span>
                    Open in Editor
                  </button>
                  <button
                    onClick={() => {
                      if (!scriptData) return;
                      const promptsData = scriptData.scenes.map((s, i) => ({
                        scene: i + 1,
                        narration: s.narration,
                        visualPrompt: s.visual_prompt,
                        duration: s.duration_estimate_seconds
                      }));
                      const blob = new Blob([JSON.stringify(promptsData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${scriptData.title}-prompts.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    disabled={!scriptData}
                    className="px-6 py-3 rounded-xl bg-surface-container-highest text-on-surface font-headline font-bold flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined">description</span>
                    Export Prompts
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {musicUrl && (
                    <span className="text-primary text-xs uppercase font-label tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">music_note</span>
                      Music
                    </span>
                  )}
                  <div className="text-center">
                    <p className="text-[10px] text-outline uppercase font-label tracking-widest">Est. Cost</p>
                    <p className="font-bold text-sm text-on-surface">{qualityTier === "basic" ? "FREE" : (() => {
                      const total = scriptData?.scenes.length || 0;
                      const cost = calculateTotalCost(qualityTier, total, musicEnabled);
                      return cost > 0.01 ? `~${cost.toFixed(4)} ⚘` : "~0.01 ⚘";
                    })()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenes List Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-4 h-[calc(100vh-280px)] flex flex-col">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-lg font-bold">Generated Scenes</h3>
                <span className="text-tertiary bg-tertiary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">Pollinations AI</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">

                {scriptData?.scenes.map((scene, i) => {
                  const status = sceneStatuses[scene.id];
                  const isComplete = status?.phase === "complete";
                  const isActive = (status?.phase === "image" || status?.phase === "video");
                  const isError = status?.phase === "error";

                  if (isComplete) {
                    const isPreview = previewSceneId === scene.id;
                    return (
                      <div key={scene.id}>
                        <div
                          onClick={() => setPreviewSceneId(isPreview ? null : scene.id)}
                          className={`p-4 rounded-xl glass-card flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer ${isPreview ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
                        >
                          <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-container-lowest relative flex-shrink-0">
                            {status?.imageURL ? (
                              <img src={status.imageURL} alt={`Scene ${i+1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg">check_circle</span>
                              </div>
                            )}
                            {status?.videoURL && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span className="material-symbols-outlined text-white text-sm">play_circle</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1 min-w-0">
                                <h4 className="font-body text-sm font-semibold truncate">{String(i + 1).padStart(2, '0')}. Scene</h4>
                                <span className="text-[9px] font-medium text-primary/70 bg-primary/5 px-1 rounded flex-shrink-0">done</span>
                              </div>
                              <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                            </div>
                            <p className="text-xs text-outline line-clamp-1 mt-1 italic">&quot;{scene.narration}&quot;</p>
                          </div>
                        </div>
                        {/* Scene Preview Panel */}
                        {isPreview && (
                          <div className="mt-2 p-3 rounded-xl bg-surface-container-highest border border-outline-variant/10 space-y-2">
                            {status?.videoURL ? (
                              <video
                                src={status.videoURL}
                                controls
                                autoPlay
                                className="w-full rounded-lg"
                                style={{ maxHeight: 200 }}
                              />
                            ) : status?.imageURL ? (
                              <img src={status.imageURL} alt={`Scene ${i+1} preview`} className="w-full rounded-lg" style={{ maxHeight: 200, objectFit: "cover" }} />
                            ) : null}
                            {status?.audioURL && (
                              <audio src={status.audioURL} controls className="w-full h-8" />
                            )}
                            <p className="text-[11px] text-outline italic leading-snug">{scene.narration}</p>
                          </div>
                        )}
                      </div>
                    );
                  } else if (isActive) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-surface-container-highest border border-primary/40 flex items-start gap-4 shadow-lg shadow-primary/5">
                        <div className="w-20 h-14 rounded-lg bg-surface-container-lowest relative flex-shrink-0 overflow-hidden">
                          {status?.imageURL ? (
                            <img src={status.imageURL} alt={`Scene ${i+1}`} className="w-full h-full object-cover opacity-60" />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-body text-sm font-semibold text-primary truncate">
                              {String(i + 1).padStart(2, '0')}. Generating Image...
                            </h4>
                          </div>
                          <div className="w-full h-1 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500" style={{ width: `${status?.progress || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (isError) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-error-container/10 border border-error/20 flex items-start gap-4">
                        <div className="w-20 h-14 rounded-lg bg-error/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-error">error</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-body text-sm font-semibold text-error truncate">{String(i + 1).padStart(2, '0')}. Error</h4>
                          <p className="text-xs text-error/70 mt-1 line-clamp-1">{status?.error}</p>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/5 flex items-start gap-4 opacity-60">
                        <div className="w-20 h-14 rounded-lg bg-surface-container-lowest flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-outline">hourglass_empty</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="font-body text-sm font-semibold truncate text-outline">{String(i + 1).padStart(2, '0')}. Queued</h4>
                            <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                          </div>
                          <p className="text-xs text-outline/50 line-clamp-1 mt-1">Waiting...</p>
                        </div>
                      </div>
                    );
                  }
                })}

              </div>

              {/* Social Copy Panel — shows after video is done */}
              {finalVideoUrl && scriptData && (
                <SocialCopyPanel scriptData={scriptData} dimension={dim.id} />
              )}

              <div className="mt-4 p-4 glass-card rounded-xl border-t-2 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-on-surface">Powered by Pollinations AI</p>
                    <p className="text-[10px] text-outline">Free Image + TTS + Ken Burns Video Pipeline</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
