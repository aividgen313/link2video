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
    const videoScenes = visibleScenes.filter(s => s.trackId === "v1");
    const secondsPerScene = quality === "draft" ? 3 : quality === "standard" ? 6 : 10;
    const totalSec = videoScenes.length * secondsPerScene + 10;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `~${min}m ${sec}s` : `~${sec}s`;
  };

  const handleStartExport = () => {
    const videoScenes = visibleScenes.filter(s => s.trackId === "v1").sort((a, b) => a.orderIndex - b.orderIndex);
    const audioScenes = visibleScenes.filter(s => s.trackId === "a1");

    const muxedScenes = videoScenes.map(vScene => {
      const matchingAudio = audioScenes.find(a => a.orderIndex === vScene.orderIndex);
      return {
        ...vScene,
        audioUrl: matchingAudio ? matchingAudio.audioUrl : null,
        volume: matchingAudio && !matchingAudio.isMuted ? matchingAudio.volume : 0,
        isMuted: matchingAudio ? matchingAudio.isMuted : true
      };
    });

    exportManager.startExport({
      scenes: muxedScenes,
      musicTrack,
      videoDimension,
      quality,
      preset,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-elevated rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-headline text-base font-bold text-on-surface">Export Video</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Render in the background while you keep editing</p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Scenes", value: String(visibleScenes.length), sub: scenes.length !== visibleScenes.length ? `(${scenes.length - visibleScenes.length} hidden)` : undefined },
            { label: "Duration", value: `${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s` },
            { label: "Music", value: musicTrack ? "Yes" : "None" },
          ].map(stat => (
            <div key={stat.label} className="glass-subtle rounded-xl p-2.5 text-center">
              <span className="text-[10px] text-on-surface-variant block">{stat.label}</span>
              <span className="text-sm font-bold text-on-surface">{stat.value}</span>
              {stat.sub && <span className="text-[9px] text-on-surface-variant/60 block">{stat.sub}</span>}
            </div>
          ))}
        </div>

        {/* Quality selector */}
        <div className="mb-6">
          <label className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold block mb-2">Export Quality</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(QUALITY_PRESETS) as [ExportQuality, typeof QUALITY_PRESETS.draft][]).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setQuality(key)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-all press-scale ${
                  quality === key
                    ? "bg-primary/15 border border-primary/30 text-primary shadow-sm shadow-primary/10"
                    : "glass-subtle border border-transparent text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{p.icon}</span>
                <span className="text-[11px] font-bold">{p.label}</span>
                <span className="text-[9px] opacity-60">{p.fps}fps</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">{preset.desc} · Estimated: {estimateTime()}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleStartExport}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white primary-gradient shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:brightness-110 press-scale flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
            Start Export
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface glass-subtle hover:bg-surface-container-high transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
