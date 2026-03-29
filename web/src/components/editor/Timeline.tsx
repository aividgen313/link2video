"use client";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useEditorContext, TrackType, EditorScene } from "@/context/EditorContext";
import TimelineScene from "./TimelineScene";
import TimelineAudioScene from "./TimelineAudioScene";

// Theme-aware colors via CSS variables (set in globals.css, auto-switch with .dark)
const C = {
  bg: "var(--editor-bg)",
  ruler: "var(--editor-panel-alt)",
  trackBg: "var(--editor-panel)",
  trackAlt: "var(--editor-panel-alt)",
  border: "var(--editor-border)",
  accent: "var(--editor-accent)",
  accentDim: "var(--editor-hover)",
  textDim: "var(--editor-text-dim)",
  textMuted: "var(--editor-text-dim)",
  playhead: "var(--editor-playhead)",
  audioTrack: "var(--editor-track)",
  videoTrack: "var(--editor-track)",
};

function DroppableTrack({ id, children, className, style }: { id: string, children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      data-track-id={id}
      className={className} 
      style={{ 
        ...style, 
        backgroundColor: isOver ? "rgba(255, 255, 255, 0.05)" : style?.backgroundColor 
      }}
    >
      {children}
    </div>
  );
}

interface TimelineProps {
  height: number;
  onHeightChange: (h: number) => void;
}

