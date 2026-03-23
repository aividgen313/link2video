"use client";
import { useState } from "react";
import { useEditorContext } from "@/context/EditorContext";
import { useAppContext } from "@/context/AppContext";
import { exportManager, type ExportQuality } from "@/lib/exportManager";

const QUALITY_PRESETS: Record<ExportQuality, { label: string; desc: string; fps: number; crf: number; icon: string }> = {
  draft: { label: "Draft", desc: "Fast export, lower quality", fps: 15, crf: 32, icon: "bolt" },
  standard: { label: "Standard", desc: "Good quality, balanced speed", fps: 25, crf: 23, icon: "tune" },
  high: { label: "High", desc: "Best quality, slower export", fps: 30, crf: 18, icon: "hd" },
};

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { scenes, musicTrack } = useEditorContext();
  const { videoDimension } = useAppContext();
  const [quality, setQuality] = useState<ExportQuality>("standard");

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

  const handleStartExport = () => {
    exportManager.startExport({
      scenes: visibleScenes,
      musicTrack,
      videoDimension,
      quality,
      preset,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14142a] rounded-2xl p-6 w-full max-w-md border border-white/[0.08] shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-headline text-base font-bold text-white">Export Video</h2>
            <p className="text-[10px] text-outline/40 mt-0.5">Start rendering in the background</p>
          </div>
          <button
            onClick={onClose}
            className="text-outline/40 hover:text-white p-1 rounded-lg hover:bg-white/5"
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

        {/* Quality selector */}
        <div className="mb-6">
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

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleStartExport}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white primary-gradient shadow-lg shadow-primary/20 hover:shadow-primary/30 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
            Start Background Export
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-outline/60 hover:text-white border border-white/[0.08] hover:bg-white/5">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
