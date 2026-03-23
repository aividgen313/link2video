"use client";
import { useEffect, useState } from "react";
import { exportManager, type ExportProgressData } from "@/lib/exportManager";

export default function GlobalExportProgress() {
  const [data, setData] = useState<ExportProgressData>(exportManager.getState());

  useEffect(() => {
    const unsubscribe = exportManager.subscribe(setData);
    return () => { unsubscribe(); };
  }, []);

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
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
    a.download = `video_${timestamp}.mp4`;
    a.click();
  };

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const estimateRemaining = () => {
    if (data.progress <= 0 || data.elapsedTime <= 0) return "";
    const totalEstMs = (data.elapsedTime / data.progress) * 100;
    const remaining = Math.max(0, totalEstMs - data.elapsedTime);
    const sec = Math.floor(remaining / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 animate-fade-in-up">
      <div className="bg-[#14142a] rounded-2xl p-4 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-[18px] ${
                isComplete ? "text-emerald-400" : isError ? "text-red-400" : isCancelled ? "text-yellow-400" : "text-primary animate-pulse"
              }`}
              style={isComplete ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isComplete ? "check_circle" : isError ? "error" : isCancelled ? "cancel" : "movie"}
            </span>
            <h3 className="font-headline text-sm font-bold text-white">
              {isComplete ? "Export Ready" : isError ? "Export Failed" : isCancelled ? "Export Cancelled" : "Rendering Video..."}
            </h3>
          </div>
          <button
            onClick={close}
            disabled={isExporting}
            className="text-outline/40 hover:text-white p-1 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Progress Or Meta Details */}
        {isExporting && (
          <div className="mb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-outline/60">{data.status}</span>
              <span className="text-[10px] text-outline/60 font-mono">{data.progress}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-primary to-tertiary transition-all duration-300 rounded-full"
                style={{ width: `${data.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-outline/50 font-mono">
                {formatElapsed(data.elapsedTime)}
              </span>
              <span className="text-[9px] text-outline/50 font-mono">
                {estimateRemaining()}
              </span>
            </div>
          </div>
        )}

        {isError && (
          <p className="text-[10px] text-red-300/80 mb-2 truncate" title={data.errorMessage || ""}>
            {data.errorMessage || "Unknown error occurred"}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {isComplete ? (
            <button
              onClick={handleDownload}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Save to Device
            </button>
          ) : isExporting ? (
            <button
              onClick={cancel}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">stop_circle</span>
              Cancel Export
            </button>
          ) : (
            <button
              onClick={close}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-outline hover:text-white bg-white/[0.04] hover:bg-white/10"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
