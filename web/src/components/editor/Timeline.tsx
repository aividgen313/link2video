"use client";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useEditorContext, TrackType } from "@/context/EditorContext";
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

interface TimelineProps {
  height: number;
  onHeightChange: (h: number) => void;
}

export default function Timeline({ height, onHeightChange }: TimelineProps) {
  const {
    scenes, tracks, zoom, setZoom, reorderScene, totalDuration,
    playheadPosition, setPlayheadPosition,
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

  // Use V1 scenes for width/duration calculations (primary track)
  const v1Scenes = useMemo(() => scenes.filter(s => s.trackId === "v1"), [scenes]);
  const sceneWidths = useMemo(() => v1Scenes.map(s => Math.max(s.duration * zoom, 50)), [v1Scenes, zoom]);
  const totalWidth = Math.max(sceneWidths.reduce((a, b) => a + b, 0), 400);

  // Compute track heights dynamically based on available space
  const videoTracks = tracks.filter(t => t.type === "video");
  const audioTracks = tracks.filter(t => t.type === "audio");

  // Calculate available height for tracks (subtract ruler 24px, bottom bar ~34px, resize handle 6px)
  const availableTrackHeight = height - 24 - 34 - 6;
  const collapsedCount = [...videoTracks, ...audioTracks].filter(t => t.isCollapsed).length;
  const expandedCount = videoTracks.length + audioTracks.length - collapsedCount;
  // Add track buttons are ~20px each
  const addButtonsHeight = 40;
  const collapsedHeight = collapsedCount * 20;
  const expandableHeight = Math.max(40, availableTrackHeight - collapsedHeight - addButtonsHeight);
  const perTrackHeight = expandedCount > 0 ? Math.max(40, Math.floor(expandableHeight / expandedCount)) : 60;

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = scenes.findIndex(s => s.id === active.id);
    const toIndex = scenes.findIndex(s => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) reorderScene(fromIndex, toIndex);
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    let time = x / zoom;
    if (snapEnabled) time = Math.round(time * 4) / 4;
    setPlayheadPosition(Math.max(0, Math.min(time, totalDuration)));
  };

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

  // File drop handler
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        const targetTrack = file.type.startsWith("audio/") ? "a1" : "v1";
        await importMedia(file, targetTrack);
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
        className="absolute top-0 left-0 right-0 h-[6px] cursor-ns-resize z-30 group flex items-center justify-center"
        onMouseDown={handleResizeStart}
        style={{ background: "transparent" }}
      >
        <div className="w-10 h-[3px] rounded-full transition-colors group-hover:bg-white/30" style={{ background: "rgba(255,255,255,0.1)" }} />
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
        <div className="flex-shrink-0 flex flex-col" style={{ width: 110, background: C.trackAlt, borderRight: `1px solid ${C.border}`, zIndex: 10 }}>
          {/* Ruler label */}
          <div className="flex items-center justify-between px-2" style={{ height: 24, borderBottom: `1px solid ${C.border}` }}>
            <span className="text-[11px] font-mono" style={{ color: C.textMuted }}>{formatTime(totalDuration)}</span>
          </div>

          {/* Video tracks */}
          {videoTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-1.5 group"
              style={{ height: track.isCollapsed ? 20 : perTrackHeight, borderBottom: `1px solid ${C.border}`, background: C.videoTrack }}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isCollapsed ? "expand_more" : "expand_less"}</span>
                </button>
                <span className="text-[11px] font-bold" style={{ color: C.textDim }}>{track.label}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isMuted ? C.playhead : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isMuted ? "visibility_off" : "visibility"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isLocked ? C.accent : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                <button
                  onClick={() => handleImportClick(track.id)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textMuted }}
                  title="Import media"
                >
                  <span className="material-symbols-outlined text-[11px]">add</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add video track button */}
          <button
            onClick={() => addTrack("video")}
            className="flex items-center gap-1 px-2 py-0.5 transition-colors"
            style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}`, height: 20 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[11px]">add</span>
            <span className="text-[11px]">Video Track</span>
          </button>

          {/* Audio tracks */}
          {audioTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-1.5 group"
              style={{ height: track.isCollapsed ? 20 : perTrackHeight, borderBottom: `1px solid ${C.border}`, background: C.audioTrack }}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isCollapsed ? "expand_more" : "expand_less"}</span>
                </button>
                <span className="text-[11px] font-bold" style={{ color: C.textDim }}>{track.label}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isMuted ? C.playhead : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isMuted ? "volume_off" : "volume_up"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isLocked ? C.accent : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[11px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                <button
                  onClick={() => handleImportClick(track.id)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textMuted }}
                  title="Import audio"
                >
                  <span className="material-symbols-outlined text-[11px]">add</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add audio track button */}
          <button
            onClick={() => addTrack("audio")}
            className="flex items-center gap-1 px-2 py-0.5 transition-colors"
            style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}`, height: 20 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[11px]">add</span>
            <span className="text-[11px]">Audio Track</span>
          </button>
        </div>

        {/* Scrollable tracks */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden" ref={scrollRef} onWheel={handleWheel} style={{ scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent` }}>
          <div style={{ minWidth: totalWidth + 100, position: "relative" }}>
            {/* Time ruler */}
            <div
              className="relative cursor-pointer"
              style={{ height: 24, background: C.ruler, borderBottom: `1px solid ${C.border}` }}
              onClick={handleRulerClick}
            >
              {timeMarks.map(m => (
                <div key={m.time} className="absolute top-0 h-full flex flex-col items-center" style={{ left: m.x }}>
                  <span className="font-mono mt-0.5" style={{ fontSize: m.major ? 9 : 8, color: m.major ? C.textDim : C.textMuted }}>
                    {formatTime(m.time)}
                  </span>
                  <div className="w-px mt-auto" style={{ height: m.major ? 6 : 4, background: m.major ? "var(--editor-ruler-mark)" : "var(--editor-ruler-mark-minor)" }} />
                </div>
              ))}
            </div>

            {/* Playhead line (spans all tracks) */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: playheadX, width: 2, background: C.playhead }}
            >
              {/* Playhead marker triangle */}
              <div className="absolute -top-[1px] left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${C.playhead}` }} />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* Video track lanes */}
              {videoTracks.map((track) => {
                const trackScenes = getTrackScenes(track.id);
                const trackH = track.isCollapsed ? 20 : perTrackHeight;
                return (
                  <div
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
                        <div className="flex gap-0.5 p-0.5 h-full items-stretch">
                          {trackScenes.map(scene => {
                            const w = Math.max(scene.duration * zoom, 50);
                            return (
                              <div
                                key={scene.id}
                                style={{ width: w, flexShrink: 0 }}
                                onContextMenu={(e) => handleSceneContextMenu(e, scene.id)}
                              >
                                <TimelineScene scene={scene} width={w} trackHeight={trackH} zoom={zoom} />
                              </div>
                            );
                          })}
                          {/* Empty drop zone at end */}
                          {trackScenes.length === 0 && (
                            <div
                              className="flex items-center justify-center h-full w-full opacity-40"
                              style={{ border: `1px dashed ${C.border}`, borderRadius: 4 }}
                            >
                              <span className="text-[11px]" style={{ color: C.textMuted }}>Drop video/image here</span>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    )}
                  </div>
                );
              })}

              {/* Add video track placeholder */}
              <div style={{ height: 20, borderBottom: `1px solid ${C.border}` }} />

              {/* Audio track lanes */}
              {audioTracks.map((track) => {
                const trackScenes = getTrackScenes(track.id);
                const trackH = track.isCollapsed ? 20 : perTrackHeight;
                return (
                  <div
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
                        <div className="flex gap-0.5 p-0.5 h-full items-stretch">
                          {trackScenes.map(scene => {
                            const w = Math.max(scene.duration * zoom, 50);
                            return (
                              <div
                                key={scene.id}
                                style={{ width: w, flexShrink: 0 }}
                                onContextMenu={(e) => handleSceneContextMenu(e, scene.id)}
                              >
                                <TimelineAudioScene scene={scene} width={w} trackHeight={trackH} />
                              </div>
                            );
                          })}
                          {/* Empty drop zone at end */}
                          {trackScenes.length === 0 && (
                            <div
                              className="flex items-center justify-center h-full w-full opacity-40"
                              style={{ border: `1px dashed ${C.border}`, borderRadius: 4 }}
                            >
                              <span className="text-[11px]" style={{ color: C.textMuted }}>Drop audio here</span>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    )}
                  </div>
                );
              })}
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
      {contextMenu && (
        <div
          className="fixed z-[100] py-1 rounded-lg shadow-2xl min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x, background: "var(--editor-menu-bg)", border: `1px solid ${C.border}` }}
        >
          {[
            { label: "Select", icon: "check_circle", action: () => { setSelectedSceneId(contextMenu.sceneId); } },
            { divider: true },
            { label: "Split at Playhead", icon: "content_cut", action: () => {
              const scene = scenes.find(s => s.id === contextMenu.sceneId);
              if (!scene) return;
              const start = getSceneStartTime(contextMenu.sceneId);
              const splitAt = playheadPosition - start;
              if (splitAt > 0.5 && splitAt < scene.duration - 0.5) {
                splitScene(contextMenu.sceneId, Math.round(splitAt * 10) / 10);
              }
            }},
            { label: "Duplicate", icon: "content_copy", action: () => { duplicateScene(contextMenu.sceneId); } },
            { divider: true },
            { label: "Delete", icon: "delete_outline", danger: true, action: () => { if (scenes.length > 1) deleteScene(contextMenu.sceneId); } },
          ].map((item: any, i: number) =>
            item.divider ? (
              <div key={i} className="my-1 mx-2 h-px" style={{ background: C.border }} />
            ) : (
              <button
                key={i}
                onClick={() => { item.action(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                style={{ color: item.danger ? C.playhead : "var(--editor-text)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-surface-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
