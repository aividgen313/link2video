"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorContext, FilterType, EditorScene } from "@/context/EditorContext";

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

// Ken Burns CSS keyframe progress (0-1) → transform
function getKenBurnsTransform(direction: string, progress: number): string {
  const t = progress; // 0 to 1
  switch (direction) {
    case "zoom-in": return `scale(${1 + t * 0.15})`;
    case "zoom-out": return `scale(${1.15 - t * 0.15})`;
    case "pan-left": return `scale(1.1) translateX(${5 - t * 10}%)`;
    case "pan-right": return `scale(1.1) translateX(${-5 + t * 10}%)`;
    case "pan-up": return `scale(1.1) translateY(${5 - t * 10}%)`;
    case "pan-down": return `scale(1.1) translateY(${-5 + t * 10}%)`;
    default: return `scale(${1 + t * 0.1})`;
  }
}

export default function PreviewPlayer() {
  const {
    selectedScene, scenes, selectedSceneId, setSelectedSceneId,
    playheadPosition, setPlayheadPosition, getSceneStartTime, getSceneAtTime,
    totalDuration,
    isPlaying, setIsPlaying,
    showSafeZones,
    previewScale, setPreviewScale,
  } = useEditorContext();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const currentPlayingSceneRef = useRef<number | null>(null);

  const v1Scenes = scenes.filter(s => s.trackId === "v1");
  const sceneIndex = v1Scenes.findIndex(s => s.id === selectedSceneId);

  // Calculate current scene's local progress (0-1)
  const sceneStart = selectedScene ? getSceneStartTime(selectedScene.id) : 0;
  const sceneLocalTime = playheadPosition - sceneStart;
  const sceneProgress = selectedScene ? Math.min(Math.max(sceneLocalTime / selectedScene.duration, 0), 1) : 0;

  // Keep a ref in sync with playheadPosition for the animation loop
  const posRef = useRef(playheadPosition);
  posRef.current = playheadPosition;

  // ── Playback animation loop ──
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Pause video/audio
      videoRef.current?.pause();
      audioRef.current?.pause();
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = now;

      const next = posRef.current + delta;
      if (next >= totalDuration) {
        setPlayheadPosition(totalDuration);
        setIsPlaying(false);
        return;
      }
      setPlayheadPosition(next);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, totalDuration]);

  // ── Auto-advance scene when playhead crosses boundary ──
  useEffect(() => {
    if (!isPlaying) return;
    const currentScene = getSceneAtTime(playheadPosition);
    if (currentScene && currentScene.id !== selectedSceneId) {
      setSelectedSceneId(currentScene.id);
    }
  }, [isPlaying, playheadPosition, selectedSceneId, getSceneAtTime, setSelectedSceneId]);

  // ── Video playback sync ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedScene?.aiVideoUrl) return;

    if (isPlaying) {
      // Sync video time to scene local time
      const targetTime = sceneLocalTime;
      if (Math.abs(video.currentTime - targetTime) > 0.5) {
        video.currentTime = Math.max(0, targetTime);
      }
      video.play().catch(() => {});
    } else {
      video.pause();
      // When paused, seek to current scene time
      const targetTime = Math.max(0, sceneLocalTime);
      if (isFinite(targetTime)) {
        video.currentTime = targetTime;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, selectedScene?.id]);

  // ── Audio playback sync ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectedScene?.audioUrl) return;

    const sceneId = selectedScene.id;
    if (isPlaying) {
      // Only restart audio when we switch to a new scene
      if (currentPlayingSceneRef.current !== sceneId) {
        currentPlayingSceneRef.current = sceneId;
        audio.currentTime = Math.max(0, sceneLocalTime);
        audio.volume = selectedScene.isMuted ? 0 : selectedScene.volume;
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
      currentPlayingSceneRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, selectedScene?.id]);

  // ── Update audio volume when scene settings change ──
  useEffect(() => {
    if (audioRef.current && selectedScene) {
      audioRef.current.volume = selectedScene.isMuted ? 0 : selectedScene.volume;
    }
  }, [selectedScene?.isMuted, selectedScene?.volume, selectedScene]);

  const goPrev = () => {
    if (sceneIndex > 0) {
      const prev = v1Scenes[sceneIndex - 1];
      setSelectedSceneId(prev.id);
      setPlayheadPosition(getSceneStartTime(prev.id));
    }
  };

  const goNext = () => {
    if (sceneIndex < v1Scenes.length - 1) {
      const next = v1Scenes[sceneIndex + 1];
      setSelectedSceneId(next.id);
      setPlayheadPosition(getSceneStartTime(next.id));
    }
  };

  const goFirst = () => {
    if (v1Scenes.length > 0) {
      setSelectedSceneId(v1Scenes[0].id);
      setPlayheadPosition(0);
    }
  };

  const goLast = () => {
    if (v1Scenes.length > 0) {
      const last = v1Scenes[v1Scenes.length - 1];
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

  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadPosition(0);
    if (v1Scenes.length > 0) {
      setSelectedSceneId(v1Scenes[0].id);
    }
  };

  // Determine what to show: video or image
  const hasVideo = !!selectedScene?.aiVideoUrl;
  const filterStyle = selectedScene ? FILTER_CSS[selectedScene.filter] || "" : "";

  const imgClass = previewScale === "fill" ? "w-full h-full object-cover" :
    previewScale === "100" ? "max-w-none" : "max-w-full max-h-full object-contain";

  // Format time for display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30); // frame count at 30fps
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full gap-1">
      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-black/50 rounded-xl overflow-hidden relative group">
        {selectedScene?.imageUrl || selectedScene?.aiVideoUrl ? (
          <>
            {/* AI Video or Ken Burns Image */}
            {hasVideo ? (
              <video
                ref={videoRef}
                src={selectedScene!.aiVideoUrl!}
                className={imgClass}
                style={{ filter: filterStyle }}
                muted // video audio is separate from narration audio
                loop={false}
                playsInline
                preload="auto"
              />
            ) : (
              <img
                src={selectedScene!.imageUrl}
                alt={`Scene ${sceneIndex + 1}`}
                className={imgClass}
                draggable={false}
                style={{
                  filter: filterStyle,
                  transform: isPlaying ? getKenBurnsTransform(selectedScene!.kenBurns, sceneProgress) : undefined,
                  transition: isPlaying ? "transform 0.3s linear" : "none",
                }}
              />
            )}

            {/* Scene narration audio (hidden element) */}
            {selectedScene?.audioUrl && (
              <audio
                ref={audioRef}
                src={selectedScene.audioUrl}
                preload="auto"
              />
            )}

            {/* Playing indicator */}
            {isPlaying && (
              <div className="absolute top-2 left-2 bg-red-600/80 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                PLAYING
              </div>
            )}

            {/* Filter label */}
            {selectedScene!.filter !== "none" && !isPlaying && (
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] text-white/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {selectedScene!.filter}
              </div>
            )}

            {/* Transition indicator */}
            {selectedScene!.transition !== "none" && !isPlaying && (
              <div className="absolute top-2 right-2 bg-primary/60 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">transition_fade</span>
                {selectedScene!.transition}
              </div>
            )}

            {/* Video/Image type indicator */}
            {!isPlaying && (
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] text-white/60 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[10px]">
                  {hasVideo ? "smart_display" : "animation"}
                </span>
                {hasVideo ? "AI Video" : selectedScene!.kenBurns}
              </div>
            )}

            {/* Audio indicator */}
            {selectedScene?.audioUrl && !isPlaying && (
              <div className="absolute bottom-2 left-24 bg-black/60 backdrop-blur-sm text-[9px] text-white/60 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[10px]">volume_up</span>
                Audio
              </div>
            )}

            {/* Speed indicator */}
            {selectedScene!.playbackSpeed !== 1 && (
              <div className="absolute bottom-2 right-2 bg-tertiary/60 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded-full">
                {selectedScene!.playbackSpeed}x
              </div>
            )}

            {/* Scene progress bar during playback */}
            {isPlaying && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                  className="h-full bg-primary transition-none"
                  style={{ width: `${sceneProgress * 100}%` }}
                />
              </div>
            )}

            {/* Text overlays */}
            {selectedScene!.overlays.map(overlay => (
              <div
                key={overlay.id}
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: `${overlay.fontSize * 0.6}px`,
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
                <div className="absolute border border-yellow-400/40 border-dashed" style={{ top: "10%", left: "10%", right: "10%", bottom: "10%" }}>
                  <span className="absolute top-0 left-1 text-[8px] text-yellow-400/60">Title Safe</span>
                </div>
                <div className="absolute border border-red-400/30 border-dashed" style={{ top: "5%", left: "5%", right: "5%", bottom: "5%" }}>
                  <span className="absolute top-0 left-1 text-[8px] text-red-400/50">Action Safe</span>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                </div>
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
              </div>
            )}

            {/* Lock indicator */}
            {selectedScene!.isLocked && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-full p-3">
                <span className="material-symbols-outlined text-2xl text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              </div>
            )}

            {/* Hidden indicator */}
            {selectedScene!.isHidden && (
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
        {/* Left: Scale controls + timecode */}
        <div className="flex items-center gap-2">
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
          <span className="text-[9px] text-outline/40 tabular-nums font-mono">
            {formatTime(playheadPosition)} / {formatTime(totalDuration)}
          </span>
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-1">
          <button onClick={goFirst} disabled={sceneIndex <= 0 && !isPlaying} className="w-7 h-7 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[16px]">first_page</span>
          </button>
          <button onClick={goPrev} disabled={sceneIndex <= 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/70 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_previous</span>
          </button>
          {/* Stop button */}
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
          </button>
          {/* Play/Pause */}
          <button
            onClick={() => {
              if (!isPlaying && playheadPosition >= totalDuration) {
                // If at end, restart from beginning
                setPlayheadPosition(0);
                if (v1Scenes.length > 0) setSelectedSceneId(v1Scenes[0].id);
              }
              setIsPlaying(!isPlaying);
            }}
            className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 transition-all"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>
          <button onClick={goNext} disabled={sceneIndex >= v1Scenes.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/70 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_next</span>
          </button>
          <button onClick={goLast} disabled={sceneIndex >= v1Scenes.length - 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[16px]">last_page</span>
          </button>
        </div>

        {/* Right: Scene info */}
        <div className="text-[10px] text-outline/50 tabular-nums font-mono">
          Scene {sceneIndex + 1} / {v1Scenes.length}
          {selectedScene && <span className="ml-2 text-outline/30">({selectedScene.duration}s)</span>}
        </div>
      </div>
    </div>
  );
}
