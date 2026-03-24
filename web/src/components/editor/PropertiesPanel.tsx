"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useEditorContext, TransitionType, FilterType, KenBurnsDirection } from "@/context/EditorContext";
import TextOverlayEditor from "./TextOverlayEditor";

type Tab = "scene" | "style" | "audio" | "ai";

const TRANSITIONS: { value: TransitionType; label: string; icon: string }[] = [
  { value: "none", label: "None", icon: "block" },
  { value: "fade", label: "Fade", icon: "gradient" },
  { value: "dissolve", label: "Dissolve", icon: "blur_on" },
  { value: "wipe-left", label: "Wipe L", icon: "arrow_back" },
  { value: "wipe-right", label: "Wipe R", icon: "arrow_forward" },
  { value: "zoom-in", label: "Zoom In", icon: "zoom_in" },
  { value: "zoom-out", label: "Zoom Out", icon: "zoom_out" },
  { value: "slide-left", label: "Slide L", icon: "swipe_left" },
  { value: "slide-right", label: "Slide R", icon: "swipe_right" },
];

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "none", label: "Original" },
  { value: "cinematic", label: "Cinematic" },
  { value: "vintage", label: "Vintage" },
  { value: "noir", label: "Noir" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "vivid", label: "Vivid" },
  { value: "muted", label: "Muted" },
  { value: "sepia", label: "Sepia" },
  { value: "dramatic", label: "Dramatic" },
];

const KEN_BURNS: { value: KenBurnsDirection; label: string; icon: string }[] = [
  { value: "zoom-in", label: "Zoom In", icon: "zoom_in" },
  { value: "zoom-out", label: "Zoom Out", icon: "zoom_out" },
  { value: "pan-left", label: "Pan Left", icon: "arrow_back" },
  { value: "pan-right", label: "Pan Right", icon: "arrow_forward" },
  { value: "pan-up", label: "Pan Up", icon: "arrow_upward" },
  { value: "pan-down", label: "Pan Down", icon: "arrow_downward" },
];

