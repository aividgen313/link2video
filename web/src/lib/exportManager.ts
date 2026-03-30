import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export type ExportState = "idle" | "loading" | "exporting" | "complete" | "error" | "cancelled";
export type ExportQuality = "draft" | "standard" | "high";

export interface ExportProgressData {
  state: ExportState;
  status: string;
  progress: number;
  downloadUrl: string | null;
  errorMessage: string | null;
  elapsedTime: number;
  quality: ExportQuality;
  totalScenes: number;
}

export interface ExportPayload {
  scenes: any[];
  musicTrack: any;
  videoDimension: any;
  quality: ExportQuality;
  preset: { fps: number; crf: number; label: string; desc: string; icon: string };
}

type Subscriber = (data: ExportProgressData) => void;

// ── Retry stitch via server API with exponential backoff ──────────────────────
async function callStitchWithRetry(
  scenes: any[],
  resolution: { width: number; height: number },
  musicUrl?: string | null,
  userAudioDataUrl?: string | null,
  captionsEnabled?: boolean,
  onStatus?: (msg: string) => void,
  maxRetries = 3,
): Promise<Blob> {
  const delays = [1000, 2000, 4000]; // exponential backoff ms

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const wait = delays[Math.min(attempt - 1, delays.length - 1)];
      onStatus?.(`Stitch failed (502), retrying in ${wait / 1000}s… (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise((res) => setTimeout(res, wait));
    }

    onStatus?.(attempt === 0 ? "Sending to server for stitching…" : `Retrying stitch (attempt ${attempt + 1})…`);

    const res = await fetch("/api/stitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes,
        resolution,
        musicUrl: musicUrl ?? null,
        userAudioDataUrl: userAudioDataUrl ?? null,
        captionsEnabled: captionsEnabled ?? false,
      }),
    });

    // Retry on gateway/server-overload status codes
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt >= maxRetries) {
        throw new Error(`Server stitch failed after ${maxRetries + 1} attempts (HTTP ${res.status})`);
      }
      continue; // retry
    }

    if (!res.ok) {
      let errMsg = `Server stitch error (HTTP ${res.status})`;
      try {
        const errBody = await res.json();
        if (errBody?.error) errMsg = errBody.error;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const blob = await res.blob();
    return blob;
  }

  throw new Error("Stitch retry loop exhausted");
}

class ExportManager {
  private ffmpeg: FFmpeg | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private abortFlag = false;
  private blobUrl: string | null = null;

  private data: ExportProgressData = {
    state: "idle",
    status: "",
    progress: 0,
    downloadUrl: null,
    errorMessage: null,
    elapsedTime: 0,
    quality: "standard",
    totalScenes: 0,
  };

  private subscribers = new Set<Subscriber>();

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    callback(this.data); // Initial push
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb({ ...this.data }));
  }

  private update(partial: Partial<ExportProgressData>) {
    this.data = { ...this.data, ...partial };
    this.notify();
  }

  getState() {
    return this.data;
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      this.ffmpeg?.terminate();
    } catch { /* ok */ }
    this.ffmpeg = null;
  }

  cancel() {
    this.abortFlag = true;
    this.cleanup();
    this.update({
      state: "cancelled",
      status: "Export cancelled",
      progress: 0,
    });
  }

  reset() {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    this.update({
      state: "idle",
      status: "Ready",
      progress: 0,
      downloadUrl: null,
      errorMessage: null,
      elapsedTime: 0,
    });
    this.abortFlag = false;
  }

  async startExport(payload: ExportPayload) {
    if (this.data.state === "loading" || this.data.state === "exporting") return;

    this.reset();
    this.abortFlag = false;
    this.update({
      state: "loading",
      status: "Preparing export…",
      quality: payload.quality,
      totalScenes: payload.scenes.filter((s) => !s.isHidden).length,
    });

    this.startTime = Date.now();
    this.timer = setInterval(() => {
      this.update({ elapsedTime: Date.now() - this.startTime });
    }, 500);

    try {
      const visibleScenes = payload.scenes.filter((s) => !s.isHidden);

      if (this.abortFlag) return;

      // ── Attempt server-side stitch first (with 502 retry) ──────────────────
      this.update({ state: "exporting", status: "Preparing scenes…", progress: 10 });

      const W = payload.videoDimension?.width || 1280;
      const H = payload.videoDimension?.height || 720;

      // Build scene payloads for server
      const videoScenes = visibleScenes.filter((s) => s.trackId === "v1" || !s.trackId).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      const audioScenes = visibleScenes.filter((s) => s.trackId === "a1").sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

      const serverScenes = videoScenes.map((scene: any, i: number) => {
        const matchingAudio = audioScenes[i];
        return {
          image: scene.imageUrl || null,
          video: scene.aiVideoUrl || null,
          audio: matchingAudio && !matchingAudio.isMuted ? matchingAudio.audioUrl : null,
          duration: scene.duration || 8,
          narration: scene.narration || "",
          transition: scene.transition || "none",
          transitionDuration: scene.transitionDuration || 0.5,
        };
      });

      if (serverScenes.length === 0) {
        throw new Error("No scenes with images to export");
      }

      this.update({ status: "Stitching video on server…", progress: 20 });

      try {
        const blob = await callStitchWithRetry(
          serverScenes,
          { width: W, height: H },
          payload.musicTrack?.url ?? null,
          null, // userAudioDataUrl not applicable here
          false,
          (msg) => {
            if (!this.abortFlag) this.update({ status: msg, progress: 50 });
          },
          3 // max retries
        );

        if (this.abortFlag) return;

        this.update({ status: "Saving…", progress: 95 });
        this.blobUrl = URL.createObjectURL(blob);

        this.update({
          downloadUrl: this.blobUrl,
          progress: 100,
          status: "Export complete!",
          state: "complete",
        });

        return; // ✅ server stitch succeeded
      } catch (serverErr) {
        // Server stitch failed — fall back to client-side ffmpeg.wasm
        console.warn("[ExportManager] Server stitch failed, falling back to client-side FFmpeg:", serverErr);
        if (this.abortFlag) return;
        this.update({ status: "Server unavailable — using client-side encoder…", progress: 5 });
      }

      // ── Fallback: Client-side FFmpeg.wasm ─────────────────────────────────
      this.update({ status: "Loading FFmpeg…", progress: 5 });
      this.ffmpeg = new FFmpeg();

      const loadPromise = this.ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FFmpeg timeout")), 30000)
      );

      await Promise.race([loadPromise, timeoutPromise]);
      if (this.abortFlag) return;

      this.update({ state: "exporting" });

      const totalScenes = visibleScenes.length;
      const concatEntries: string[] = [];

      for (let i = 0; i < totalScenes; i++) {
        if (this.abortFlag) return;

        const scene = visibleScenes[i];
        this.update({
          status: `Processing scene ${i + 1}/${totalScenes}...`,
          progress: Math.round(10 + ((i + 1) / totalScenes) * 70),
        });

        const imgFile = `img${i}.jpg`;
        const vidFile = `vid${i}.mp4`;

        if (scene.aiVideoUrl) {
          await this.ffmpeg!.writeFile(vidFile, await fetchFile(scene.aiVideoUrl));
        } else if (scene.imageUrl) {
          await this.ffmpeg!.writeFile(imgFile, await fetchFile(scene.imageUrl));
          const w = payload.videoDimension?.width || 1280;
          const h = payload.videoDimension?.height || 720;
          const fps = payload.preset.fps;

          await this.ffmpeg!.exec([
            "-loop", "1", "-i", imgFile,
            "-vf", `scale=${w * 2}:${h * 2},zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${scene.duration * fps}:s=${w}x${h}:fps=${fps}`,
            "-c:v", "libx264", "-t", String(scene.duration),
            "-pix_fmt", "yuv420p", "-r", String(fps),
            "-crf", String(payload.preset.crf),
            vidFile,
          ]);
        } else {
          continue;
        }

        if (this.abortFlag) return;

        if (scene.audioUrl && !scene.isMuted) {
          const audioFile = `audio${i}.mp3`;
          await this.ffmpeg!.writeFile(audioFile, await fetchFile(scene.audioUrl));
          const mergedFile = `merged${i}.mp4`;
          await this.ffmpeg!.exec([
            "-i", vidFile, "-i", audioFile,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-filter:a", `volume=${scene.volume}`,
            "-shortest", mergedFile,
          ]);
          concatEntries.push(`file '${mergedFile}'`);
        } else {
          const silentFile = `silent${i}.mp4`;
          await this.ffmpeg!.exec([
            "-i", vidFile,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            silentFile,
          ]);
          concatEntries.push(`file '${silentFile}'`);
        }
      }

      if (this.abortFlag) return;

      if (concatEntries.length === 0) {
        throw new Error("No scenes with images to export");
      }

      this.update({ status: "Stitching...", progress: 85 });
      const concatContent = concatEntries.join("\n");
      await this.ffmpeg!.writeFile("concat.txt", new TextEncoder().encode(concatContent));

      await this.ffmpeg!.exec([
        "-f", "concat", "-safe", "0", "-i", "concat.txt",
        "-c:v", "libx264", "-c:a", "aac",
        "-crf", String(payload.preset.crf),
        "master.mp4",
      ]);

      if (this.abortFlag) return;

      let finalFile = "master.mp4";

      if (payload.musicTrack?.url) {
        this.update({ status: "Mixing music...", progress: 90 });
        await this.ffmpeg!.writeFile("bgm.mp3", await fetchFile(payload.musicTrack.url));
        await this.ffmpeg!.exec([
          "-i", "master.mp4", "-i", "bgm.mp3",
          "-filter_complex", `[1:a]volume=${payload.musicTrack.volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]`,
          "-map", "0:v", "-map", "[aout]",
          "-c:v", "copy", "-c:a", "aac",
          "final.mp4",
        ]);
        finalFile = "final.mp4";
      }

      if (this.abortFlag) return;

      this.update({ status: "Saving...", progress: 95 });
      const outData = await this.ffmpeg!.readFile(finalFile);
      const blob = new Blob([(outData as unknown as ArrayBuffer)], { type: "video/mp4" });
      this.blobUrl = URL.createObjectURL(blob);

      this.update({
        downloadUrl: this.blobUrl,
        progress: 100,
        status: "Export complete!",
        state: "complete"
      });

    } catch (err) {
      if (this.abortFlag) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("ExportManager err:", err);
      this.update({
        state: "error",
        status: "Failed",
        errorMessage: msg
      });
    } finally {
      this.cleanup();
    }
  }
}

export const exportManager = new ExportManager();
