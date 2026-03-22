"use client";
import { useRef, useMemo, useState } from "react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useEditorContext, TrackType } from "@/context/EditorContext";
import TimelineScene from "./TimelineScene";

// Premiere-style colors
const C = {
  bg: "#1a1a1a",
  ruler: "#1e1e1e",
  trackBg: "#232323",
  trackAlt: "#1f1f1f",
  border: "#3a3a3a",
  accent: "#4a9eed",
  accentDim: "rgba(74, 158, 237, 0.12)",
  textDim: "#808080",
  textMuted: "#5a5a5a",
  playhead: "#ea4335",
  audioTrack: "#2a5a2a",
  videoTrack: "#2a3a5a",
};

export default function Timeline() {
  const {
    scenes, tracks, zoom, setZoom, reorderScene, totalDuration,
    playheadPosition, setPlayheadPosition,
    setSelectedSceneId, snapEnabled,
    addTrack, removeTrack, updateTrack, getTrackScenes,
    musicTrack, setMusicTrack, importMedia,
  } = useEditorContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTargetTrack, setImportTargetTrack] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Use V1 scenes for width/duration calculations (primary track)
  const v1Scenes = useMemo(() => scenes.filter(s => s.trackId === "v1"), [scenes]);
  const sceneWidths = useMemo(() => v1Scenes.map(s => Math.max(s.duration * zoom, 50)), [v1Scenes, zoom]);
  const totalWidth = Math.max(sceneWidths.reduce((a, b) => a + b, 0), 400);

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

  const videoTracks = tracks.filter(t => t.type === "video");
  const audioTracks = tracks.filter(t => t.type === "audio");

  return (
    <div
      className="flex flex-col select-none"
      style={{ background: C.bg }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleFileDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: "rgba(74, 158, 237, 0.08)", border: `2px dashed ${C.accent}` }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.8)", color: C.accent }}>
            <span className="material-symbols-outlined text-lg">upload_file</span>
            <span className="text-sm font-medium">Drop media here</span>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleFileInput} className="hidden" />

      {/* Combined track header + scrollable area */}
      <div className="flex relative">
        {/* Track labels (fixed left) */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: 110, background: "#222", borderRight: `1px solid ${C.border}`, zIndex: 10 }}>
          {/* Ruler label */}
          <div className="flex items-center justify-between px-2" style={{ height: 22, borderBottom: `1px solid ${C.border}` }}>
            <span className="text-[9px] font-mono" style={{ color: C.textMuted }}>{formatTime(totalDuration)}</span>
          </div>

          {/* Video tracks */}
          {videoTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-1.5 group"
              style={{ height: track.isCollapsed ? 20 : track.height, borderBottom: `1px solid ${C.border}`, background: C.videoTrack }}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isCollapsed ? "expand_more" : "expand_less"}</span>
                </button>
                <span className="text-[9px] font-bold" style={{ color: C.textDim }}>{track.label}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isMuted ? C.playhead : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isMuted ? "visibility_off" : "visibility"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isLocked ? "#d29922" : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                <button
                  onClick={() => handleImportClick(track.id)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textMuted }}
                  title="Import media"
                >
                  <span className="material-symbols-outlined text-[10px]">add</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add video track button */}
          <button
            onClick={() => addTrack("video")}
            className="flex items-center gap-1 px-2 py-0.5 transition-colors"
            style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[10px]">add</span>
            <span className="text-[8px]">Video Track</span>
          </button>

          {/* Audio tracks */}
          {audioTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-1.5 group"
              style={{ height: track.isCollapsed ? 20 : track.height, borderBottom: `1px solid ${C.border}`, background: C.audioTrack }}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateTrack(track.id, { isCollapsed: !track.isCollapsed })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textDim }}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isCollapsed ? "expand_more" : "expand_less"}</span>
                </button>
                <span className="text-[9px] font-bold" style={{ color: C.textDim }}>{track.label}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isMuted ? C.playhead : C.textMuted }}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isMuted ? "volume_off" : "volume_up"}</span>
                </button>
                <button
                  onClick={() => updateTrack(track.id, { isLocked: !track.isLocked })}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: track.isLocked ? "#d29922" : C.textMuted }}
                  title={track.isLocked ? "Unlock" : "Lock"}
                >
                  <span className="material-symbols-outlined text-[10px]">{track.isLocked ? "lock" : "lock_open"}</span>
                </button>
                <button
                  onClick={() => handleImportClick(track.id)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: C.textMuted }}
                  title="Import audio"
                >
                  <span className="material-symbols-outlined text-[10px]">add</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add audio track button */}
          <button
            onClick={() => addTrack("audio")}
            className="flex items-center gap-1 px-2 py-0.5 transition-colors"
            style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[10px]">add</span>
            <span className="text-[8px]">Audio Track</span>
          </button>
        </div>

        {/* Scrollable tracks */}
        <div className="flex-1 min-w-0 overflow-x-auto" ref={scrollRef} style={{ scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent` }}>
          <div style={{ minWidth: totalWidth + 100, position: "relative" }}>
            {/* Time ruler */}
            <div
              className="relative cursor-pointer"
              style={{ height: 22, background: C.ruler, borderBottom: `1px solid ${C.border}` }}
              onClick={handleRulerClick}
            >
              {timeMarks.map(m => (
                <div key={m.time} className="absolute top-0 h-full flex flex-col items-center" style={{ left: m.x }}>
                  <span className="font-mono mt-0.5" style={{ fontSize: m.major ? 9 : 8, color: m.major ? C.textDim : C.textMuted }}>
                    {formatTime(m.time)}
                  </span>
                  <div className="w-px mt-auto" style={{ height: m.major ? 6 : 4, background: m.major ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }} />
                </div>
              ))}
            </div>

            {/* Playhead line (spans all tracks) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
              style={{ left: playheadX + 110, background: C.playhead, transition: "left 0.1s" }}
            >
              <div className="w-2.5 h-2.5 rounded-sm -ml-[4px] -mt-0.5 rotate-45" style={{ background: C.playhead }} />
            </div>

            {/* Video track lanes */}
            {videoTracks.map((track) => {
              const trackScenes = getTrackScenes(track.id);
              return (
                <div
                  key={track.id}
                  className="relative"
                  style={{
                    height: track.isCollapsed ? 20 : track.height,
                    borderBottom: `1px solid ${C.border}`,
                    background: track.isMuted ? "rgba(42,58,90,0.3)" : C.videoTrack,
                    opacity: track.isMuted ? 0.5 : 1,
                  }}
                >
                  {!track.isCollapsed && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={trackScenes.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                        <div className="flex gap-0.5 p-0.5 h-full items-center">
                          {trackScenes.map(scene => {
                            const w = Math.max(scene.duration * zoom, 50);
                            return (
                              <div key={scene.id} style={{ width: w, flexShrink: 0 }}>
                                <TimelineScene scene={scene} width={w} />
                              </div>
                            );
                          })}
                          {/* Empty drop zone at end */}
                          {trackScenes.length === 0 && (
                            <div
                              className="flex items-center justify-center h-full w-full opacity-40"
                              style={{ border: `1px dashed ${C.border}`, borderRadius: 4 }}
                            >
                              <span className="text-[9px]" style={{ color: C.textMuted }}>Drop video/image here</span>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              );
            })}

            {/* Add video track placeholder */}
            <div style={{ height: 18, borderBottom: `1px solid ${C.border}` }} />

            {/* Audio track lanes */}
            {audioTracks.map((track) => {
              const trackScenes = getTrackScenes(track.id);
              return (
                <div
                  key={track.id}
                  className="relative"
                  style={{
                    height: track.isCollapsed ? 20 : track.height,
                    borderBottom: `1px solid ${C.border}`,
                    background: track.isMuted ? "rgba(42,90,42,0.3)" : C.audioTrack,
                    opacity: track.isMuted ? 0.5 : 1,
                  }}
                >
                  {!track.isCollapsed && (
                    <div className="flex gap-0.5 p-0.5 h-full items-center">
                      {trackScenes.map(scene => {
                        const w = Math.max(scene.duration * zoom, 50);
                        return (
                          <div
                            key={scene.id}
                            className="h-full rounded cursor-pointer flex items-center px-2 overflow-hidden"
                            style={{
                              width: w, flexShrink: 0,
                              background: "rgba(74, 158, 237, 0.15)",
                              border: `1px solid rgba(74, 158, 237, 0.3)`,
                            }}
                            onClick={() => setSelectedSceneId(scene.id)}
                          >
                            <span className="material-symbols-outlined text-[10px] mr-1" style={{ color: C.accent }}>graphic_eq</span>
                            <span className="text-[8px] truncate" style={{ color: C.textDim }}>
                              {scene.sourceFileName || `Audio ${scene.id}`}
                            </span>
                          </div>
                        );
                      })}
                      {trackScenes.length === 0 && (
                        <div
                          className="flex items-center justify-center h-full w-full opacity-40"
                          style={{ border: `1px dashed ${C.border}`, borderRadius: 4 }}
                        >
                          <span className="text-[9px]" style={{ color: C.textMuted }}>Drop audio here</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add audio track placeholder */}
            <div style={{ height: 18, borderBottom: `1px solid ${C.border}` }} />
          </div>
        </div>
      </div>

      {/* Bottom bar: zoom */}
      <div className="flex items-center justify-between px-2 py-0.5" style={{ background: "#222", borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: C.textMuted }}>
          <span>{scenes.length} clips</span>
          <span>{tracks.length} tracks</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="p-0.5 rounded transition-colors"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
          >
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </button>
          <input type="range" min={10} max={100} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-20 h-0.5" style={{ accentColor: C.accent }} />
          <button onClick={() => setZoom(Math.min(100, zoom + 10))} className="p-0.5 rounded transition-colors"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
          </button>
          <span className="text-[8px] font-mono" style={{ color: C.textMuted }}>{zoom}px/s</span>
        </div>
        <button
          onClick={() => {
            const container = scrollRef.current;
            if (!container && totalDuration > 0) return;
            const viewWidth = container?.clientWidth || 800;
            const idealZoom = Math.max(10, Math.min(100, Math.floor(viewWidth / totalDuration)));
            setZoom(idealZoom);
          }}
          className="text-[9px] px-2 py-0.5 rounded transition-colors"
          style={{ color: C.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
        >
          Fit
        </button>
      </div>
    </div>
  );
}
