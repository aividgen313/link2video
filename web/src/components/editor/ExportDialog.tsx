"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useEditorContext } from "@/context/EditorContext";
import { useAppContext } from "@/context/AppContext";

type ExportQuality = "draft" | "standard" | "high";
type ExportFormat = "mp4" | "webm";
type ExportState = "idle" | "loading" | "exporting" | "complete" | "error" | "cancelled";

const QUALITY_PRESETS: Record<ExportQuality, { label: string; desc: string; fps: number; crf: number; icon: string }> = {
  draft: { label: "Draft", desc: "Fast export, lower quality", fps: 15, crf: 32, icon: "bolt" },
  standard: { label: "Standard", desc: "Good quality, balanced speed", fps: 25, crf: 23, icon: "tune" },
  high: { label: "High", desc: "Best quality, slower export", fps: 30, crf: 18, icon: "hd" },
};

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { scenes, musicTrack } = useEditorContext();
  const { videoDimension } = useAppContext();

  const [exportState, setExportState] = useState<ExportState>("idle");
  const [status, setStatus] = useState("Ready to export");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<ExportQuality>("standard");
  const [format] = useState<ExportFormat>("mp4");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const startTimeRef = useRef(0);

  const visibleScenes = scenes.filter(s => !s.isHidden);
  const totalDuration = visibleScenes.reduce((s, sc) => s + sc.duration, 0);
  const preset = QUALITY_PRESETS[quality];

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Terminate FFmpeg
      try {
        ffmpegRef.current?.terminate();
      } catch { /* already terminated */ }
      ffmpegRef.current = null;
      // Revoke blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const estimateTime = () => {
    const secondsPerScene = quality === "draft" ? 3 : quality === "standard" ? 6 : 10;
    const totalSec = visibleScenes.length * secondsPerScene + 10;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `~${min}m ${sec}s` : `~${sec}s`;
  };

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const estimateRemaining = () => {
    if (progress <= 0 || elapsedTime <= 0) return "";
    const totalEstMs = (elapsedTime / progress) * 100;
    const remaining = Math.max(0, totalEstMs - elapsedTime);
    const sec = Math.floor(remaining / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      ffmpegRef.current?.terminate();
    } catch { /* ok */ }
    ffmpegRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    cleanup();
    setExportState("cancelled");
    setStatus("Export cancelled");
    setProgress(0);
  }, [cleanup]);

  const resetForNewExport = useCallback(() => {
    // Revoke old blob URL if exists
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setDownloadUrl(null);
    setExportState("idle");
    setStatus("Ready to export");
    setProgress(0);
    setElapsedTime(0);
    setCurrentScene(0);
    setErrorMessage(null);
    abortRef.current = false;
  }, []);

  const handleExport = async () => {
    // Reset state for re-export
    resetForNewExport();
    abortRef.current = false;
    setExportState("loading");
    setStatus("Loading FFmpeg...");

    const start = Date.now();
    startTimeRef.current = start;

    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 500);

    try {
      // ── Load FFmpeg with timeout ──
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      const loadPromise = ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FFmpeg WASM load timed out after 30 seconds")), 30000)
      );

      await Promise.race([loadPromise, timeoutPromise]);

      if (abortRef.current) return;

      setExportState("exporting");
      const totalScenes = visibleScenes.length;
      const concatEntries: string[] = [];

      for (let i = 0; i < totalScenes; i++) {
        if (abortRef.current) return;

        const scene = visibleScenes[i];
        setCurrentScene(i + 1);
        setStatus(`Processing scene ${i + 1}/${totalScenes}: ${scene.narration.slice(0, 40)}...`);
        setProgress(Math.round(((i + 1) / totalScenes) * 80)); // Fixed: i+1 instead of i

        const imgFile = `img${i}.jpg`;
        const vidFile = `vid${i}.mp4`;

        if (scene.aiVideoUrl) {
          await ffmpeg.writeFile(vidFile, await fetchFile(scene.aiVideoUrl));
        } else if (scene.imageUrl) {
          await ffmpeg.writeFile(imgFile, await fetchFile(scene.imageUrl));
          const w = videoDimension?.width || 1280;
          const h = videoDimension?.height || 720;

          await ffmpeg.exec([
            "-loop", "1", "-i", imgFile,
            "-vf", `scale=${w * 2}:${h * 2},zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${scene.duration * preset.fps}:s=${w}x${h}:fps=${preset.fps}`,
            "-c:v", "libx264", "-t", String(scene.duration),
            "-pix_fmt", "yuv420p", "-r", String(preset.fps),
            "-crf", String(preset.crf),
            vidFile,
          ]);
        } else {
          continue;
        }

        if (abortRef.current) return;

        if (scene.audioUrl && !scene.isMuted) {
          const audioFile = `audio${i}.mp3`;
          await ffmpeg.writeFile(audioFile, await fetchFile(scene.audioUrl));
          const mergedFile = `merged${i}.mp4`;
          await ffmpeg.exec([
            "-i", vidFile, "-i", audioFile,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-filter:a", `volume=${scene.volume}`,
            "-shortest", mergedFile,
          ]);
          concatEntries.push(`file '${mergedFile}'`);
        } else {
          const silentFile = `silent${i}.mp4`;
          await ffmpeg.exec([
            "-i", vidFile,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            silentFile,
          ]);
          concatEntries.push(`file '${silentFile}'`);
        }
      }

      if (abortRef.current) return;

      if (concatEntries.length === 0) {
        setStatus("No scenes to export");
        setExportState("error");
        setErrorMessage("No scenes with images to export");
        cleanup();
        return;
      }

      setStatus("Stitching scenes together...");
      setProgress(85);
      const concatContent = concatEntries.join("\n");
      await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatContent));

      await ffmpeg.exec([
        "-f", "concat", "-safe", "0", "-i", "concat.txt",
        "-c:v", "libx264", "-c:a", "aac",
        "-crf", String(preset.crf),
        "master.mp4",
      ]);

      if (abortRef.current) return;

      let finalFile = "master.mp4";

      if (musicTrack?.url) {
        setStatus("Mixing background music...");
        setProgress(90);
        await ffmpeg.writeFile("bgm.mp3", await fetchFile(musicTrack.url));
        await ffmpeg.exec([
          "-i", "master.mp4", "-i", "bgm.mp3",
          "-filter_complex", `[1:a]volume=${musicTrack.volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]`,
          "-map", "0:v", "-map", "[aout]",
          "-c:v", "copy", "-c:a", "aac",
          "final.mp4",
        ]);
        finalFile = "final.mp4";
      }

      if (abortRef.current) return;

      setStatus("Preparing download...");
      setProgress(95);

      const data = await ffmpeg.readFile(finalFile);
      const blob = new Blob([(data as unknown as ArrayBuffer)], { type: "video/mp4" });

      // Revoke previous URL if any
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setDownloadUrl(url);
      setProgress(100);
      setStatus("Export complete!");
      setExportState("complete");

    } catch (err) {
      if (abortRef.current) return; // Don't set error if cancelled
      console.error("Export error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`Export failed: ${msg}`);
      setExportState("error");
      setErrorMessage(msg);
    } finally {
      // Always clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Terminate FFmpeg to free WASM memory
      try {
        ffmpegRef.current?.terminate();
      } catch { /* ok */ }
      ffmpegRef.current = null;
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
    a.download = `video_${timestamp}.mp4`;
    a.click();
  };

  const isExporting = exportState === "loading" || exportState === "exporting";
  const isComplete = exportState === "complete";
  const isError = exportState === "error";
  const isCancelled = exportState === "cancelled";
  const canStartExport = exportState === "idle" || isComplete || isError || isCancelled;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#14142a] rounded-2xl p-6 w-full max-w-md border border-white/[0.08] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-headline text-base font-bold text-white">Export Video</h2>
            <p className="text-[10px] text-outline/40 mt-0.5">Render and download your video</p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-outline/40 hover:text-white p-1 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.03] rounded-lg p-2 text-center">
            <span className="text-[9px] text-outline/40 block">Scenes</span>
            <span className="text-sm font-bold text-white">{visibleScenes.length}</span>
            {scenes.length !== visibleScenes.length && (
              <span className="text-[8px] text-outline/30 block">({scenes.length - visibleScenes.length} hidden)</span>
            )}
          </div>
          <div className="bg-white/[0.03] rounded-lg p-2 text-center">
            <span className="text-[9px] text-outline/40 block">Duration</span>
            <span className="text-sm font-bold text-white">{Math.floor(totalDuration / 60)}m {Math.floor(totalDuration % 60)}s</span>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-2 text-center">
            <span className="text-[9px] text-outline/40 block">Music</span>
            <span className="text-sm font-bold text-white">{musicTrack ? "Yes" : "None"}</span>
          </div>
        </div>

        {/* Quality selector — show when ready to export */}
        {canStartExport && (
          <div className="mb-4">
            <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-2">Export Quality</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(QUALITY_PRESETS) as [ExportQuality, typeof QUALITY_PRESETS.draft][]).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-center transition-all ${
                    quality === key
                      ? "bg-primary/15 border border-primary/30 text-primary"
                      : "bg-white/[0.03] border border-transparent text-outline/60 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{p.icon}</span>
                  <span className="text-[10px] font-bold">{p.label}</span>
                  <span className="text-[8px] opacity-60">{p.fps}fps</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-outline/40 mt-1.5">{preset.desc} · Estimated: {estimateTime()}</p>
          </div>
        )}

        {/* Progress — show during export or after */}
        {isExporting && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-outline/50">
                {currentScene > 0 && `Scene ${currentScene}/${visibleScenes.length}`}
              </span>
              <span className="text-[10px] text-outline/50 font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-primary to-tertiary"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-outline/50 truncate flex-1">{status}</p>
              <span className="text-[9px] text-outline/40 font-mono ml-2 whitespace-nowrap">
                {formatElapsed(elapsedTime)} {estimateRemaining() && `· ${estimateRemaining()}`}
              </span>
            </div>
          </div>
        )}

        {/* Complete state */}
        {isComplete && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="text-sm font-bold text-emerald-400">Export Complete!</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-outline/50">
              <span>Completed in {formatElapsed(elapsedTime)}</span>
              <span>{visibleScenes.length} scenes · {quality} quality</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-red-400">error</span>
              <span className="text-sm font-bold text-red-400">Export Failed</span>
            </div>
            <p className="text-[10px] text-outline/50">{errorMessage || "An unknown error occurred"}</p>
          </div>
        )}

        {/* Cancelled state */}
        {isCancelled && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400">cancel</span>
              <span className="text-sm font-bold text-yellow-400">Export Cancelled</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isComplete ? (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                Download MP4
              </button>
              <button
                onClick={resetForNewExport}
                className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Re-export
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5">
                Close
              </button>
            </>
          ) : isExporting ? (
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Cancel Export
            </button>
          ) : (
            <>
              <button
                onClick={handleExport}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white primary-gradient shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
                {isError || isCancelled ? "Retry Export" : "Start Export"}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
