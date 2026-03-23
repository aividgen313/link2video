"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditorScene, useEditorContext } from "@/context/EditorContext";

const C = {
  accent: "#10b981", // Emerald audio theme
  accentDim: "rgba(16, 185, 129, 0.2)",
  border: "rgba(16, 185, 129, 0.4)",
  selected: "#34d399",
  multi: "#f0b040",
  textDim: "#9a9aa0",
  bg: "#16201b", // darker green tint
};

interface Props {
  scene: EditorScene;
  width: number;
  trackHeight?: number;
}

export default function TimelineAudioScene({ scene, width, trackHeight }: Props) {
  const { selectedSceneId, setSelectedSceneId, setPlayheadPosition, getSceneStartTime, selectedSceneIds, toggleSceneSelection } = useEditorContext();
  const isSelected = selectedSceneId === scene.id;
  const isMultiSelected = selectedSceneIds.has(scene.id);

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
        borderRadius: 6,
        background: C.bg,
        height: clipHeight,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`flex-shrink-0 overflow-hidden cursor-pointer relative group transition-colors ${isSelected ? "shadow-[0_0_12px_rgba(16,185,129,0.3)]" : ""}`}
    >
      {/* Base highlight */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[rgba(16,185,129,0.05)]" />

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
        <span className="material-symbols-outlined text-[12px] mr-1.5" style={{ color: C.accent }}>graphic_eq</span>
        <span className="text-[9px] font-medium truncate drop-shadow-md" style={{ color: "#d1d5db" }}>
          {scene.sourceFileName || `Audio ${scene.id}`}
        </span>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-0.5 right-1 flex gap-0.5 z-20">
        {scene.isLocked && <span className="material-symbols-outlined text-[10px]" style={{ color: "#f0b040", fontVariationSettings: "'FILL' 1" }}>lock</span>}
        {scene.isMuted && <span className="material-symbols-outlined text-[10px]" style={{ color: "#e5534b" }}>volume_off</span>}
        {scene.playbackSpeed !== 1 && <span className="text-[7px] px-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: C.accent }}>{scene.playbackSpeed}x</span>}
      </div>

      {/* Bottom info strip */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 opacity-50" style={{ background: `linear-gradient(to right, transparent, ${C.accentDim}, transparent)` }} />
    </div>
  );
}
