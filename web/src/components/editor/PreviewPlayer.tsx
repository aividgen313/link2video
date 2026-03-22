"use client";
import { useState, useRef, useCallback } from "react";
import { useEditorContext, FilterType } from "@/context/EditorContext";

const FILTER_CSS: Record<FilterType, string> = {
  none: "",
  cinematic: "contrast(1.1) saturate(1.2) brightness(0.95)",
  vintage: "sepia(0.3) contrast(1.1) brightness(0.9) saturate(0.8)",
  noir: "grayscale(1) contrast(1.3) brightness(0.9)",
  warm: "sepia(0.15) saturate(1.3) brightness(1.05)",
  cool: "saturate(0.9) brightness(1.05) hue-rotate(10deg)",
  vivid: "saturate(1.6) contrast(1.15) brightness(1.05)",
  muted: "saturate(0.5) brightness(1.05) contrast(0.95)",
  sepia: "sepia(0.7) contrast(1.05)",
  dramatic: "contrast(1.4) saturate(1.1) brightness(0.85)",
};

export default function PreviewPlayer() {
  const {
    selectedScene, scenes, selectedSceneId, setSelectedSceneId,
    setPlayheadPosition, getSceneStartTime,
    isPlaying, setIsPlaying,
    showSafeZones,
    previewScale, setPreviewScale,
  } = useEditorContext();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneIndex = scenes.findIndex(s => s.id === selectedSceneId);

  const goPrev = () => {
    if (sceneIndex > 0) {
      const prev = scenes[sceneIndex - 1];
      setSelectedSceneId(prev.id);
      setPlayheadPosition(getSceneStartTime(prev.id));
    }
  };

  const goNext = () => {
    if (sceneIndex < scenes.length - 1) {
      const next = scenes[sceneIndex + 1];
      setSelectedSceneId(next.id);
      setPlayheadPosition(getSceneStartTime(next.id));
    }
  };

  const goFirst = () => {
    if (scenes.length > 0) {
      setSelectedSceneId(scenes[0].id);
      setPlayheadPosition(0);
    }
  };

  const goLast = () => {
    if (scenes.length > 0) {
      const last = scenes[scenes.length - 1];
      setSelectedSceneId(last.id);
      setPlayheadPosition(getSceneStartTime(last.id));
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const imgClass = previewScale === "fill" ? "w-full h-full object-cover" :
    previewScale === "100" ? "max-w-none" : "max-w-full max-h-full object-contain";

  return (
    <div ref={containerRef} className="flex flex-col h-full gap-1">
      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-black/50 rounded-xl overflow-hidden relative group">
        {selectedScene?.imageUrl ? (
          <>
            <img
              src={selectedScene.imageUrl}
              alt={`Scene ${sceneIndex + 1}`}
              className={imgClass}
              draggable={false}
              style={{ filter: FILTER_CSS[selectedScene.filter] || "" }}
            />

            {/* Filter label */}
            {selectedScene.filter !== "none" && (
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] text-white/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {selectedScene.filter}
              </div>
            )}

            {/* Transition indicator */}
            {selectedScene.transition !== "none" && (
              <div className="absolute top-2 right-2 bg-primary/60 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">transition_fade</span>
                {selectedScene.transition}
              </div>
            )}

            {/* Ken Burns direction indicator */}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] text-white/60 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-[10px]">animation</span>
              {selectedScene.kenBurns}
            </div>

            {/* Speed indicator */}
            {selectedScene.playbackSpeed !== 1 && (
              <div className="absolute bottom-2 right-2 bg-tertiary/60 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded-full">
                {selectedScene.playbackSpeed}x
              </div>
            )}

            {/* Text overlays */}
            {selectedScene.overlays.map(overlay => (
              <div
                key={overlay.id}
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: `${overlay.fontSize * 0.6}px`, // scale down for preview
                  color: overlay.color,
                  fontWeight: overlay.fontWeight,
                  fontStyle: overlay.fontStyle || "normal",
                  textAlign: overlay.textAlign || "center",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
                  whiteSpace: "nowrap",
                  opacity: overlay.opacity ?? 1,
                  backgroundColor: overlay.backgroundColor || "transparent",
                  padding: overlay.backgroundColor ? "2px 8px" : undefined,
                  borderRadius: overlay.backgroundColor ? "4px" : undefined,
                }}
              >
                {overlay.text}
              </div>
            ))}

            {/* Safe zones overlay */}
            {showSafeZones && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Title safe (80%) */}
                <div className="absolute border border-yellow-400/40 border-dashed" style={{ top: "10%", left: "10%", right: "10%", bottom: "10%" }}>
                  <span className="absolute top-0 left-1 text-[8px] text-yellow-400/60">Title Safe</span>
                </div>
                {/* Action safe (90%) */}
                <div className="absolute border border-red-400/30 border-dashed" style={{ top: "5%", left: "5%", right: "5%", bottom: "5%" }}>
                  <span className="absolute top-0 left-1 text-[8px] text-red-400/50">Action Safe</span>
                </div>
                {/* Center crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                </div>
                {/* Rule of thirds */}
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
              </div>
            )}

            {/* Lock indicator */}
            {selectedScene.isLocked && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-full p-3">
                <span className="material-symbols-outlined text-2xl text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              </div>
            )}

            {/* Hidden indicator */}
            {selectedScene.isHidden && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-outline/40">visibility_off</span>
                  <p className="text-[10px] text-outline/40 mt-1">Hidden Scene</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-outline/50 text-sm flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-outline/20">image</span>
            {scenes.length === 0 ? "No scenes loaded" : "No image for this scene"}
          </div>
        )}

        {/* Fullscreen button (hover) */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 bg-black/50 text-white/70 hover:text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Toggle Fullscreen"
        >
          <span className="material-symbols-outlined text-sm">{isFullscreen ? "fullscreen_exit" : "fullscreen"}</span>
        </button>
      </div>

      {/* Transport bar */}
      <div className="flex items-center justify-between px-2 py-1">
        {/* Left: Scale controls */}
        <div className="flex items-center gap-1">
          {(["fit", "fill", "100"] as const).map(s => (
            <button
              key={s}
              onClick={() => setPreviewScale(s)}
              className={`text-[9px] px-2 py-0.5 rounded ${previewScale === s ? "bg-primary/20 text-primary" : "text-outline/50 hover:text-outline/80 hover:bg-white/5"}`}
            >
              {s === "100" ? "1:1" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-1">
          <button onClick={goFirst} disabled={sceneIndex <= 0} className="w-7 h-7 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[16px]">first_page</span>
          </button>
          <button onClick={goPrev} disabled={sceneIndex <= 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/70 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_previous</span>
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 transition-all"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>
          <button onClick={goNext} disabled={sceneIndex >= scenes.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/70 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_next</span>
          </button>
          <button onClick={goLast} disabled={sceneIndex >= scenes.length - 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[16px]">last_page</span>
          </button>
        </div>

        {/* Right: Scene info */}
        <div className="text-[10px] text-outline/50 tabular-nums font-mono">
          Scene {sceneIndex + 1} / {scenes.length}
          {selectedScene && <span className="ml-2 text-outline/30">({selectedScene.duration}s)</span>}
        </div>
      </div>
    </div>
  );
}
