"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useEditorContext, TransitionType, FilterType, KenBurnsDirection } from "@/context/EditorContext";
import { useAppContext, Scene, POLLEN_COSTS } from "@/context/AppContext";
import TextOverlayEditor from "./TextOverlayEditor";
import AIActionButton from "./AIActionButton";

type Tab = "scene" | "style" | "audio" | "text" | "ai" | "project";

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

const DEFAULT_AI_PROMPT = "A cinematic, high-quality professional scene, highly detailed, masterpieces";

export default function PropertiesPanel() {
  const { 
    selectedScene, scenes, updateScene, deleteScene, duplicateScene, splitScene, insertScene,
    orientation, setOrientation, applyRandomSoftTransitions, removeAllTransitions, tracks,
    showStatus, generateCaptionsForAllScenes
  } = useEditorContext();
  
  const { scriptData, characterProfiles, selectedVoice, qualityTier, setPollenUsed } = useAppContext();
  
  const [tab, setTab] = useState<Tab>("scene");
  const [genQuality, setGenQuality] = useState<"basic" | "medium" | "pro">("medium");
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isRegeneratingGenericImage, setIsRegeneratingGenericImage] = useState(false);
  const [isRegeneratingNarration, setIsRegeneratingNarration] = useState(false);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [isRegeneratingVideo, setIsRegeneratingVideo] = useState(false);
  const [isRegeneratingGenericVideo, setIsRegeneratingGenericVideo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Build character identity prefix for image prompts to ensure consistency
  const getCharacterPrefix = useCallback((scene: Scene) => {
    if (!scriptData) return "";
    const identities = (scriptData as any).character_identities;
    const profiles = (scriptData as any).characterProfiles || characterProfiles;
    const sceneChars = (scene as any).characters || [];
    const parts: string[] = [];

    if (identities && Object.keys(identities).length > 0) {
      for (const [name, desc] of Object.entries(identities)) {
        if (sceneChars.length === 0 || sceneChars.some((c: string) => c.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.toLowerCase()))) {
          parts.push(`${name}: ${desc}`);
        }
      }
    } else if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        if (sceneChars.length === 0 || sceneChars.some((c: string) => c.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(c.toLowerCase()))) {
          let desc = `${p.name}: ${p.appearance}`;
          if (p.clothing) desc += `, wearing ${p.clothing}`;
          parts.push(desc);
        }
      }
    }

    return parts.length > 0 ? parts.join(". ") + ". " : "";
  }, [scriptData, characterProfiles]);

  if (!selectedScene) {
    return (
      <div className="h-full flex items-center justify-center text-white/20 text-xs">
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
      const charPrefix = getCharacterPrefix(selectedScene as any);
      const basePrompt = selectedScene.visual_prompt.trim() || DEFAULT_AI_PROMPT;
      const enhancedPrompt = charPrefix ? `${basePrompt} Character Reference: ${charPrefix}` : basePrompt;

      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: enhancedPrompt, 
          width: orientation === "16:9" ? 1280 : 720, 
          height: orientation === "16:9" ? 720 : 1280 
        }),
      });
      if (!res.ok) throw new Error(`Image API error: ${res.status}`);
      const data = await res.json();
      if (data.success && data.images?.[0]) {
        updateScene(selectedScene.id, { imageUrl: data.images[0].imageURL });
        setPollenUsed((prev: number) => prev + POLLEN_COSTS.imageGeneration);
        showStatus("Image regenerated successfully", "success");
      } else {
        throw new Error(data.error || "No image returned");
      }
    } catch (err) {
      showStatus(`Image regeneration failed: ${err instanceof Error ? err.message : "Error"}`, "error");
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleRegenerateGenericImage = async () => {
    setIsRegeneratingGenericImage(true);
    try {
      const seed = Math.floor(Math.random() * 100000);
      const basePrompt = selectedScene.visual_prompt.trim() || DEFAULT_AI_PROMPT;
      const w = orientation === "16:9" ? 1280 : 720;
      const h = orientation === "16:9" ? 720 : 1280;
      const url = `https://gen.pollinations.ai/image/${encodeURIComponent(basePrompt)}?model=nanobanana-pro&width=${w}&height=${h}&seed=${seed}&nologo=true`;
      updateScene(selectedScene.id, { imageUrl: url });
      showStatus("Generic photo generated", "success");
    } catch (err) {
      showStatus("Failed to generate generic photo", "error");
    } finally {
      setIsRegeneratingGenericImage(false);
    }
  };

  const handleRegenerateNarration = async () => {
    setIsRegeneratingNarration(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rewrite_narration",
          narration: selectedScene.narration,
          visual_prompt: selectedScene.visual_prompt,
          mood: selectedScene.mood,
        }),
      });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      if (data.narration) {
        updateScene(selectedScene.id, { narration: data.narration });
        showStatus("Narration rewritten successfully", "success");
      }
    } catch (err) {
      showStatus("Narration rewrite failed", "error");
    } finally {
      setIsRegeneratingNarration(false);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!selectedScene.narration) return;
    setIsRegeneratingAudio(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: selectedScene.narration, 
          voice: selectedVoice,
          useEdgeTTS: qualityTier === "basic"
        }),
      });
      if (!res.ok) throw new Error("TTS API Error");
      const data = await res.json();
      if (data.success && data.audioUrl) {
        updateScene(selectedScene.id, { audioUrl: data.audioUrl });
        const ttsCost = qualityTier === "basic" ? 0 : POLLEN_COSTS.ttsGeneration;
        if (ttsCost > 0) setPollenUsed((prev: number) => prev + ttsCost);
        showStatus("Audio generated successfully", "success");
      }
    } catch (err) {
      showStatus("Audio generation failed", "error");
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  const handleRegenerateVideo = async () => {
    setIsRegeneratingVideo(true);
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedScene.visual_prompt.trim() || DEFAULT_AI_PROMPT,
          duration: Math.min(Math.ceil(selectedScene.duration), 15),
          mode: "ai",
        }),
      });
      if (!res.ok) throw new Error("Video API Error");
      const data = await res.json();
      if (data.success && data.videoUrl && !data.useKenBurns) {
        updateScene(selectedScene.id, { aiVideoUrl: data.videoUrl });
        const videoCost = (selectedScene.duration || 8) * POLLEN_COSTS.videoPerSecond;
        setPollenUsed((prev: number) => prev + videoCost);
        showStatus("AI video generated successfully", "success");
      } else {
        showStatus("AI video unavailable. Ken Burns used.", "error");
      }
    } catch (err) {
      showStatus("Video generation failed", "error");
    } finally {
      setIsRegeneratingVideo(false);
    }
  };

  const handleRegenerateGenericVideo = async () => {
    setIsRegeneratingGenericVideo(true);
    try {
      const seed = Math.floor(Math.random() * 100000);
      const aspect = orientation === "16:9" ? "16:9" : "9:16";
      const url = `https://gen.pollinations.ai/video/${encodeURIComponent(selectedScene.visual_prompt)}?model=wan&aspectRatio=${aspect}&seed=${seed}&nologo=true`;
      updateScene(selectedScene.id, { aiVideoUrl: url });
      showStatus("Generic AI Video generated", "success");
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
    { id: "text", label: "Text", icon: "title" },
    { id: "ai", label: "AI", icon: "auto_awesome" },
    { id: "project", label: "Project", icon: "settings" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/20 text-primary font-black text-[10px] shadow-inner">
            {selectedScene.orderIndex + 1}
          </div>
          <div className="flex flex-col">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90 leading-none">Editor</h3>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => updateScene(selectedScene.id, { isLocked: !selectedScene.isLocked })}
            className={`p-1 rounded hover:bg-white/5 ${selectedScene.isLocked ? "text-yellow-400" : "text-white/30"}`}>
            <span className="material-symbols-outlined text-sm">{selectedScene.isLocked ? "lock" : "lock_open"}</span>
          </button>
          <button onClick={handleDelete} className={`p-1 rounded hover:bg-red-500/10 ${showDeleteConfirm ? "text-red-400" : "text-white/30"}`}>
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/10 bg-surface-container-low shadow-sm">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative group ${
              tab === t.id ? "text-primary bg-primary/10" : "text-outline hover:text-on-surface hover:bg-surface-variant/40"
            }`}
          >
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_rgba(37,99,235,0.4)]" />}
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">{t.icon}</span>
            <span className="opacity-90">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        
        {/* SCENE TAB */}
        {tab === "scene" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block font-black">Visual Prompt</label>
                <button 
                  onClick={() => {
                    const improved = selectedScene.visual_prompt + ", ultra detailed, 8k, cinematic lighting, professional photography";
                    updateScene(selectedScene.id, { visual_prompt: improved });
                    showStatus("Prompt enhanced", "success");
                  }}
                  className="text-[10px] text-primary hover:text-primary-container flex items-center gap-1 font-black uppercase tracking-wider"
                >
                   <span className="material-symbols-outlined text-sm">magic_button</span>
                   Enhance
                </button>
              </div>
              <textarea
                value={selectedScene.visual_prompt}
                onChange={(e) => updateScene(selectedScene.id, { visual_prompt: e.target.value })}
                className="w-full h-28 p-4 text-[13px] bg-surface-container-highest/50 border border-outline-variant/20 rounded-2xl focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none leading-relaxed text-on-surface shadow-inner"
                placeholder="Describe the visual scene..."
              />
              <AIActionButton 
                label="AI Rewrite" 
                icon="auto_fix_high" 
                onClick={handleRegenerateNarration} 
                loading={isRegeneratingNarration}
                variant="primary"
                className="w-full shadow-lg shadow-primary/10"
              />
            </div>

            <div className="h-px bg-outline-variant/10" />

            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block font-black">Typography</label>
              <button
                onClick={() => setTab("text")}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface-container-highest/30 border border-outline-variant/10 hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[20px]">title</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[14px] font-black text-on-surface block tracking-tight">Manage Text Overlays</span>
                    <span className="text-[11px] text-outline font-medium">{selectedScene.overlays.length} active layers</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline/30 group-hover:text-primary transition-colors">chevron_right</span>
              </button>
            </div>

            <div className="h-px bg-outline-variant/10" />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block font-black">Duration</label>
                <span className="text-[11px] font-black font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">{selectedScene.duration}s</span>
              </div>
              <input
                type="range" min="1" max="20" step="0.5"
                value={selectedScene.duration}
                onChange={(e) => updateScene(selectedScene.id, { duration: parseFloat(e.target.value) })}
                className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer shadow-inner"
              />
            </div>
          </div>
        )}

        {/* STYLE TAB */}
        {tab === "style" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block mb-3 font-black">Transition</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSITIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateScene(selectedScene.id, { transition: t.value })}
                    className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${
                      selectedScene.transition === t.value 
                        ? "bg-primary/20 text-primary border-primary/40 shadow-lg shadow-primary/5" 
                        : "bg-surface-container-highest/50 text-outline border-transparent hover:border-outline-variant/20 hover:bg-surface-container-highest"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    <span className="truncate w-full text-center">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-outline-variant/10" />

            <div>
              <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block mb-3 font-black">Color Filter</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateScene(selectedScene.id, { filter: f.value })}
                    className={`py-2.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-left transition-all border ${
                      selectedScene.filter === f.value 
                        ? "bg-primary/20 text-primary border-primary/40 shadow-md shadow-primary/5" 
                        : "bg-surface-container-highest/50 text-outline border-transparent hover:border-outline-variant/20 hover:bg-surface-container-highest"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-outline-variant/10" />

            <div>
              <label className="text-[11px] uppercase tracking-widest text-on-surface/70 block mb-3 font-black">Camera Motion</label>
              <div className="grid grid-cols-3 gap-1.5">
                {KEN_BURNS.map(k => (
                  <button
                    key={k.value}
                    onClick={() => updateScene(selectedScene.id, { kenBurns: k.value })}
                    className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${
                      selectedScene.kenBurns === k.value 
                        ? "bg-primary/20 text-primary border-primary/40 shadow-lg shadow-primary/5" 
                        : "bg-surface-container-highest/50 text-outline border-transparent hover:border-outline-variant/20 hover:bg-surface-container-highest"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
                    <span className="truncate w-full text-center">{k.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AUDIO TAB */}
        {tab === "audio" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
               <label className="text-[11px] uppercase tracking-wider text-white/70 block font-bold">Narration Text</label>
               <textarea
                value={selectedScene.narration}
                onChange={(e) => updateScene(selectedScene.id, { narration: e.target.value })}
                className="w-full h-32 p-3 text-[12px] bg-on-surface/[0.04] border border-on-surface/[0.08] rounded-xl focus:border-primary/50 outline-none transition-all resize-none leading-relaxed"
                placeholder="Write narration text..."
              />
              <AIActionButton 
                label="Redo Voiceover" 
                icon="record_voice_over" 
                onClick={handleRegenerateAudio} 
                loading={isRegeneratingAudio}
                variant="emerald"
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-wider text-white/70 block">Scene Volume</label>
              <div className="flex items-center gap-2">
                <button onClick={() => updateScene(selectedScene.id, { isMuted: !selectedScene.isMuted })} className={`p-1 rounded ${selectedScene.isMuted ? "text-red-400" : "text-outline/60"}`}>
                  <span className="material-symbols-outlined text-sm">{selectedScene.isMuted ? "volume_off" : "volume_up"}</span>
                </button>
                <input
                  type="range" min={0} max={100} value={Math.round(selectedScene.volume * 100)}
                  onChange={e => updateScene(selectedScene.id, { volume: Number(e.target.value) / 100 })}
                  className="flex-1 h-1 accent-primary"
                  disabled={selectedScene.isMuted}
                />
              </div>
            </div>
          </div>
        )}

        {/* TEXT TAB */}
        {tab === "text" && (
           <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setTab("scene")} className="p-1 hover:bg-on-surface/[0.06] rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <h3 className="text-[13px] font-black uppercase tracking-tight">Typography Layers</h3>
              </div>

              <button
                onClick={generateCaptionsForAllScenes}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl primary-gradient text-white text-[11px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all border border-primary/20"
              >
                <span className="material-symbols-outlined text-lg">subtitle</span>
                Generate Global Captions
              </button>

              <div className="h-px bg-outline-variant/10 my-2" />
              
              <TextOverlayEditor />
           </div>
        )}

        {/* AI TAB */}
        {tab === "ai" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-on-surface/[0.02] border border-on-surface/[0.06] rounded-2xl p-4 space-y-4 shadow-sm">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/70 block mb-2 font-bold">Generation Quality</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-on-surface/[0.04] rounded-xl border border-on-surface/[0.06]">
                  {["basic", "medium", "pro"].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setGenQuality(q as any);
                        showStatus(`Switched to ${q} quality`, "success");
                      }}
                      className={`py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all ${
                        genQuality === q ? "bg-primary text-on-primary shadow-lg scale-[1.02]" : "text-outline/40 hover:bg-on-surface/[0.05]"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AIActionButton 
                  label="Redo Photo" 
                  icon="image" 
                  onClick={() => genQuality === "basic" ? handleRegenerateGenericImage() : handleRegenerateImage()} 
                  loading={isRegeneratingImage || isRegeneratingGenericImage}
                  variant="primary"
                />
                <AIActionButton 
                  label="Redo Video" 
                  icon="smart_display" 
                  onClick={() => genQuality === "basic" ? handleRegenerateGenericVideo() : handleRegenerateVideo()} 
                  loading={isRegeneratingVideo || isRegeneratingGenericVideo}
                  variant="tertiary"
                />
              </div>
            </div>
          </div>
        )}

        {/* PROJECT TAB */}
        {tab === "project" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/70 block mb-3">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrientation("16:9")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    orientation === "16:9" ? "bg-primary/10 border-primary text-primary" : "bg-on-surface/[0.04] border-transparent text-outline/60"
                  }`}
                >
                  <div className="w-10 h-6 border-2 border-current rounded-sm mb-1 opacity-70" />
                  <span className="text-xs font-bold">16:9 Landscape</span>
                </button>
                <button
                  onClick={() => setOrientation("9:16")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    orientation === "9:16" ? "bg-primary/10 border-primary text-primary" : "bg-on-surface/[0.04] border-transparent text-outline/60"
                  }`}
                >
                  <div className="w-6 h-10 border-2 border-current rounded-sm mb-1 opacity-70" />
                  <span className="text-xs font-bold">9:16 Portrait</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-wider text-white/70 block">Automation</label>
              <button
                onClick={() => { applyRandomSoftTransitions(); showStatus("Cinematic transitions applied", "success"); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 transition-all text-left group"
              >
                <span className="material-symbols-outlined text-primary group-hover:rotate-12 transition-transform">magic_button</span>
                <div>
                  <span className="text-xs font-bold block">Cinematic Transitions</span>
                  <span className="text-[10px] opacity-50">Apply random soft transitions</span>
                </div>
              </button>
              <button
                onClick={() => { removeAllTransitions(); showStatus("All transitions removed", "success"); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-transparent hover:border-red-500/30 transition-all text-left"
              >
                <span className="material-symbols-outlined text-red-400">link_off</span>
                <span className="text-xs font-bold">Clear Transitions</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
