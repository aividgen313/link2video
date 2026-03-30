"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
    getSceneStartTime, getSceneAtTime,
    totalDuration,
    showSafeZones,
    previewScale, setPreviewScale,
    tracks,
    playheadPosition, setPlayheadPosition, isPlaying, setIsPlaying
  } = useEditorContext();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const audioScenes = useMemo(() => scenes.filter(s => !!s.audioUrl), [scenes]);
  const audioRefs = useRef<{ [id: number]: HTMLAudioElement | null }>({});
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

    const targetTime = Math.max(0, sceneLocalTime);
    
    if (isPlaying) {
      // Sync video time if it drifts significantly (more than 0.3s)
      if (Math.abs(video.currentTime - targetTime) > 0.3) {
        video.currentTime = targetTime;
      }
      video.play().catch(() => {});
    } else {
      video.pause();
      // Always seek to target time when paused (scrubbing)
      if (isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, selectedScene?.id, playheadPosition]);

  // ── Audio playback sync (Multi-Track) ──
  useEffect(() => {
    // Stop all audio if paused
    if (!isPlaying) {
      Object.values(audioRefs.current).forEach(el => {
        if (el && !el.paused) el.pause();
      });
      return;
    }

    // Play/Pause intersecting audio clips
    audioScenes.forEach((scene: EditorScene) => {
      const audioEl = audioRefs.current[scene.id];
      if (!audioEl) return;
      
      const track = tracks.find(t => t.id === scene.trackId);
      const isMuted = track?.isMuted || scene.isMuted;
      
      const start = getSceneStartTime(scene.id);
      const end = start + scene.duration;
      
      // Is playhead inside this scene's exact time window?
      if (playheadPosition >= start && playheadPosition < end) {
        const localTime = playheadPosition - start;
        if (Math.abs(audioEl.currentTime - localTime) > 0.3) {
           audioEl.currentTime = Math.max(0, localTime);
        }
        if (audioEl.paused) {
           audioEl.volume = isMuted ? 0 : scene.volume;
           audioEl.play().catch(() => {});
        } else {
           // Live volume update
           audioEl.volume = isMuted ? 0 : scene.volume;
        }
      } else {
        if (!audioEl.paused) {
          audioEl.pause();
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playheadPosition, audioScenes, getSceneStartTime, tracks]);

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
      <div className="flex-1 flex items-center justify-center bg-black/60 rounded-xl overflow-hidden relative group">
        {selectedScene ? (
          <>
            {/* AI Video Layer */}
            <video
              ref={videoRef}
              src={selectedScene?.aiVideoUrl || ""}
              className={`${imgClass} ${hasVideo ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              style={{ 
                filter: filterStyle, 
                position: hasVideo ? "relative" : "absolute",
                visibility: tracks.find(t => t.id === selectedScene.trackId)?.isMuted ? "hidden" : "visible"
              }}
              muted
              loop={false}
              playsInline
              preload="auto"
            />
            
            {/* Image Layer */}
            <img
              src={selectedScene?.imageUrl || ""}
              alt=""
              className={`${imgClass} ${!hasVideo ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              draggable={false}
              style={{
                filter: filterStyle,
                position: !hasVideo ? "relative" : "absolute",
                transform: isPlaying && !hasVideo ? getKenBurnsTransform(selectedScene.kenBurns, sceneProgress) : undefined,
                transition: isPlaying && !hasVideo ? "transform 0.3s linear" : "none",
                visibility: tracks.find(t => t.id === selectedScene.trackId)?.isMuted ? "hidden" : "visible"
              }}
            />

            {/* Scene narration audio streams (Hidden) */}
            {audioScenes.map((scene: EditorScene) => (
              <audio
                key={scene.id}
                ref={el => { audioRefs.current[scene.id] = el; }}
                src={scene.audioUrl!}
                preload="auto"
              />
            ))}

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
            {selectedScene!.overlays.map(overlay => {
              const hasStroke = (overlay.strokeWidth ?? 0) > 0;
              const hasBorder = (overlay.borderWidth ?? 0) > 0;
              const shadowStyle = overlay.shadowEnabled
                ? `${overlay.shadowX ?? 2}px ${overlay.shadowY ?? 2}px ${overlay.shadowBlur ?? 4}px ${overlay.shadowColor ?? "rgba(0,0,0,0.5)"}`
                : "0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)";

              // Animation CSS based on overlay.animation and scene progress
              const anim = overlay.animation || "none";
              const animDuration = 0.6; // seconds for animation entrance
              const animProgress = Math.min(sceneLocalTime / animDuration, 1);
              let animStyle: React.CSSProperties = {};

              if (anim !== "none" && isPlaying) {
                switch (anim) {
                  case "fade-in":
                    animStyle = { opacity: (overlay.opacity ?? 1) * animProgress };
                    break;
                  case "slide-up":
                    animStyle = {
                      opacity: (overlay.opacity ?? 1) * animProgress,
                      transform: `translate(-50%, ${-50 + (1 - animProgress) * 20}%)`,
                    };
                    break;
                  case "typewriter":
                    const chars = Math.floor(overlay.text.length * animProgress);
                    // Handled via text clipping below
                    animStyle = { clipPath: `inset(0 ${(1 - animProgress) * 100}% 0 0)` };
                    break;
                  case "scale-in":
                    const scale = 0.3 + animProgress * 0.7;
                    animStyle = {
                      opacity: (overlay.opacity ?? 1) * animProgress,
                      transform: `translate(-50%, -50%) scale(${scale})`,
                    };
                    break;
                  case "bounce":
                    const bounce = animProgress < 1 ? Math.abs(Math.sin(animProgress * Math.PI * 2.5)) * (1 - animProgress) * 30 : 0;
                    animStyle = {
                      opacity: (overlay.opacity ?? 1) * Math.min(animProgress * 2, 1),
                      transform: `translate(-50%, ${-50 - bounce}%)`,
                    };
                    break;
                  case "glow":
                    const glowIntensity = 5 + Math.sin(sceneLocalTime * 3) * 5;
                    animStyle = {
                      textShadow: `${shadowStyle}, 0 0 ${glowIntensity}px ${overlay.color}, 0 0 ${glowIntensity * 2}px ${overlay.color}40`,
                    };
                    break;
                }
              }

              return (
                <div
                  key={overlay.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: "translate(-50%, -50%)",
                    fontFamily: overlay.fontFamily || "Inter",
                    fontSize: `${overlay.fontSize * 0.6}px`,
                    color: overlay.color,
                    fontWeight: overlay.fontWeight,
                    fontStyle: overlay.fontStyle || "normal",
                    textAlign: overlay.textAlign || "center",
                    textDecoration: overlay.textDecoration || "none",
                    textTransform: (overlay.textTransform || "none") as any,
                    letterSpacing: overlay.letterSpacing ? `${overlay.letterSpacing}px` : undefined,
                    lineHeight: overlay.lineHeight ?? 1.2,
                    textShadow: shadowStyle,
                    whiteSpace: "pre-wrap",
                    maxWidth: "90%",
                    opacity: overlay.opacity ?? 1,
                    backgroundColor: overlay.backgroundColor || "transparent",
                    padding: `${Math.round((overlay.padding ?? 8) * 0.6)}px`,
                    borderRadius: `${overlay.borderRadius ?? 0}px`,
                    border: hasBorder ? `${overlay.borderWidth}px ${overlay.borderStyle ?? "solid"} ${overlay.borderColor ?? "#fff"}` : "none",
                    WebkitTextStroke: hasStroke ? `${overlay.strokeWidth}px ${overlay.strokeColor ?? "#000"}` : undefined,
                    transition: isPlaying ? "none" : "all 0.2s ease",
                    ...animStyle,
                  }}
                >
                  {overlay.text}
                </div>
              );
            })}

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
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Left: Scale controls + timecode */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-0.5 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {(["fit", "fill", "100"] as const).map(s => (
              <button
                key={s}
                onClick={() => setPreviewScale(s)}
                className={`text-[10px] px-2.5 py-1 transition-all ${previewScale === s ? "bg-primary/20 text-primary font-semibold" : "text-outline/50 hover:text-outline/80 hover:bg-white/5"}`}
              >
                {s === "100" ? "1:1" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-outline/50 tabular-nums font-mono">
            {formatTime(playheadPosition)} / {formatTime(totalDuration)}
          </span>
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={goFirst} disabled={sceneIndex <= 0 && !isPlaying} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/50 hover:text-white hover:bg-white/8 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[18px]">first_page</span>
          </button>
          <button onClick={goPrev} disabled={sceneIndex <= 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/8 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_previous</span>
          </button>
          {/* Stop button */}
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/50 hover:text-white hover:bg-white/8 transition-all"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
          </button>
          {/* Play/Pause */}
          <button
            onClick={() => {
              if (!isPlaying && playheadPosition >= totalDuration) {
                setPlayheadPosition(0);
                if (v1Scenes.length > 0) setSelectedSceneId(v1Scenes[0].id);
              }
              setIsPlaying(!isPlaying);
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-lg"
            style={{ background: isPlaying ? "rgba(239,68,68,0.2)" : "var(--editor-hover)", border: `1px solid ${isPlaying ? "rgba(239,68,68,0.3)" : "var(--editor-border-active)"}`, color: isPlaying ? "var(--editor-danger)" : "var(--editor-accent)" }}
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>
          <button onClick={goNext} disabled={sceneIndex >= v1Scenes.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/60 hover:text-white hover:bg-white/8 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-lg">skip_next</span>
          </button>
          <button onClick={goLast} disabled={sceneIndex >= v1Scenes.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline/50 hover:text-white hover:bg-white/8 disabled:opacity-20 transition-all">
            <span className="material-symbols-outlined text-[18px]">last_page</span>
          </button>
        </div>

        {/* Right: Scene info */}
        <div className="text-[10px] text-outline/50 tabular-nums font-mono">
          Scene {sceneIndex + 1} / {v1Scenes.length}
          {selectedScene && <span className="ml-2 text-outline/30">({Math.round(selectedScene.duration * 10) / 10}s)</span>}
        </div>
      </div>
    </div>
  );
}
