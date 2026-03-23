"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { exportManager, type ExportProgressData } from "@/lib/exportManager";
import { pipelineManager, type PipelineProgressData } from "@/lib/pipelineManager";

// ─── Shared helpers ────────────────────────────────────────────

function formatElapsed(ms: number) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function estimateRemaining(progress: number, elapsedMs: number) {
  if (progress <= 0 || elapsedMs <= 0) return "";
  const totalEstMs = (elapsedMs / progress) * 100;
  const remaining = Math.max(0, totalEstMs - elapsedMs);
  const sec = Math.floor(remaining / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
}

// ─── Export Card (existing) ────────────────────────────────────

function ExportCard() {
  const [data, setData] = useState<ExportProgressData>(exportManager.getState());
  const autoDownloaded = useRef(false);

  useEffect(() => exportManager.subscribe(setData), []);

  useEffect(() => {
    if (data.state === "complete" && data.downloadUrl && !autoDownloaded.current) {
      autoDownloaded.current = true;
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      const ts = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
      a.download = `video_${ts}.mp4`;
      a.click();
    }
    if (data.state === "idle") autoDownloaded.current = false;
  }, [data.state, data.downloadUrl]);

  if (data.state === "idle") return null;

  const isComplete = data.state === "complete";
  const isError = data.state === "error";
  const isCancelled = data.state === "cancelled";
  const isExporting = data.state === "loading" || data.state === "exporting";

  const close = () => exportManager.reset();
  const cancel = () => exportManager.cancel();
  const handleDownload = () => {
    if (!data.downloadUrl) return;
    const a = document.createElement("a");
    a.href = data.downloadUrl;
    const ts = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
    a.download = `video_${ts}.mp4`;
    a.click();
  };

  return (
    <div className="glass-elevated rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-lg ${isComplete ? "text-green-400" : isError ? "text-error" : isCancelled ? "text-amber-400" : "text-primary animate-pulse"}`}
            style={isComplete || isError ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {isComplete ? "check_circle" : isError ? "error" : isCancelled ? "cancel" : "movie"}
          </span>
          <h3 className="font-headline text-sm font-bold text-on-surface">
            {isComplete ? "Export Complete" : isError ? "Export Failed" : isCancelled ? "Cancelled" : "Rendering..."}
          </h3>
        </div>
        <button onClick={close} disabled={isExporting} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {isExporting && (
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-on-surface-variant">{data.status}</span>
            <span className="text-[11px] text-on-surface font-mono tabular-nums">{data.progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-primary to-tertiary transition-all duration-300 rounded-full" style={{ width: `${data.progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant font-mono tabular-nums">{formatElapsed(data.elapsedTime)}</span>
            <span className="text-[10px] text-on-surface-variant font-mono tabular-nums">{estimateRemaining(data.progress, data.elapsedTime)}</span>
          </div>
        </div>
      )}

      {isComplete && <p className="text-[11px] text-green-400 mb-2">Video saved automatically to your downloads</p>}
      {isError && <p className="text-[11px] text-error/80 mb-2 truncate" title={data.errorMessage || ""}>{data.errorMessage || "Unknown error occurred"}</p>}

      <div className="mt-3 flex gap-2">
        {isComplete ? (
          <>
            <button onClick={handleDownload} className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 flex items-center justify-center gap-1.5 press-scale transition-all">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Download Again
            </button>
            <button onClick={close} className="px-3 py-1.5 rounded-xl text-xs text-on-surface-variant hover:text-on-surface glass-subtle hover:bg-surface-container-high transition-all">Done</button>
          </>
        ) : isExporting ? (
          <button onClick={cancel} className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-error bg-error/10 hover:bg-error/20 border border-error/20 flex items-center justify-center gap-1.5 press-scale transition-all">
            <span className="material-symbols-outlined text-sm">stop_circle</span>
            Cancel
          </button>
        ) : (
          <button onClick={close} className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface glass-subtle hover:bg-surface-container-high transition-all">Dismiss</button>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Card (new — background video generation) ─────────

function PipelineCard() {
  const router = useRouter();
  const [data, setData] = useState<PipelineProgressData>(pipelineManager.getState());
  const autoAdvanced = useRef(false);

  useEffect(() => pipelineManager.subscribe(setData), []);

  // Auto-advance to editor when pipeline completes
  useEffect(() => {
    if (data.phase === "complete" && !autoAdvanced.current) {
      autoAdvanced.current = true;
      // Small delay so user sees the "complete" state
      setTimeout(() => router.push("/editor"), 1500);
    }
    if (data.phase === "idle") autoAdvanced.current = false;
  }, [data.phase, router]);

  if (data.phase === "idle") return null;

  const isComplete = data.phase === "complete";
  const isError = data.phase === "error";
  const isCancelled = data.phase === "cancelled";
  const isRunning = !isComplete && !isError && !isCancelled;

  const close = () => pipelineManager.reset();
  const cancel = () => pipelineManager.cancel();

  const phaseLabel = () => {
    switch (data.phase) {
      case "images_audio": return "Generating images & audio...";
      case "video": return "Creating AI video clips...";
      case "stitch": return "Stitching final video...";
      case "upload": return "Uploading to cloud...";
      case "complete": return "Video ready!";
      case "error": return "Generation failed";
      case "cancelled": return "Generation cancelled";
      default: return data.status;
    }
  };

  return (
    <div className="glass-elevated rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`material-symbols-outlined text-lg ${isComplete ? "text-green-400" : isError ? "text-error" : isCancelled ? "text-amber-400" : "text-primary animate-pulse"}`}
            style={isComplete || isError ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {isComplete ? "check_circle" : isError ? "error" : isCancelled ? "cancel" : "auto_fix_high"}
          </span>
          <h3 className="font-headline text-sm font-bold text-on-surface">
            {isComplete ? "Video Ready" : isError ? "Generation Failed" : isCancelled ? "Cancelled" : "Generating Video..."}
          </h3>
        </div>
        <button onClick={close} disabled={isRunning} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {isRunning && (
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-on-surface-variant">{data.status || phaseLabel()}</span>
            <span className="text-[11px] text-on-surface font-mono tabular-nums">{data.progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-primary to-tertiary transition-all duration-300 rounded-full" style={{ width: `${data.progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant font-mono tabular-nums">{formatElapsed(data.elapsedTime)}</span>
            <span className="text-[10px] text-on-surface-variant font-mono tabular-nums">{estimateRemaining(data.progress, data.elapsedTime)}</span>
          </div>
          {data.totalScenes > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              {Array.from({ length: data.totalScenes }).map((_, i) => {
                const sceneId = Object.keys(data.sceneStatuses)[i];
                const s = sceneId ? data.sceneStatuses[Number(sceneId)] : undefined;
                const done = s?.done;
                const hasError = s?.error;
                return (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${done ? (hasError ? "bg-error/60" : "bg-green-400") : "bg-surface-container-high"}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {isComplete && <p className="text-[11px] text-green-400 mb-2">Opening editor automatically...</p>}
      {isError && <p className="text-[11px] text-error/80 mb-2 truncate" title={data.error || ""}>{data.error || "Unknown error"}</p>}

      <div className="mt-3 flex gap-2">
        {isComplete ? (
          <>
            <button
              onClick={() => router.push("/editor")}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 flex items-center justify-center gap-1.5 press-scale transition-all"
            >
              <span className="material-symbols-outlined text-sm">movie_edit</span>
              Open Editor
            </button>
            <button onClick={close} className="px-3 py-1.5 rounded-xl text-xs text-on-surface-variant hover:text-on-surface glass-subtle hover:bg-surface-container-high transition-all">Done</button>
          </>
        ) : isRunning ? (
          <button onClick={cancel} className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-error bg-error/10 hover:bg-error/20 border border-error/20 flex items-center justify-center gap-1.5 press-scale transition-all">
            <span className="material-symbols-outlined text-sm">stop_circle</span>
            Cancel
          </button>
        ) : (
          <button onClick={close} className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface glass-subtle hover:bg-surface-container-high transition-all">Dismiss</button>
        )}
      </div>
    </div>
  );
}

// ─── Combined component ────────────────────────────────────────

export default function GlobalExportProgress() {
  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 flex flex-col gap-3 animate-fade-in-up">
      <PipelineCard />
      <ExportCard />
    </div>
  );
}
