"use client";
import { memo, useState, useCallback, useRef } from "react";
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
  trackHeight?: number;
  zoom?: number;
}

function TimelineSceneInner({ scene, width, trackHeight, zoom = 40 }: Props) {
  const { 
    selectedSceneId, setSelectedSceneId, setPlayheadPosition, getSceneStartTime, 
    selectedSceneIds, toggleSceneSelection, updateScene, scenes, orientation, deleteScene
  } = useEditorContext();
  const isSelected = selectedSceneId === scene.id;
  const isMultiSelected = selectedSceneIds.has(scene.id);
  const [trimSide, setTrimSide] = useState<"left" | "right" | null>(null);
  const trimRef = useRef<{ startX: number; startDuration: number; prevId: number | null; prevDuration: number } | null>(null);
  const trimCleanupRef = useRef<(() => void) | null>(null);

  // Disable DnD while trimming to prevent conflicts
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
    disabled: trimSide !== null,
  });

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

  // ── Trim handle drag ──
  const handleTrimStart = useCallback((e: React.MouseEvent, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    // Clean up any previous trim operation
    trimCleanupRef.current?.();
    setTrimSide(side);

    // Find the previous clip on the same track for rolling edit (left-edge drag)
    const trackScenes = scenes
      .filter(s => s.trackId === scene.trackId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const myIndex = trackScenes.findIndex(s => s.id === scene.id);
    const prevScene = myIndex > 0 ? trackScenes[myIndex - 1] : null;

    trimRef.current = {
      startX: e.clientX,
      startDuration: scene.duration,
      prevId: prevScene?.id ?? null,
      prevDuration: prevScene?.duration ?? 0,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!trimRef.current) return;
      const deltaX = ev.clientX - trimRef.current.startX;
      const deltaSec = deltaX / zoom;

      if (side === "right") {
        // Right-edge trim: only affects this clip
        const newDuration = Math.max(1, trimRef.current.startDuration + deltaSec);
        updateScene(scene.id, { duration: Math.round(newDuration * 10) / 10 });
      } else {
        // Left-edge trim: rolling edit — expand this clip, shrink previous clip
        const newDuration = Math.max(1, trimRef.current.startDuration - deltaSec);
        const rounded = Math.round(newDuration * 10) / 10;
        updateScene(scene.id, { duration: rounded });

        if (trimRef.current.prevId !== null) {
          const prevNewDuration = Math.max(1, trimRef.current.prevDuration + deltaSec);
          updateScene(trimRef.current.prevId, { duration: Math.round(prevNewDuration * 10) / 10 });
        }
      }
    };

    const handleUp = () => {
      trimRef.current = null;
      setTrimSide(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      trimCleanupRef.current = null;
    };

    trimCleanupRef.current = handleUp;
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [scene.id, scene.duration, scene.trackId, zoom, updateScene, scenes]);

  const isVideo = !!scene.aiVideoUrl;
  const assetColor = isVideo ? "#8b5cf6" : "#0ea5e9"; // Purple for video, Blue for image
  const borderColor = isSelected ? C.selected : isMultiSelected ? C.multi : assetColor;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: `2px solid ${borderColor}`,
        borderLeftWidth: isSelected ? 4 : 2,
        borderRadius: 10,
        background: isSelected ? "rgba(16, 185, 129, 0.1)" : "rgba(0,0,0,0.2)",
        height: clipHeight,
        backdropFilter: "blur(6px)",
        boxShadow: isSelected ? `0 0 15px ${C.selected}30` : "none",
        zIndex: isSelected ? 30 : 10,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`flex-shrink-0 overflow-hidden cursor-pointer relative group transition-all duration-300 ${isSelected ? "scale-[1.01]" : "hover:scale-[1.005]"}`}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 z-20 cursor-col-resize opacity-0 group-hover:opacity-100 transition-all duration-300 hover:w-3"
        style={{ background: trimSide === "left" ? C.accent : `linear-gradient(to right, ${C.accent}40, transparent)` }}
        onMouseDown={(e) => handleTrimStart(e, "left")}
      />
      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 z-20 cursor-col-resize opacity-0 group-hover:opacity-100 transition-all duration-300 hover:w-3"
        style={{ background: trimSide === "right" ? C.accent : `linear-gradient(to left, ${C.accent}40, transparent)` }}
        onMouseDown={(e) => handleTrimStart(e, "right")}
      />
      {/* Colored top bar (clip color) */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-10" style={{ background: isSelected ? C.accent : assetColor, opacity: 0.9 }} />

      {/* Thumbnail: fixed square at left, rest is colored clip body */}
      <div className="absolute inset-0 flex">
        {scene.imageUrl ? (
          <>
            {/* Square thumbnail at the left edge */}
            <div
              className="flex-shrink-0 overflow-hidden border-r border-white/10"
              style={{ 
                width: orientation === "16:9" ? clipHeight : clipHeight * (9/16), 
                height: clipHeight 
              }}
            >
              <img
                src={scene.imageUrl || undefined}
                alt={`S${scene.orderIndex + 1}`}
                className="w-full h-full object-cover object-center"
                draggable={false}
              />
            </div>
            {/* Repeating thumbnail strip for longer clips */}
            <div
              className="flex-1 overflow-hidden"
              style={{
                backgroundImage: `url(${scene.imageUrl})`,
                backgroundSize: `${clipHeight}px ${clipHeight}px`,
                backgroundRepeat: "repeat-x",
                backgroundPosition: "left center",
                opacity: 0.25,
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--editor-surface-hover)" }}>
            <span className="material-symbols-outlined text-sm" style={{ color: C.textDim }}>image</span>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute inset-x-0 bottom-0 h-5 flex items-center justify-between px-1.5" style={{ background: "var(--editor-surface-overlay)" }}>
        <span className="text-[10px] font-bold text-white tabular-nums">{scene.orderIndex + 1}</span>
        {width >= 80 && (
          <span className="text-[9px] text-white/70 font-mono tabular-nums">{Math.round(scene.duration * 10) / 10}s</span>
        )}
      </div>

      {/* Badges row */}
      <div className="absolute top-1 right-1 flex items-start gap-1 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm("Delete this clip?")) deleteScene(scene.id); }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md bg-black/40 hover:bg-red-500/40 text-white/60 hover:text-white transition-all shadow-sm"
          title="Delete Clip"
        >
          <span className="material-symbols-outlined text-[12px]">delete</span>
        </button>
        <div className="flex flex-col gap-0.5">
          {scene.filter !== "none" && (
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold" style={{ background: C.warn }} title={`Filter: ${scene.filter}`}>F</div>
          )}
          {scene.overlays.length > 0 && (
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold" style={{ background: C.accent }} title={`${scene.overlays.length} overlay(s)`}>T</div>
          )}
          {scene.marker && (
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold" style={{ background: C.success }} title={scene.marker}>M</div>
          )}
        </div>
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
