"use client";
import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useEditorContext } from "@/context/EditorContext";
import { useAppContext } from "@/context/AppContext";
import type { TransitionType } from "@/context/EditorContext";

// Map editor transition names → FFmpeg xfade transition names
const XFADE_TYPE: Record<TransitionType, string> = {
  none: "none",
  fade: "fade",
  dissolve: "dissolve",
  "wipe-left": "wipeleft",
  "wipe-right": "wiperight",
  "zoom-in": "zoomin",
  "zoom-out": "fadeblack",
  "slide-left": "slideleft",
  "slide-right": "slideright",
};

type ExportQuality = "draft" | "standard" | "high";
type ExportFormat = "mp4" | "webm";

const QUALITY_PRESETS: Record<ExportQuality, { label: string; desc: string; fps: number; crf: number; icon: string }> = {
  draft: { label: "Draft", desc: "Fast export, lower quality", fps: 15, crf: 32, icon: "bolt" },
  standard: { label: "Standard", desc: "Good quality, balanced speed", fps: 25, crf: 23, icon: "tune" },
  high: { label: "High", desc: "Best quality, slower export", fps: 30, crf: 18, icon: "hd" },
};

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { scenes, musicTrack } = useEditorContext();
  const { videoDimension, captionsEnabled } = useAppContext();
  const [status, setStatus] = useState("Ready to export");
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<ExportQuality>("standard");
  const [format] = useState<ExportFormat>("mp4");
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleScenes = scenes.filter(s => !s.isHidden);
  const totalDuration = visibleScenes.reduce((s, sc) => s + sc.duration, 0);
  const preset = QUALITY_PRESETS[quality];

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

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setCurrentScene(0);
    setStatus("Loading FFmpeg...");
    const start = Date.now();
    setStartTime(start);

    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 500);

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
      });

      const totalScenes = visibleScenes.length;

      // Build overlay drawtext filter string for a scene
      const buildOverlayFilter = (scene: typeof visibleScenes[0]): string => {
        if (!scene.overlays?.length) return "";
        return scene.overlays.map((ov: import("@/context/EditorContext").TextOverlay) => {
          const safeText = (ov.text || "").replace(/'/g, "\\'").replace(/:/g, "\\:");
          const x = ov.position === "center" ? "(w-text_w)/2"
            : ov.position === "lower-third" ? "(w-text_w)/2"
            : ov.position === "top" ? "(w-text_w)/2"
            : `${Math.round((ov.x / 100) * (videoDimension?.width || 1280))}`;
          const y = ov.position === "center" ? "(h-text_h)/2"
            : ov.position === "lower-third" ? "h-text_h-60"
            : ov.position === "top" ? "30"
            : `${Math.round((ov.y / 100) * (videoDimension?.height || 720))}`;
          const color = (ov.color || "#ffffff").replace("#", "0x");
          const shadow = ov.shadowEnabled
            ? `:shadowcolor=${(ov.shadowColor || "#000000").replace("#", "0x")}:shadowx=${ov.shadowX || 2}:shadowy=${ov.shadowY || 2}`
            : "";
          return `drawtext=text='${safeText}':fontsize=${ov.fontSize || 48}:fontcolor=${color}:x=${x}:y=${y}:font='sans-serif'${shadow}`;
        }).join(",");
      };

      // ── Phase 1: Create per-scene video-only + audio-only files ──
      // Tracks which scene indices were actually processed (skip scenes with no media)
      const processed: number[] = [];

      for (let i = 0; i < totalScenes; i++) {
        const scene = visibleScenes[i];
        setCurrentScene(i + 1);
        setStatus(`Rendering scene ${i + 1}/${totalScenes}...`);
        setProgress(Math.round((i / totalScenes) * 65));

        const imgFile = `img${i}.jpg`;
        const vonlyFile = `vonly${i}.mp4`; // video stream only
        const aonlyFile = `aonly${i}.mp3`; // audio stream only

        // ── Video ──
        if (scene.aiVideoUrl) {
          await ffmpeg.writeFile(vonlyFile, await fetchFile(scene.aiVideoUrl));
          // Strip audio from AI video
          await ffmpeg.exec(["-i", vonlyFile, "-an", "-c:v", "copy", `vtmp${i}.mp4`]);
          await ffmpeg.writeFile(vonlyFile, await ffmpeg.readFile(`vtmp${i}.mp4`));
          // Apply overlays if any
          const ovf = buildOverlayFilter(scene);
          if (ovf) {
            await ffmpeg.exec(["-i", vonlyFile, "-vf", ovf, "-c:v", "libx264", `-crf`, String(preset.crf), `ovl${i}.mp4`]);
            await ffmpeg.writeFile(vonlyFile, await ffmpeg.readFile(`ovl${i}.mp4`));
          }
        } else if (scene.imageUrl) {
          const w = videoDimension?.width || 1280;
          const h = videoDimension?.height || 720;
          await ffmpeg.writeFile(imgFile, await fetchFile(scene.imageUrl));

          const kbFilter = (() => {
            const d = scene.duration * preset.fps;
            switch (scene.kenBurns) {
              case "zoom-out":  return `zoompan=z='max(1.3-0.0015*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
              case "pan-left":  return `zoompan=z='1.2':x='iw/2-(iw/zoom/2)+on*0.5':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
              case "pan-right": return `zoompan=z='1.2':x='iw/2-(iw/zoom/2)-on*0.5':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
              case "pan-up":    return `zoompan=z='1.2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+on*0.3':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
              case "pan-down":  return `zoompan=z='1.2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-on*0.3':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
              default:          return `zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${preset.fps}`;
            }
          })();

          const ovf = buildOverlayFilter(scene);
          const vf = ovf ? `scale=${w * 2}:${h * 2},${kbFilter},${ovf}` : `scale=${w * 2}:${h * 2},${kbFilter}`;

          await ffmpeg.exec([
            "-loop", "1", "-i", imgFile,
            "-vf", vf,
            "-c:v", "libx264", "-t", String(scene.duration),
            "-pix_fmt", "yuv420p", "-r", String(preset.fps),
            "-crf", String(preset.crf),
            vonlyFile,
          ]);
        } else {
          continue; // No media for this scene — skip
        }

        // ── Audio ──
        if (scene.audioUrl && !scene.isMuted) {
          await ffmpeg.writeFile(aonlyFile, await fetchFile(scene.audioUrl));
          // Normalize to standard format + apply volume
          await ffmpeg.exec([
            "-i", aonlyFile,
            "-af", `volume=${scene.volume}`,
            "-ar", "44100", "-ac", "2",
            `anorm${i}.mp3`,
          ]);
          await ffmpeg.writeFile(aonlyFile, await ffmpeg.readFile(`anorm${i}.mp3`));
        } else {
          // Generate silence matching scene duration
          await ffmpeg.exec([
            "-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo`,
            "-t", String(scene.duration),
            "-c:a", "libmp3lame", aonlyFile,
          ]);
        }

        processed.push(i);
      }

      if (processed.length === 0) {
        setStatus("No scenes to export");
        setIsExporting(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      // ── Phase 2: Chain scenes with xfade (video) + acrossfade (audio) ──
      setStatus("Applying transitions...");
      setProgress(70);

      let currentV = `vonly${processed[0]}.mp4`;
      let currentA = `aonly${processed[0]}.mp3`;
      let outputDuration = visibleScenes[processed[0]].duration;

      for (let pi = 1; pi < processed.length; pi++) {
        const idx = processed[pi];
        const scene = visibleScenes[idx];
        const td = scene.transition !== "none" ? (scene.transitionDuration || 0.5) : 0;
        const xfadeType = XFADE_TYPE[scene.transition as TransitionType] || "fade";

        const nextV = `vonly${idx}.mp4`;
        const nextA = `aonly${idx}.mp3`;
        const outV = `v_merge${pi}.mp4`;
        const outA = `a_merge${pi}.mp3`;

        if (td > 0 && scene.transition !== "none") {
          // xfade offset = how far into the current output the transition starts
          const xfadeOffset = Math.max(0, outputDuration - td);

          // Video crossfade
          await ffmpeg.exec([
            "-i", currentV, "-i", nextV,
            "-filter_complex",
            `[0:v][1:v]xfade=transition=${xfadeType}:duration=${td}:offset=${xfadeOffset.toFixed(3)}[v]`,
            "-map", "[v]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-r", String(preset.fps), "-crf", String(preset.crf),
            outV,
          ]);

          // Audio crossfade
          await ffmpeg.exec([
            "-i", currentA, "-i", nextA,
            "-filter_complex",
            `[0:a][1:a]acrossfade=d=${td}:c1=tri:c2=tri[a]`,
            "-map", "[a]", "-ar", "44100", "-ac", "2",
            outA,
          ]);

          outputDuration = outputDuration + scene.duration - td;
        } else {
          // Hard cut — concat demuxer for this pair
          const concatTxt = `concatpair${pi}.txt`;
          await ffmpeg.writeFile(concatTxt, new TextEncoder().encode(`file '${currentV}'\nfile '${nextV}'`));
          await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", concatTxt, "-c", "copy", outV]);

          const aconcatTxt = `aconcatpair${pi}.txt`;
          await ffmpeg.writeFile(aconcatTxt, new TextEncoder().encode(`file '${currentA}'\nfile '${nextA}'`));
          await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", aconcatTxt, "-c", "copy", outA]);

          outputDuration += scene.duration;
        }

        currentV = outV;
        currentA = outA;
        setProgress(70 + Math.round((pi / (processed.length - 1)) * 15));
      }

      // ── Phase 3: Merge final video + audio tracks ──
      setStatus("Finalizing video...");
      setProgress(85);

      await ffmpeg.exec([
        "-i", currentV, "-i", currentA,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "master.mp4",
      ]);

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

      setStatus("Preparing download...");
      setProgress(95);

      const data = await ffmpeg.readFile(finalFile);
      const blob = new Blob([(data as unknown as ArrayBuffer)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProgress(100);
      setStatus("Export complete! Downloading...");
      // Auto-trigger download
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
      a.download = `video_${timestamp}.mp4`;
      a.click();
      setStatus("Export complete!");
    } catch (err) {
      console.error("Export error:", err);
      setStatus(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
      if (timerRef.current) clearInterval(timerRef.current);
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#14142a] rounded-2xl p-6 w-full max-w-md border border-white/[0.08] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-headline text-base font-bold text-white">Export Video</h2>
            <p className="text-[10px] text-outline/40 mt-0.5">Render and download your video</p>
          </div>
          <button onClick={onClose} className="text-outline/40 hover:text-white p-1 rounded-lg hover:bg-white/5">
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

        {/* Quality selector */}
        {!isExporting && !downloadUrl && (
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

        {/* Progress */}
        {(isExporting || downloadUrl) && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-outline/50">
                {isExporting && currentScene > 0 && `Scene ${currentScene}/${visibleScenes.length}`}
              </span>
              <span className="text-[10px] text-outline/50 font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress >= 100
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                    : "bg-gradient-to-r from-primary to-tertiary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-outline/50 truncate flex-1">{status}</p>
              {isExporting && (
                <span className="text-[9px] text-outline/40 font-mono ml-2 whitespace-nowrap">
                  {formatElapsed(elapsedTime)} {estimateRemaining() && `· ${estimateRemaining()}`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {downloadUrl ? (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                Download MP4
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5">
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white primary-gradient shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
                    Start Export
                  </>
                )}
              </button>
              <button onClick={onClose} disabled={isExporting} className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5 disabled:opacity-30">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
