"use client";
import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditorScene, useEditorContext } from "@/context/EditorContext";

const C = {
  accent: "var(--editor-accent)",
  accentDim: "var(--editor-hover)",
  border: "var(--editor-border)",
  selected: "var(--editor-accent)",
  multi: "var(--editor-warn)",
  warn: "var(--editor-warn)",
  success: "var(--editor-success)",
  textDim: "var(--editor-text-dim)",
};

interface Props {
  scene: EditorScene;
  width: number;
  trackHeight?: number; // dynamic height from timeline
}

function TimelineSceneInner({ scene, width, trackHeight }: Props) {
  const { selectedSceneId, setSelectedSceneId, setPlayheadPosition, getSceneStartTime, selectedSceneIds, toggleSceneSelection } = useEditorContext();
  const isSelected = selectedSceneId === scene.id;
  const isMultiSelected = selectedSceneIds.has(scene.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });

  // Use track height minus padding, or default to 56px
  const clipHeight = trackHeight ? Math.max(30, trackHeight - 6) : 56;

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

  const borderColor = isSelected ? C.selected : isMultiSelected ? C.multi : "transparent";

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: `2px solid ${borderColor}`,
        borderRadius: 6,
        background: "var(--editor-panel-alt)",
        height: clipHeight,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="flex-shrink-0 overflow-hidden cursor-pointer relative group"
    >
      {/* Colored top bar (clip color) */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-10" style={{ background: isSelected ? C.accent : C.success }} />

      {/* Image fill — object-position center to show middle of image */}
      {scene.imageUrl ? (
        <img
          src={scene.imageUrl}
          alt={`S${scene.orderIndex + 1}`}
          className="w-full h-full object-cover object-center"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--editor-surface-hover)" }}>
          <span className="material-symbols-outlined text-sm" style={{ color: C.textDim }}>image</span>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute inset-x-0 bottom-0 h-5 flex items-center justify-between px-1.5" style={{ background: "var(--editor-surface-overlay)" }}>
        <span className="text-[9px] font-bold text-white tabular-nums">{scene.orderIndex + 1}</span>
        <span className="text-[8px] text-white/70 font-mono tabular-nums">{Math.round(scene.duration * 10) / 10}s</span>
      </div>

      {/* Badges row */}
      <div className="absolute top-1 right-1 flex gap-0.5 z-10">
        {scene.filter !== "none" && (
          <div className="w-3 h-3 rounded-full flex items-center justify-center text-white text-[6px] font-bold" style={{ background: C.warn }} title={`Filter: ${scene.filter}`}>F</div>
        )}
        {scene.overlays.length > 0 && (
          <div className="w-3 h-3 rounded-full flex items-center justify-center text-white text-[6px] font-bold" style={{ background: C.accent }} title={`${scene.overlays.length} overlay(s)`}>T</div>
        )}
        {scene.marker && (
          <div className="w-3 h-3 rounded-full flex items-center justify-center text-white text-[6px] font-bold" style={{ background: C.success }} title={scene.marker}>M</div>
        )}
      </div>

      {/* Status icons */}
      <div className="absolute top-1 left-1 flex gap-0.5 z-10">
        {scene.isLocked && <span className="material-symbols-outlined text-[10px]" style={{ color: C.warn, fontVariationSettings: "'FILL' 1" }}>lock</span>}
        {scene.isMuted && <span className="material-symbols-outlined text-[10px]" style={{ color: "var(--editor-danger)" }}>volume_off</span>}
        {scene.playbackSpeed !== 1 && <span className="text-[7px] px-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: C.accent }}>{scene.playbackSpeed}x</span>}
      </div>

      {/* Transition indicator (left edge) */}
      {scene.transition !== "none" && scene.orderIndex > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(to bottom, ${C.accent}99, ${C.accent}66, ${C.accent}99)` }} title={`Transition: ${scene.transition}`} />
      )}

      {/* AI video indicator */}
      {scene.aiVideoUrl && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-white/80 text-lg drop-shadow-lg" style={{ fontVariationSettings: "'FILL' 1" }}>smart_display</span>
        </div>
      )}
    </div>
  );
}

export default memo(TimelineSceneInner);