export default function Timeline({ height, onHeightChange }: TimelineProps) {
  const {
    scenes, tracks, zoom, setZoom, reorderScene, totalDuration,
    playheadPosition, setPlayheadPosition, playheadRef,
    setSelectedSceneId, selectedSceneId, snapEnabled,
    addTrack, removeTrack, updateTrack, getTrackScenes,
    musicTrack, setMusicTrack, importMedia,
    isPlaying, deleteScene, splitScene, duplicateScene, getSceneStartTime,
  } = useEditorContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTargetTrack, setImportTargetTrack] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sceneId: number } | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Resize handle
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: height };
    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - ev.clientY; // dragging up = bigger
      const newH = Math.max(120, Math.min(500, resizeRef.current.startHeight + delta));
      onHeightChange(newH);
    };
    const handleUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [height, onHeightChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const v1Scenes = useMemo(() => scenes.filter(s => s.trackId === "v1"), [scenes]);

  // Compute track heights dynamically based on available space
  const videoTracks = tracks.filter(t => t.type === "video");
  const audioTracks = tracks.filter(t => t.type === "audio");

  const availableTrackHeight = height - 24 - 34 - 6;
  const collapsedCount = [...videoTracks, ...audioTracks].filter(t => t.isCollapsed).length;
  const expandedCount = videoTracks.length + audioTracks.length - collapsedCount;
  const addButtonsHeight = 40;
  const collapsedHeight = collapsedCount * 20;
  const expandableHeight = Math.max(40, availableTrackHeight - collapsedHeight - addButtonsHeight);
  const perTrackHeight = expandedCount > 0 ? Math.max(40, Math.floor(expandableHeight / expandedCount)) : 60;

  const sceneWidths = useMemo(() => v1Scenes.map(s => s.duration * zoom), [v1Scenes, zoom]);
  const totalWidth = Math.max(v1Scenes.reduce((sum, s) => sum + s.duration, 0) * zoom, 400);

  // Time ruler marks
  const timeMarks = useMemo(() => {
    const marks: { time: number; x: number; major: boolean }[] = [];
    const interval = zoom >= 60 ? 2 : zoom >= 30 ? 5 : 10;
    for (let t = 0; t <= totalDuration + interval; t += interval) {
      const x = t * zoom;
      marks.push({ time: t, x, major: t % (interval * 2) === 0 });
    }
    return marks;
  }, [zoom, totalDuration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const calcDropIndex = useCallback((x: number, trackId: string) => {
    const trackScenes = scenes.filter(s => s.trackId === trackId);
    let cumulativeTime = 0;
    const dropTime = x / zoom;
    
    for (let i = 0; i < trackScenes.length; i++) {
      const s = trackScenes[i];
      if (dropTime < cumulativeTime + s.duration / 2) {
        return scenes.indexOf(s);
      }
      cumulativeTime += s.duration;
      if (dropTime < cumulativeTime) {
        return scenes.indexOf(s) + 1;
      }
    }
    return scenes.length;
  }, [scenes, zoom]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over, activatorEvent } = event;
    if (!over) return;
    
    const sceneId = active.id as number;
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    const track = tracks.find(t => t.id === scene.trackId);
    if (track?.isLocked || scene.isLocked) return;

    const fromIndex = scenes.findIndex(s => s.id === sceneId);

    // 1. dropped over another scene (Sortable handled mostly, but we can refine here)
    if (over.data.current?.type === 'Sortable') {
      const toIndex = scenes.findIndex(s => s.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        const overScene = scenes[toIndex];
        reorderScene(fromIndex, toIndex, overScene.trackId);
        return;
      }
    }

    // 2. dropped over a track lane directly
    const overTrackId = over.id as string;
    const overTrack = tracks.find(t => t.id === overTrackId);
    if (overTrack) {
      // Calculate drop index based on mouse X
      const mouseEvent = activatorEvent as MouseEvent;
      const scrollLeft = scrollRef.current?.scrollLeft || 0;
      const rect = rulerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (event as any).delta.x + (active.rect.current.translated?.left || 0) - rect.left + scrollLeft;
        // Simpler: just use the offset from the start of the timeline
        const toIndex = calcDropIndex(x, overTrackId);
        reorderScene(fromIndex, toIndex, overTrackId);
      } else {
        reorderScene(fromIndex, scenes.length, overTrackId);
      }
    }
  };

  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);
  // Track active listener cleanup to prevent stacking
  const playheadCleanupRef = useRef<(() => void) | null>(null);

  const calcTimeFromX = useCallback((clientX: number) => {
    const ruler = rulerRef.current;
    if (!ruler) return 0;
    const rect = ruler.getBoundingClientRect();
    // Use horizontal scroll position from ref to ensure zero drift
    const scrollX = scrollRef.current?.scrollLeft || 0;
    const x = clientX - rect.left + scrollX;
    let time = x / zoom;
    if (snapEnabled) time = Math.round(time * 4) / 4;
    return Math.max(0, Math.min(time, totalDuration));
  }, [zoom, snapEnabled, totalDuration]);

  // Throttled playhead update using RAF to avoid excessive re-renders during scrub
  const rafRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<number | null>(null);
  const flushPlayhead = useCallback(() => {
    if (pendingTimeRef.current !== null) {
      setPlayheadPosition(pendingTimeRef.current);
      pendingTimeRef.current = null;
    }
    rafRef.current = null;
  }, [setPlayheadPosition]);

  const throttledSetPlayhead = useCallback((time: number) => {
    pendingTimeRef.current = time;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flushPlayhead);
    }
  }, [flushPlayhead]);

  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    playheadCleanupRef.current?.();
    isDraggingPlayhead.current = true;
    
    // Use offsetX for the most accurate element-relative position at the moment of click
    const initialX = e.nativeEvent.offsetX;
    let initialTime = initialX / zoom;
    if (snapEnabled) initialTime = Math.round(initialTime * 4) / 4;
    const clampedInitialTime = Math.max(0, Math.min(initialTime, totalDuration));
    setPlayheadPosition(clampedInitialTime);

    const ruler = rulerRef.current;
    if (!ruler) return;
    const rect = ruler.getBoundingClientRect();

    const handleMove = (ev: MouseEvent) => {
      if (!isDraggingPlayhead.current) return;
      // During move, we must use viewport coordinates relative to fixed rect
      const x = ev.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      let time = x / zoom;
      if (snapEnabled) time = Math.round(time * 4) / 4;
      setPlayheadPosition(Math.max(0, Math.min(time, totalDuration)));
    };
    const handleUp = () => {
      isDraggingPlayhead.current = false;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      playheadCleanupRef.current = null;
    };
    playheadCleanupRef.current = handleUp;
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [zoom, snapEnabled, totalDuration, setPlayheadPosition]);

  const playheadX = playheadPosition * zoom;

  // ── Scroll-wheel zoom on timeline ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl+scroll or pinch = zoom, plain scroll = horizontal scroll
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      const newZoom = Math.max(5, Math.min(150, zoom + delta));

      // Zoom toward mouse position
      if (scrollRef.current) {
        const container = scrollRef.current;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left; // mouse position relative to viewport
        const scrollLeft = container.scrollLeft;
        const timeAtMouse = (scrollLeft + mouseX) / zoom;

        setZoom(newZoom);

        // After zoom, adjust scroll so the time under the mouse stays put
        requestAnimationFrame(() => {
          container.scrollLeft = timeAtMouse * newZoom - mouseX;
        });
      } else {
        setZoom(newZoom);
      }
    }
    // Without ctrl: let native horizontal scroll work
  }, [zoom, setZoom]);

  // ── Auto-scroll timeline to keep playhead visible during playback ──
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const container = scrollRef.current;
    const viewWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const margin = viewWidth * 0.15;

    if (playheadX > scrollLeft + viewWidth - margin) {
      container.scrollLeft = playheadX - margin;
    }
    if (playheadX < scrollLeft) {
      container.scrollLeft = Math.max(0, playheadX - margin);
    }
  }, [isPlaying, playheadX]);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // Context menu handler for timeline scenes
  const handleSceneContextMenu = (e: React.MouseEvent, sceneId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sceneId });
  };

  // Detect which track element is at a given Y position
  const detectTrackAtPoint = useCallback((x: number, y: number): string | null => {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      const droppableEl = el.closest('[data-track-id]');
      if (droppableEl) {
        return droppableEl.getAttribute('data-track-id');
      }
    }
    return null;
  }, []);

  // File drop handler
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const rect = rulerRef.current?.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const dropX = rect ? (e.clientX - rect.left + scrollLeft) : 0;

    // Detect which track was dropped on from Y position
    const detectedTrack = detectTrackAtPoint(e.clientX, e.clientY);

    // Internal asset drop
    const internalDataStr = e.dataTransfer.getData("application/json");
    if (internalDataStr) {
      try {
        const data = JSON.parse(internalDataStr);
        if (data.type === "scene" && data.sceneId) {
          if ((window as any)._duplicateScene) {
            (window as any)._duplicateScene(data.sceneId);
          }
        } else if (data.url && data.type) {
           // Use detected track from Y position, fallback to type-based default
           const targetTrack = detectedTrack || (data.type === "audio" ? "a1" : "v1");
           const targetIndex = calcDropIndex(dropX, targetTrack);
           if ((window as any)._insertAssetAsScene) {
             (window as any)._insertAssetAsScene(data.url, data.type, targetTrack, targetIndex);
           }
        }
      } catch (err) {}
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        // Use detected track from Y position, fallback to type-based default
        const defaultTrack = file.type.startsWith("audio/") ? "a1" : "v1";
        const targetTrack = detectedTrack || defaultTrack;
        const targetIndex = calcDropIndex(dropX, targetTrack);
        await importMedia(file, targetTrack, targetIndex);
      }
    }
  };

  const handleImportClick = (trackId: string) => {
    setImportTargetTrack(trackId);
    fileInputRef.current?.click();
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await importMedia(file, importTargetTrack || undefined);
    }
    e.target.value = "";
    setImportTargetTrack(null);
  };

  return (
    <div
      className="flex flex-col select-none relative"
      style={{ background: C.bg, height }}
    >
      {/* ── Resize handle (top edge) ── */}
      <div
        className="absolute top-0 left-0 right-0 h-[6px] cursor-ns-resize z-30 group flex items-center justify-center transition-all bg-transparent hover:bg-primary/20 active:bg-primary/40"
        onMouseDown={handleResizeStart}
      >
        <div className="w-12 h-[3px] rounded-full transition-all group-hover:w-20 group-hover:h-[4px] shadow-sm" style={{ background: "rgba(255,255,255,0.2)" }} />
      </div>

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: C.accentDim, border: `2px dashed ${C.accent}`, borderRadius: 8 }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: "var(--editor-surface-overlay)", color: C.accent }}>
            <span className="material-symbols-outlined text-lg">upload_file</span>
            <span className="text-sm font-medium">Drop media here</span>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleFileInput} className="hidden" />

      {/* Combined track header + scrollable area */}
      <div
        className="flex relative flex-1 min-h-0 mt-[6px]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
      >
        {/* Track labels (fixed left) */}
        <div className="flex-shrink-0 flex flex-col shadow-[8px_0_16px_rgba(0,0,0,0.3)] relative" style={{ width: 120, background: C.trackAlt, borderRight: `1px solid ${C.border}`, zIndex: 50 }}>
          {/* Ruler label */}
          <div className="flex items-center justify-center" style={{ height: 28, borderBottom: `1px solid ${C.border}`, background: C.ruler }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">Timeline</span>
          </div>

          {/* Video tracks */}
          {videoTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-3 group transition-all"
              style={{ height: track.isCollapsed ? 20 : perTrackHeight, borderBottom: `1px solid ${C.border}`, background: C.videoTrack }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isCollapsed ? "chevron_right" : "expand_more"}</span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90 leading-none">{track.label}</span>
                  {!track.isCollapsed && <span className="text-[8px] text-white/20 font-bold uppercase tracking-tighter">Video Layer</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: track.isMuted ? "var(--editor-danger)" : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isMuted ? "visibility_off" : "visibility"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: track.isLocked ? "var(--editor-warn)" : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete track ${track.label} and all its clips?`)) {
                        removeTrack(track.id);
                      }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-red-500/20 transition-colors ml-auto mr-1"
                    style={{ color: "var(--editor-danger)" }}
                    title="Delete Track"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
              </div>
            </div>
          ))}

          {/* Add video track button */}
          <button
            onClick={() => addTrack("video")}
            className="flex items-center justify-center gap-1.5 w-full py-2 hover:bg-primary/10 transition-all border-b border-white/5 opacity-40 hover:opacity-100"
            style={{ color: C.textMuted }}
          >
            <span className="material-symbols-outlined text-[14px]">add_box</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Add Video Track</span>
          </button>

          {/* Audio tracks */}
          {audioTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-3 group transition-all"
              style={{ height: track.isCollapsed ? 20 : perTrackHeight, borderBottom: `1px solid ${C.border}`, background: C.audioTrack }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isCollapsed ? "chevron_right" : "expand_more"}</span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981] leading-none">{track.label}</span>
                  {!track.isCollapsed && <span className="text-[8px] text-white/20 font-bold uppercase tracking-tighter">Audio Layer</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: track.isMuted ? "var(--editor-danger)" : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isMuted ? "volume_off" : "volume_up"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  style={{ color: track.isLocked ? "var(--editor-warn)" : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[14px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete track ${track.label} and all its clips?`)) {
                        removeTrack(track.id);
                      }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-red-500/20 transition-colors ml-auto mr-1"
                    style={{ color: "var(--editor-danger)" }}
                    title="Delete Track"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
              </div>
            </div>
          ))}

          {/* Add audio track button */}
          <button
            onClick={() => addTrack("audio")}
            className="flex items-center justify-center gap-1.5 w-full py-2 hover:bg-primary/10 transition-all border-b border-white/5 opacity-40 hover:opacity-100"
            style={{ color: C.textMuted }}
          >
            <span className="material-symbols-outlined text-[14px]">library_music</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Add Audio Track</span>
          </button>
        </div>

        {/* Scrollable tracks */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden" ref={scrollRef} onWheel={handleWheel} style={{ scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent` }}>
          <div style={{ minWidth: totalWidth + 100, position: "relative" }}>
            {/* Time ruler */}
            <div
              ref={rulerRef}
              className="relative cursor-pointer group/ruler"
              style={{ height: 28, background: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${C.border}` }}
              onMouseDown={handleRulerMouseDown}
            >
              {timeMarks.map(m => (
                <div key={m.time} className="absolute top-0 h-full pointer-events-none" style={{ left: m.x }}>
                  <div className="flex flex-col items-center -translate-x-1/2 h-full">
                    {m.major && (
                      <span className="font-mono mt-0.5 text-[8px] font-black tracking-tight text-white/40 whitespace-nowrap">
                        {formatTime(m.time)}
                      </span>
                    )}
                    <div className={`w-px mt-auto ${m.major ? 'h-3 opacity-60' : 'h-1.5 opacity-30'}`} style={{ background: m.major ? "var(--editor-accent)" : "white" }} />
                  </div>
                </div>
              ))}
              {/* Scrub indicator line */}
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary/20 opacity-0 group-hover/ruler:opacity-100 pointer-events-none transition-opacity shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
            </div>

            {/* Playhead line (Optimized: Updates via Ref to avoid Timeline re-renders) */}
            <Playhead zoom={zoom} playheadRef={playheadRef} totalDuration={totalDuration} setPlayheadPosition={setPlayheadPosition} calcTimeFromX={calcTimeFromX} />

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
              {/* Video track lanes */}
              {videoTracks.map((track) => {
                const trackScenes = getTrackScenes(track.id);
                const trackH = track.isCollapsed ? 20 : perTrackHeight;
                return (
                  <DroppableTrack
                    id={track.id}
                    key={track.id}
                    className="relative"
                    style={{
                      height: trackH,
                      borderBottom: `1px solid ${C.border}`,
                      background: track.isMuted ? "var(--editor-surface-hover)" : C.videoTrack,
                      opacity: track.isMuted ? 0.5 : 1,
                    }}
                  >
                    {!track.isCollapsed && (
                      <SortableContext items={trackScenes.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                        <div className="relative h-full">
                          {trackScenes.map(scene => {
                            const w = Math.max(scene.duration * zoom, 2);
                            const start = getSceneStartTime(scene.id);
                            return (
                              <div
                                key={scene.id}
                                className="absolute top-0 bottom-0"
                                style={{ width: w, left: start * zoom, pointerEvents: "auto" }}
                                onContextMenu={(e) => handleSceneContextMenu(e, scene.id)}
                              >
                                <TimelineScene scene={scene} width={w} trackHeight={trackH} zoom={zoom} />
                              </div>
                            );
                          })}
                          {trackScenes.length === 0 && (
                            <div className="flex items-center justify-center h-full w-full opacity-40 pointer-events-none transition-colors" style={{ border: `1px dashed ${C.textMuted}40`, borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                               <span className="text-[9px] font-medium tracking-wide uppercase" style={{ color: C.textMuted }}>Drop Scene Here</span>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    )}
                    {track.isLocked && !track.isCollapsed && (
                      <div className="absolute inset-0 pointer-events-none z-10 opacity-10"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, currentColor 5px, currentColor 6px)", color: "var(--editor-warn)" }}
                      />
                    )}
                  </DroppableTrack>
                );
              })}

              {/* Add video track placeholder */}
              <div style={{ height: 20, borderBottom: `1px solid ${C.border}` }} />

              {/* Audio track lanes */}
              {audioTracks.map((track) => {
                const trackScenes = getTrackScenes(track.id);
                const trackH = track.isCollapsed ? 20 : perTrackHeight;
                return (
                  <DroppableTrack
                    id={track.id}
                    key={track.id}
                    className="relative"
                    style={{
                      height: trackH,
                      borderBottom: `1px solid ${C.border}`,
                      background: track.isMuted ? "var(--editor-surface-hover)" : C.audioTrack,
                      opacity: track.isMuted ? 0.5 : 1,
                    }}
                  >
                    {!track.isCollapsed && (
                      <SortableContext items={trackScenes.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                        <div className="relative h-full">
                          {trackScenes.map(scene => {
                            const w = Math.max(scene.duration * zoom, 2);
                            const start = getSceneStartTime(scene.id);
                            return (
                              <div
                                key={scene.id}
                                className="absolute top-0 bottom-0"
                                style={{ width: w, left: start * zoom, pointerEvents: "auto" }}
                                onContextMenu={(e) => handleSceneContextMenu(e, scene.id)}
                              >
                                <TimelineAudioScene scene={scene} width={w} trackHeight={trackH} />
                              </div>
                            );
                          })}
                          {trackScenes.length === 0 && (
                            <div className="flex items-center justify-center h-full w-full opacity-40 pointer-events-none transition-colors" style={{ border: `1px dashed ${C.textMuted}40`, borderRadius: 4, background: "rgba(0,0,0,0.1)" }}>
                               <span className="text-[9px] font-medium tracking-wide uppercase" style={{ color: C.textMuted }}>Drop Audio Here</span>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    )}
                    {track.isLocked && !track.isCollapsed && (
                      <div className="absolute inset-0 pointer-events-none z-10 opacity-10"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, currentColor 5px, currentColor 6px)", color: "var(--editor-warn)" }}
                      />
                    )}
                  </DroppableTrack>
                );
              })}

              {/* DragOverlay for visual feedback */}
              {activeDragId && (() => {
                const dragScene = scenes.find(s => s.id === activeDragId);
                if (!dragScene) return null;
                const w = Math.max(dragScene.duration * zoom, 2);
                const trackH = perTrackHeight;
                return (
                  <DragOverlay>
                    <div style={{ width: w, opacity: 0.8, transform: 'scale(1.02)' }}>
                      {dragScene.trackId.startsWith('a') 
                        ? <TimelineAudioScene scene={dragScene} width={w} trackHeight={trackH} />
                        : <TimelineScene scene={dragScene} width={w} trackHeight={trackH} zoom={zoom} />
                      }
                    </div>
                  </DragOverlay>
                );
              })()}
            </DndContext>

            {/* Add audio track placeholder */}
            <div style={{ height: 20, borderBottom: `1px solid ${C.border}` }} />
          </div>
        </div>
      </div>

      {/* Bottom bar: zoom */}
      <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ background: C.bg, borderTop: `1px solid ${C.border}`, height: 34 }}>
        <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: C.textMuted }}>
          <span>{scenes.length} clips</span>
          <span>{tracks.length} tracks</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(Math.max(5, zoom - 10))} className="p-0.5 rounded transition-colors"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--editor-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
          >
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </button>
          <input type="range" min={5} max={150} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 h-0.5" style={{ accentColor: C.accent }} />
          <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="p-0.5 rounded transition-colors"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--editor-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
          <span className="text-[11px] font-mono" style={{ color: C.textMuted }}>{zoom}px/s</span>
        </div>
        <button
          onClick={() => {
            const container = scrollRef.current;
            const el = container || document.querySelector('.overflow-x-auto.overflow-y-hidden') as HTMLDivElement;
            // Use V1 scenes total for timeline fit (not all-tracks total)
            const v1Total = v1Scenes.reduce((sum, s) => sum + s.duration, 0);
            if (!el || v1Total <= 0) return;
            const viewWidth = el.clientWidth;
            const idealZoom = Math.max(5, Math.min(150, Math.floor((viewWidth - 20) / v1Total)));
            setZoom(idealZoom);
            el.scrollLeft = 0;
          }}
          className="text-[11px] px-2.5 py-0.5 rounded-md transition-colors"
          style={{ color: C.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--editor-text)"; e.currentTarget.style.background = "var(--editor-surface-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
        >
          Fit
        </button>
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenu && (() => {
        const contextScene = scenes.find(s => s.id === contextMenu.sceneId);
        const contextTrack = contextScene ? tracks.find(t => t.id === contextScene.trackId) : null;
        const isContextLocked = !!(contextScene?.isLocked || contextTrack?.isLocked);
        return (
        <div
          className="fixed z-[100] py-1 rounded-lg shadow-2xl min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x, background: "var(--editor-menu-bg)", border: `1px solid ${C.border}` }}
        >
          {[
            { label: "Select", icon: "check_circle", action: () => { setSelectedSceneId(contextMenu.sceneId); } },
            { divider: true },
            { label: "Split at Playhead", icon: "content_cut", disabled: isContextLocked, action: () => {
              const scene = scenes.find(s => s.id === contextMenu.sceneId);
              if (!scene) return;
              const start = getSceneStartTime(contextMenu.sceneId);
              const splitAt = playheadPosition - start;
              if (splitAt > 0.5 && splitAt < scene.duration - 0.5) {
                splitScene(contextMenu.sceneId, Math.round(splitAt * 10) / 10);
              }
            }},
            { label: "Duplicate", icon: "content_copy", disabled: isContextLocked, action: () => { duplicateScene(contextMenu.sceneId); } },
            { divider: true },
            { label: "Delete", icon: "delete_outline", danger: true, disabled: isContextLocked, action: () => { if (scenes.length > 1) deleteScene(contextMenu.sceneId); } },
          ].map((item: any, i: number) =>
            item.divider ? (
              <div key={i} className="my-1 mx-2 h-px" style={{ background: C.border }} />
            ) : (
              <button
                key={i}
                onClick={() => { if (item.disabled) return; item.action(); setContextMenu(null); }}
                disabled={item.disabled}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                style={{ color: item.disabled ? C.textMuted : item.danger ? C.playhead : "var(--editor-text)", opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? "not-allowed" : "pointer" }}
                onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = "var(--editor-surface-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                {item.label}
                {item.disabled && <span className="material-symbols-outlined text-[11px] ml-auto" style={{ color: C.textMuted }}>lock</span>}
              </button>
            )
          )}
        </div>
        );
      })()}
    </div>
  );
}

// ── Optimized Playhead Component ──

interface PlayheadProps {
  zoom: number;
  playheadRef: React.MutableRefObject<number>;
  totalDuration: number;
  setPlayheadPosition: (pos: number, skipStateUpdate?: boolean) => void;
  calcTimeFromX: (x: number) => number;
}

function Playhead({ zoom, playheadRef, totalDuration, setPlayheadPosition, calcTimeFromX }: PlayheadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current && !isDragging.current) {
        const x = playheadRef.current * zoom;
        containerRef.current.style.transform = `translateX(${x}px)`;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [zoom, playheadRef]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      // Use the playhead container's parent offset to be more accurate if possible
      // But calcTimeFromX already handles screen-to-time conversion in Timeline
      const time = Math.max(0, Math.min(totalDuration, calcTimeFromX(ev.clientX)));
      
      // Update fast-path ref immediately
      playheadRef.current = time;
      
      // Update DOM immediately for 60fps feedback
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(${time * zoom}px)`;
      }

      // Update state for reactive components (Properties Panel, timecode display)
      setPlayheadPosition(time);
    };

    const handleUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 z-50 pointer-events-none"
      style={{ 
        width: 1, 
        background: "var(--editor-accent)",
        boxShadow: "0 0 15px rgba(37, 99, 235, 1), 0 0 5px rgba(37, 99, 235, 0.5)",
        transform: `translateX(${playheadRef.current * zoom}px)`,
        willChange: "transform"
      }}
    >
      <div
        className="absolute -top-[1px] left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing flex flex-col items-center"
        style={{ pointerEvents: "auto" }}
        onMouseDown={onMouseDown}
      >
        <div 
          className="w-3 h-4 bg-primary rounded-b-sm shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center"
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)" }}
        >
          <div className="w-0.5 h-1.5 bg-white/40 rounded-full mb-1" />
        </div>
      </div>
    </div>
  );
}

Playhead.displayName = "Playhead";
