"use client";
import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditorScene, useEditorContext } from "@/context/EditorContext";

const C = {
  accent: "var(--editor-success)",
  accentDim: "var(--editor-audio-track)",
  border: "var(--editor-border)",
  selected: "var(--editor-success)",
  multi: "var(--editor-warn)",
  textDim: "var(--editor-text-dim)",
  bg: "var(--editor-track)",
};

interface Props {
  scene: EditorScene;
  width: number;
  trackHeight?: number;
}

function TimelineAudioSceneInner({ scene, width, trackHeight }: Props) {
  const { selectedSceneId, setSelectedSceneId, getSceneStartTime, selectedSceneIds, toggleSceneSelection, tracks, setPlayheadPosition, deleteScene } = useEditorContext();
  const isSelected = selectedSceneId === scene.id;
  const isMultiSelected = selectedSceneIds.has(scene.id);

  const track = tracks.find(t => t.id === scene.trackId);
  const isTrackLocked = track?.isLocked;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  const clipHeight = trackHeight ? Math.max(20, trackHeight - 6) : 30;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}px`,
    opacity: isDragging ? 0.4 : scene.isHidden ? 0.3 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleSceneSelection(scene.id);
    } else {
      setSelectedSceneId(scene.id);
      setPlayheadPosition(getSceneStartTime(scene.id));
    }
  };

  const borderColor = isSelected ? C.selected : isMultiSelected ? C.multi : C.border;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        background: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(0,0,0,0.2)",
        height: clipHeight,
        backdropFilter: "blur(8px)",
        boxShadow: isSelected ? `0 0 15px ${C.selected}30` : "none",
        zIndex: isSelected ? 30 : 10,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`flex-shrink-0 overflow-hidden cursor-pointer relative group transition-all duration-300 ${isSelected ? "scale-[1.01] -translate-y-0.5" : "hover:scale-[1.005] hover:-translate-y-0.5"}`}
    >
      {/* Base highlight */}
      <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, transparent, ${C.accentDim})` }} />

      {/* Decorative Waveform (CSS representation) */}
      <div className="absolute inset-0 flex items-center justify-around opacity-30 px-2 select-none overflow-hidden">
        {Array.from({ length: Math.min(Math.floor(width / 6), 50) }).map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full"
            style={{
              height: `${20 + Math.random() * 60}%`,
              background: C.accent,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center px-2 z-10 pointer-events-none">
        <span className="material-symbols-outlined text-[12px] mr-1.5 flex-shrink-0" style={{ color: C.accent }}>graphic_eq</span>
        <span className="flex-1 min-w-0 text-[10px] font-bold truncate drop-shadow-md" style={{ color: "var(--editor-text-dim)" }}>
          {scene.sourceFileName || `Audio ${scene.id}`}
        </span>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-0.5 right-1 flex gap-1 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm("Delete this audio clip?")) deleteScene(scene.id); }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md bg-black/40 hover:bg-red-500/40 text-white/60 hover:text-white transition-all shadow-sm"
          title="Delete Clip"
        >
          <span className="material-symbols-outlined text-[12px]">delete</span>
        </button>
        {scene.isLocked && <span className="material-symbols-outlined text-[10px]" style={{ color: "var(--editor-warn)", fontVariationSettings: "'FILL' 1" }}>lock</span>}
        {scene.isMuted && <span className="material-symbols-outlined text-[10px]" style={{ color: "var(--editor-danger)" }}>volume_off</span>}
        {scene.playbackSpeed !== 1 && <span className="text-[7px] px-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: C.accent }}>{scene.playbackSpeed}x</span>}
      </div>

      {/* Bottom info strip */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 opacity-50" style={{ background: `linear-gradient(to right, transparent, ${C.accentDim}, transparent)` }} />

      {/* Track Locked Overlay */}
      {isTrackLocked && (
        <div 
          className="absolute inset-0 z-30 flex items-center justify-center" 
          style={{ background: "rgba(0,0,0,0.1)", cursor: "not-allowed" }}
        >
          <div className="bg-black/30 rounded-full p-0.5 border border-white/10 backdrop-blur-sm shadow-lg">
            <span className="material-symbols-outlined text-white text-[12px]">lock</span>
          </div>
          {/* Subtle diagonal pattern */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, #000 8px, #000 9px)" }} />
        </div>
      )}
    </div>
  );
}

export default memo(TimelineAudioSceneInner);