export default function PropertiesPanel() {
  const { selectedScene, scenes, updateScene, deleteScene, duplicateScene, splitScene, insertScene } = useEditorContext();
  const [tab, setTab] = useState<Tab>("scene");
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isRegeneratingGenericImage, setIsRegeneratingGenericImage] = useState(false);
  const [isRegeneratingNarration, setIsRegeneratingNarration] = useState(false);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [isRegeneratingVideo, setIsRegeneratingVideo] = useState(false);
  const [isRegeneratingGenericVideo, setIsRegeneratingGenericVideo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((text: string, type: "success" | "error") => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMessage({ text, type });
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  if (!selectedScene) {
    return (
      <div className="h-full flex items-center justify-center text-outline/30 text-xs">
        <div className="text-center space-y-2">
          <span className="material-symbols-outlined text-2xl">touch_app</span>
          <p>Select a scene to edit</p>
        </div>
      </div>
    );
  }

  const handleRegenerateImage = async () => {
    setIsRegeneratingImage(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: selectedScene.visual_prompt, width: 1280, height: 768 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Image API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (data.success && data.images?.[0]) {
        updateScene(selectedScene.id, { imageUrl: data.images[0].imageURL });
        showStatus("Image regenerated successfully", "success");
      } else {
        throw new Error(data.error || "No image returned from API");
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Image generation timed out"
        : `Image regeneration failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      console.error("Image regeneration failed:", err);
      showStatus(message, "error");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleRegenerateGenericImage = async () => {
    setIsRegeneratingGenericImage(true);
    try {
      const seed = Math.floor(Math.random() * 100000);
      const encodedPrompt = encodeURIComponent(selectedScene.visual_prompt);
      const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=nanobanana-pro&width=1280&height=768&seed=${seed}&nologo=true`;
      
      // Update scene directly (browser will handle streaming the image bits over)
      updateScene(selectedScene.id, { imageUrl: url });
      showStatus("Generic photo generated successfully", "success");
    } catch (err) {
      showStatus("Failed to generate generic photo", "error");
    } finally {
      setIsRegeneratingGenericImage(false);
    }
  };

  const handleRegenerateNarration = async () => {
    setIsRegeneratingNarration(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rewrite_narration",
          narration: selectedScene.narration,
          visual_prompt: selectedScene.visual_prompt,
          mood: selectedScene.mood,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Narration API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (data.narration) {
        updateScene(selectedScene.id, { narration: data.narration });
        showStatus("Narration rewritten successfully", "success");
      } else {
        throw new Error(data.error || "No narration returned from API");
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Narration rewrite timed out"
        : `Narration rewrite failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      console.error("Narration regeneration failed:", err);
      showStatus(message, "error");
    } finally {
      setIsRegeneratingNarration(false);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!selectedScene.narration) return;
    setIsRegeneratingAudio(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedScene.narration, voice: "adam" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`TTS API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (data.success && data.audioUrl) {
        updateScene(selectedScene.id, { audioUrl: data.audioUrl });
        showStatus("Audio generated successfully", "success");
      } else {
        throw new Error(data.error || "No audio returned from API");
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Audio generation timed out"
        : `Audio generation failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      console.error("Audio regeneration failed:", err);
      showStatus(message, "error");
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  const handleRegenerateVideo = async () => {
    setIsRegeneratingVideo(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedScene.visual_prompt,
          duration: Math.min(Math.ceil(selectedScene.duration), 15),
          mode: "ai",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Video API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (data.success && data.videoUrl && !data.useKenBurns) {
        updateScene(selectedScene.id, { aiVideoUrl: data.videoUrl });
        showStatus("AI video generated successfully", "success");
      } else {
        showStatus("AI video unavailable for this scene. Ken Burns will be used.", "error");
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Video generation timed out"
        : `Video generation failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      console.error("Video regeneration failed:", err);
      showStatus(message, "error");
    } finally {
      setIsRegeneratingVideo(false);
    }
  };

  const handleRegenerateGenericVideo = async () => {
    setIsRegeneratingGenericVideo(true);
    try {
      const seed = Math.floor(Math.random() * 100000);
      const encodedPrompt = encodeURIComponent(selectedScene.visual_prompt);
      const url = `https://gen.pollinations.ai/video/${encodedPrompt}?model=wan&aspectRatio=16:9&seed=${seed}&nologo=true`;
      
      updateScene(selectedScene.id, { aiVideoUrl: url });
      showStatus("Generic AI Video generated successfully", "success");
    } catch (err) {
      showStatus("Failed to generate generic video", "error");
    } finally {
      setIsRegeneratingGenericVideo(false);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteScene(selectedScene.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "scene", label: "Scene", icon: "image" },
    { id: "style", label: "Style", icon: "palette" },
    { id: "audio", label: "Audio", icon: "volume_up" },
    { id: "ai", label: "AI", icon: "auto_awesome" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
            {selectedScene.orderIndex + 1}
          </span>
          <h3 className="font-headline text-xs font-bold text-white/90">
            Scene {selectedScene.orderIndex + 1}
          </h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => updateScene(selectedScene.id, { isLocked: !selectedScene.isLocked })}
            className={`p-1 rounded hover:bg-white/5 ${selectedScene.isLocked ? "text-yellow-400" : "text-outline/40"}`} title="Lock/Unlock">
            <span className="material-symbols-outlined text-sm" style={selectedScene.isLocked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {selectedScene.isLocked ? "lock" : "lock_open"}
            </span>
          </button>
          <button onClick={() => updateScene(selectedScene.id, { isHidden: !selectedScene.isHidden })}
            className={`p-1 rounded hover:bg-white/5 ${selectedScene.isHidden ? "text-outline/30" : "text-outline/40"}`} title="Show/Hide">
            <span className="material-symbols-outlined text-sm">
              {selectedScene.isHidden ? "visibility_off" : "visibility"}
            </span>
          </button>
          <button onClick={() => insertScene(selectedScene.id)} className="p-1 rounded hover:bg-white/5 text-outline/40 hover:text-primary" title="Insert after">
            <span className="material-symbols-outlined text-sm">add</span>
          </button>
          <button onClick={() => duplicateScene(selectedScene.id)} className="p-1 rounded hover:bg-white/5 text-outline/40 hover:text-primary" title="Duplicate">
            <span className="material-symbols-outlined text-sm">content_copy</span>
          </button>
          <button onClick={() => splitScene(selectedScene.id, Math.floor(selectedScene.duration / 2))}
            disabled={selectedScene.duration < 4}
            className="p-1 rounded hover:bg-white/5 text-outline/40 hover:text-primary disabled:opacity-20" title="Split">
            <span className="material-symbols-outlined text-sm">content_cut</span>
          </button>
          <button onClick={handleDelete}
            className={`p-1 rounded hover:bg-red-500/10 ${showDeleteConfirm ? "text-red-400" : "text-outline/40 hover:text-red-400"}`}
            title={showDeleteConfirm ? "Click again to confirm" : "Delete"}>
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-all border-b-2 ${
              tab === t.id
                ? "text-primary border-primary bg-primary/5"
                : "text-outline/50 border-transparent hover:text-outline/80 hover:bg-white/[0.02]"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-medium animate-in fade-in duration-200 ${
              statusMessage.type === "error"
                ? "bg-red-500/15 text-red-300 border border-red-500/20"
                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {statusMessage.type === "error" ? "error" : "check_circle"}
            </span>
            <span className="flex-1">{statusMessage.text}</span>
            <button
              onClick={() => {
                if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
                setStatusMessage(null);
              }}
              className="text-white/40 hover:text-white/70"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        )}

        {/* ═══ SCENE TAB ═══ */}
        {tab === "scene" && (
          <>
            {/* Thumbnail */}
            {selectedScene.imageUrl && (
              <div className="rounded-xl overflow-hidden aspect-video bg-black/30 relative group">
                <img src={selectedScene.imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={handleRegenerateImage}
                  disabled={isRegeneratingImage}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  {isRegeneratingImage ? "Generating..." : "Regenerate"}
                </button>
              </div>
            )}

            {/* Duration + Speed */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Duration</label>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateScene(selectedScene.id, { duration: Math.max(2, selectedScene.duration - 1) })}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/80 hover:bg-white/[0.08]">
                    <span className="material-symbols-outlined text-sm">remove</span>
                  </button>
                  <span className="text-sm font-mono text-white w-10 text-center">{selectedScene.duration}s</span>
                  <button onClick={() => updateScene(selectedScene.id, { duration: Math.min(60, selectedScene.duration + 1) })}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/80 hover:bg-white/[0.08]">
                    <span className="material-symbols-outlined text-sm">add</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Speed</label>
                <select
                  value={selectedScene.playbackSpeed}
                  onChange={e => updateScene(selectedScene.id, { playbackSpeed: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
                >
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(s => (
                    <option key={s} value={s}>{s}x</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Narration */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] uppercase tracking-wider text-outline/50">Narration</label>
                <span className="text-[8px] text-outline/30">{selectedScene.narration.length} chars</span>
              </div>
              <textarea
                value={selectedScene.narration}
                onChange={e => updateScene(selectedScene.id, { narration: e.target.value })}
                rows={3}
                className="w-full bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white/90 border border-white/[0.06] focus:border-primary/40 focus:outline-none resize-none placeholder:text-outline/30"
                placeholder="Scene narration text..."
              />
            </div>

            {/* Visual Prompt */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Visual Prompt</label>
              <textarea
                value={selectedScene.visual_prompt}
                onChange={e => updateScene(selectedScene.id, { visual_prompt: e.target.value })}
                rows={3}
                className="w-full bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white/70 border border-white/[0.06] focus:border-primary/40 focus:outline-none resize-none placeholder:text-outline/30"
                placeholder="Image generation prompt..."
              />
              <button
                onClick={handleRegenerateImage}
                disabled={isRegeneratingImage}
                className="mt-1 text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-xs">refresh</span>
                {isRegeneratingImage ? "Regenerating..." : "Regenerate Image"}
              </button>
            </div>

            {/* Text Overlays */}
            <TextOverlayEditor />

            {/* Marker / Bookmark */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Marker / Bookmark</label>
              <input
                type="text"
                value={selectedScene.marker || ""}
                onChange={e => updateScene(selectedScene.id, { marker: e.target.value || undefined })}
                className="w-full bg-white/[0.04] rounded-lg px-3 py-1.5 text-xs text-white/80 border border-white/[0.06] focus:border-primary/40 focus:outline-none placeholder:text-outline/30"
                placeholder="e.g. Key moment, Climax, Hook..."
              />
            </div>

            {/* Metadata tags */}
            {(selectedScene.camera_angle || selectedScene.lighting || selectedScene.mood) && (
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-outline/50">Metadata</span>
                <div className="flex flex-wrap gap-1">
                  {selectedScene.camera_angle && <span className="text-[8px] bg-white/[0.04] text-outline/60 px-1.5 py-0.5 rounded">{selectedScene.camera_angle}</span>}
                  {selectedScene.lighting && <span className="text-[8px] bg-white/[0.04] text-outline/60 px-1.5 py-0.5 rounded">{selectedScene.lighting}</span>}
                  {selectedScene.mood && <span className="text-[8px] bg-white/[0.04] text-outline/60 px-1.5 py-0.5 rounded">{selectedScene.mood}</span>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ STYLE TAB ═══ */}
        {tab === "style" && (
          <>
            {/* Transition */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-2">Transition In</label>
              <div className="grid grid-cols-3 gap-1">
                {TRANSITIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateScene(selectedScene.id, { transition: t.value })}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] transition-all ${
                      selectedScene.transition === t.value
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-white/[0.03] text-outline/60 border border-transparent hover:bg-white/[0.06] hover:text-white/80"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              {selectedScene.transition !== "none" && (
                <div className="mt-2">
                  <label className="text-[8px] text-outline/40 block mb-1">Duration: {selectedScene.transitionDuration}s</label>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={selectedScene.transitionDuration}
                    onChange={e => updateScene(selectedScene.id, { transitionDuration: Number(e.target.value) })}
                    className="w-full h-1 accent-primary"
                  />
                </div>
              )}
            </div>

            {/* Filter */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-2">Color Filter</label>
              <div className="grid grid-cols-2 gap-1">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateScene(selectedScene.id, { filter: f.value })}
                    className={`py-1.5 px-2 rounded-lg text-[10px] text-left transition-all ${
                      selectedScene.filter === f.value
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-white/[0.03] text-outline/60 border border-transparent hover:bg-white/[0.06]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ken Burns */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-2">Camera Motion (Ken Burns)</label>
              <div className="grid grid-cols-3 gap-1">
                {KEN_BURNS.map(k => (
                  <button
                    key={k.value}
                    onClick={() => updateScene(selectedScene.id, { kenBurns: k.value })}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[9px] transition-all ${
                      selectedScene.kenBurns === k.value
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-white/[0.03] text-outline/60 border border-transparent hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{k.icon}</span>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply to all */}
            <div className="pt-2 border-t border-white/[0.04]">
              <p className="text-[8px] text-outline/40 mb-2">Batch apply current style to all scenes:</p>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const { transition, transitionDuration } = selectedScene;
                    scenes.forEach(s => updateScene(s.id, { transition, transitionDuration }));
                  }}
                  className="flex-1 text-[9px] py-1.5 rounded-lg bg-white/[0.04] text-outline/60 hover:text-white hover:bg-white/[0.08]"
                >
                  Apply Transition
                </button>
                <button
                  onClick={() => {
                    const { filter } = selectedScene;
                    scenes.forEach(s => updateScene(s.id, { filter }));
                  }}
                  className="flex-1 text-[9px] py-1.5 rounded-lg bg-white/[0.04] text-outline/60 hover:text-white hover:bg-white/[0.08]"
                >
                  Apply Filter
                </button>
              </div>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => {
                    scenes.forEach(s => updateScene(s.id, { transition: "none", transitionDuration: 0 }));
                    showStatus("All transitions removed", "success");
                  }}
                  className="flex-1 flex items-center justify-center gap-1 text-[9px] py-1.5 rounded-lg bg-red-500/10 text-red-400/80 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">link_off</span>
                  Remove All Transitions
                </button>
                <button
                  onClick={() => {
                    scenes.forEach((s) => {
                      if (s.trackId === "v1") {
                        updateScene(s.id, { transition: s.orderIndex === 0 ? "none" : "fade", transitionDuration: 0.5 });
                      }
                    });
                    showStatus("Default transitions applied", "success");
                  }}
                  className="flex-1 flex items-center justify-center gap-1 text-[9px] py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">auto_fix_high</span>
                  Default Transitions
                </button>
              </div>
            </div>
          </>
        )}

        {/* ═══ AUDIO TAB ═══ */}
        {tab === "audio" && (
          <>
            {/* Scene Volume */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Scene Volume</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateScene(selectedScene.id, { isMuted: !selectedScene.isMuted })}
                  className={`p-1 rounded ${selectedScene.isMuted ? "text-red-400" : "text-outline/60"}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {selectedScene.isMuted ? "volume_off" : selectedScene.volume > 0.5 ? "volume_up" : "volume_down"}
                  </span>
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedScene.volume * 100)}
                  onChange={e => updateScene(selectedScene.id, { volume: Number(e.target.value) / 100 })}
                  className="flex-1 h-1 accent-primary"
                  disabled={selectedScene.isMuted}
                />
                <span className="text-[9px] text-outline/50 w-8 text-right">{selectedScene.isMuted ? "Mute" : `${Math.round(selectedScene.volume * 100)}%`}</span>
              </div>
            </div>

            {/* Narration audio */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">Narration Audio</label>
              {selectedScene.audioUrl ? (
                <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2">
                  <span className="material-symbols-outlined text-sm text-emerald-400">mic</span>
                  <span className="text-[10px] text-white/70 flex-1">Audio generated</span>
                  <button onClick={() => updateScene(selectedScene.id, { audioUrl: null })}
                    className="text-outline/40 hover:text-red-400">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-dashed border-white/[0.08] rounded-lg p-3 text-center">
                  <span className="material-symbols-outlined text-lg text-outline/20">mic_off</span>
                  <p className="text-[9px] text-outline/40 mt-1">TTS audio will be generated during export</p>
                </div>
              )}
            </div>

            {/* AI Video */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-outline/50 block mb-1">AI Video</label>
              {selectedScene.aiVideoUrl ? (
                <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2">
                  <span className="material-symbols-outlined text-sm text-tertiary">smart_display</span>
                  <span className="text-[10px] text-white/70 flex-1">AI video attached</span>
                  <button onClick={() => updateScene(selectedScene.id, { aiVideoUrl: null })}
                    className="text-outline/40 hover:text-red-400">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-dashed border-white/[0.08] rounded-lg p-3 text-center">
                  <span className="material-symbols-outlined text-lg text-outline/20">videocam_off</span>
                  <p className="text-[9px] text-outline/40 mt-1">Ken Burns will be used (free)</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ AI TAB ═══ */}
        {tab === "ai" && (
          <>
            <div className="space-y-2">
              <p className="text-[9px] text-outline/50">Use AI to enhance this scene</p>

              <button
                onClick={handleRegenerateImage}
                disabled={isRegeneratingImage}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-primary">image</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">{isRegeneratingImage ? "Generating..." : "Regenerate Image (Premium)"}</span>
                  <span className="text-[8px] text-outline/40">Cost: 1 Image Credit — Runware</span>
                </div>
              </button>

              <button
                onClick={handleRegenerateGenericImage}
                disabled={isRegeneratingGenericImage}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-green-400">image</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-green-100 block">{isRegeneratingGenericImage ? "Generating..." : "Regenerate Generic Photo (Free)"}</span>
                  <span className="text-[8px] text-green-400/60">Free fallback using Pollinations</span>
                </div>
              </button>

              <button
                onClick={handleRegenerateNarration}
                disabled={isRegeneratingNarration}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">edit_note</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">{isRegeneratingNarration ? "Rewriting..." : "Rewrite Narration"}</span>
                  <span className="text-[8px] text-outline/40">AI rewrites the narration text</span>
                </div>
              </button>

              <button
                onClick={handleRegenerateAudio}
                disabled={isRegeneratingAudio || !selectedScene.narration}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-blue-400">record_voice_over</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">{isRegeneratingAudio ? "Generating TTS..." : selectedScene.audioUrl ? "Regenerate Audio" : "Generate Audio"}</span>
                  <span className="text-[8px] text-outline/40">{selectedScene.audioUrl ? "Replace TTS voiceover" : "Create TTS voiceover for this scene"}</span>
                </div>
                {selectedScene.audioUrl && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </button>

              <button
                onClick={handleRegenerateVideo}
                disabled={isRegeneratingVideo}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-purple-400">smart_display</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">{isRegeneratingVideo ? "Generating video..." : selectedScene.aiVideoUrl ? "Regenerate Premium AI Video" : "Generate Premium AI Video"}</span>
                  <span className="text-[8px] text-outline/40">{selectedScene.aiVideoUrl ? "Replace AI video clip (Costs $0.05)" : "Create AI video from prompt (Costs $0.05)"}</span>
                </div>
                {selectedScene.aiVideoUrl && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
              </button>

              <button
                onClick={handleRegenerateGenericVideo}
                disabled={isRegeneratingGenericVideo}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40 transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm text-green-400">smart_display</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-green-100 block">{isRegeneratingGenericVideo ? "Generating video..." : selectedScene.aiVideoUrl ? "Regenerate Generic Video (Free)" : "Generate Generic Video (Free)"}</span>
                  <span className="text-[8px] text-green-400/60">Free fallback using Pollinations</span>
                </div>
                {selectedScene.aiVideoUrl && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </button>

              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all"
                onClick={() => {
                  const improved = selectedScene.visual_prompt + ", ultra detailed, 8k, cinematic lighting, professional photography";
                  updateScene(selectedScene.id, { visual_prompt: improved });
                }}
              >
                <span className="material-symbols-outlined text-sm text-amber-400">auto_fix_high</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">Enhance Prompt</span>
                  <span className="text-[8px] text-outline/40">Add cinematic quality keywords</span>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all"
                onClick={() => {
                  updateScene(selectedScene.id, {
                    transition: "fade",
                    transitionDuration: 0.8,
                    filter: "cinematic",
                    kenBurns: "zoom-in",
                  });
                }}
              >
                <span className="material-symbols-outlined text-sm text-emerald-400">movie_filter</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">Apply Cinematic Style</span>
                  <span className="text-[8px] text-outline/40">Fade + Cinematic filter + Zoom</span>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all"
                onClick={() => {
                  scenes.forEach(s => {
                    updateScene(s.id, {
                      transition: s.orderIndex === 0 ? "none" : "fade",
                      transitionDuration: 0.6,
                      filter: "cinematic",
                    });
                  });
                }}
              >
                <span className="material-symbols-outlined text-sm text-purple-400">auto_awesome</span>
                <div className="text-left flex-1">
                  <span className="text-[10px] text-white/80 block">Auto-Style All Scenes</span>
                  <span className="text-[8px] text-outline/40">Apply cinematic look to entire project</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
