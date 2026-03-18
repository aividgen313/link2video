"use client";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, Scene } from "@/context/AppContext";
import { calculateModelCost } from "@/lib/pricing";

export default function ScriptBuilder() {
  const router = useRouter();
  const { 
    url, 
    angle, 
    scriptData, 
    setScriptData,
    globalVideoModel, setGlobalVideoModel,
    globalImageModel, setGlobalImageModel,
    globalAudioModel, setGlobalAudioModel,
    qualityTier, setQualityTier,
    globalScriptModel, setGlobalScriptModel,
    globalVisualStyle
  } = useAppContext();
  const [isLoading, setIsLoading] = useState(!scriptData);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [scenePreviewUrl, setScenePreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [enhancedTip, setEnhancedTip] = useState<string | null>(null);

  const estimatedTotalCost = useMemo(() => {
    if (!scriptData || !scriptData.scenes) return 0;
    let totalCost = 0;
    let totalDurationSeconds = 0;

    scriptData.scenes.forEach(scene => {
      const activeVideoModel = scene.video_model_override || globalVideoModel;
      const activeImageModel = scene.image_model_override || globalImageModel;
      
      const videoCost = calculateModelCost(activeVideoModel, "video", scene.duration_estimate_seconds);
      const imageCost = calculateModelCost(activeImageModel, "image");
      
      totalCost += videoCost + imageCost;
      totalDurationSeconds += scene.duration_estimate_seconds;
    });

    const audioCost = calculateModelCost(globalAudioModel, "audio", totalDurationSeconds);
    totalCost += audioCost;

    return totalCost;
  }, [scriptData, globalVideoModel, globalImageModel, globalAudioModel]);

  // Cost Per Minute Estimator (Assuming ~5s scenes = 12 images per minute)
  const costPerMinute = useMemo(() => {
    const videoCost = calculateModelCost(globalVideoModel, "video", 60);
    const audioCost = calculateModelCost(globalAudioModel, "audio", 60);
    const imageCost = calculateModelCost(globalImageModel, "image") * 12;
    return videoCost + audioCost + imageCost;
  }, [globalVideoModel, globalImageModel, globalAudioModel]);

  useEffect(() => {
    if (scriptData) {
      setIsLoading(false);
      if (scriptData.scenes.length > 0) setActiveScene(scriptData.scenes[0]);
      return;
    }
    
    const fetchScript = async () => {
      try {
        setIsLoading(true);
        const isRunware = globalScriptModel.startsWith("runware:");
        const provider = isRunware ? "runware" : "gemini";
        const model = isRunware ? globalScriptModel.replace("runware:", "") : globalScriptModel;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            url: url || "https://example.com/mock", 
            angle,
            provider,
            model,
            visualStyle: globalVisualStyle
          })
        });
        const data = await res.json();
        setScriptData(data);
        if (data.scenes && data.scenes.length > 0) {
          setActiveScene(data.scenes[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScript();
  }, [url, angle, scriptData, setScriptData]);

  const handleGenerateVideo = () => {
    router.push("/generate");
  };

  const handleRegenerateSceneImage = async () => {
    if (!activeScene?.visual_prompt) return;
    setIsGeneratingPreview(true);
    setScenePreviewUrl(null);
    try {
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activeScene.visual_prompt,
          model: activeScene.image_model_override || globalImageModel,
          width: 1280,
          height: 768,
          numberResults: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.images?.[0]) {
        setScenePreviewUrl(data.images[0].imageURL);
      }
    } catch (err) {
      console.error("Preview generation error:", err);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!activeScene?.visual_prompt) return;
    try {
      const res = await fetch("/api/runware/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activeScene.visual_prompt,
          promptMaxLength: 128,
          promptVersions: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.enhancedPrompts?.[0]) {
        setEnhancedTip(data.enhancedPrompts[0].text);
      }
    } catch (err) {
      console.error("Prompt enhance error:", err);
    }
  };

  // When active scene changes, reset preview and fetch enhanced prompt
  useEffect(() => {
    setScenePreviewUrl(null);
    setEnhancedTip(null);
    if (activeScene?.visual_prompt) {
      handleEnhancePrompt();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScene?.id]);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/story" className="text-outline text-sm font-label uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          Back to Story Angle
        </Link>
        <span className="text-outline mx-2">|</span>
        <span className="material-symbols-outlined text-outline">chevron_right</span>
        <span className="font-headline font-bold text-on-surface truncate max-w-[200px]">{scriptData?.title || url || "Draft Script"}</span>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-8 w-full mt-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-outline-variant/5 pb-8 gap-6">
          <div>
            <span className="font-label text-tertiary text-xs font-bold uppercase tracking-[0.2em] block mb-2">Editor Phase 02</span>
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Generated Story Script</h2>
          </div>
          
          {/* Global Model Settings */}
          <div className="flex gap-3 bg-surface-container-low p-2 rounded-2xl items-center border border-outline-variant/10 shadow-sm overflow-x-auto w-full xl:w-auto">
            
            {/* Master Quality Tier Controller */}
            <div className="flex flex-col border-r border-outline-variant/20 pr-3 shrink-0">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-sm" data-icon="diamond">diamond</span>
                <div className="relative group">
                  <select 
                    value={qualityTier}
                    onChange={(e) => setQualityTier(e.target.value)}
                    className="bg-transparent text-primary border-none rounded-xl py-1 pl-2 pr-6 font-label text-xs uppercase font-bold tracking-widest appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  >
                    <option value="Basic">Basic Quality</option>
                    <option value="Medium">Medium Quality</option>
                    <option value="Premium">Premium Quality</option>
                    <option value="Custom">Custom Mix</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-primary text-sm" data-icon="expand_more">expand_more</span>
                </div>
              </div>
              <span className="text-[9px] font-body text-outline font-medium px-2 ml-4">
                Rate: ~${costPerMinute.toFixed(2)} / min
              </span>
            </div>

            <span className="text-[10px] font-label font-bold uppercase tracking-widest text-outline px-2 whitespace-nowrap">Model Defaults:</span>
            
            <div className="relative group shrink-0">
              <select 
                value={globalVideoModel}
                onChange={(e) => {
                  setGlobalVideoModel(e.target.value);
                  setQualityTier("Custom");
                }}
                className="bg-surface-container-highest border-none rounded-xl py-2 pl-3 pr-8 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer min-w-[140px]"
              >
                <option value="klingai:video-3-0-standard">Kling 3.0 Standard</option>
                <option value="klingai:5@3">Kling 1.5</option>
                <option value="klingai:video-3-0-pro">Kling 3.0 Pro</option>
                <option value="lightricks:ltx-2.3">LTX 2.3</option>
                <option value="lightricks:ltx-2.3-fast">LTX 2.3 Fast</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm" data-icon="videocam">videocam</span>
            </div>

            <div className="relative group shrink-0">
              <select 
                value={globalImageModel}
                onChange={(e) => {
                  setGlobalImageModel(e.target.value);
                  setQualityTier("Custom");
                }}
                className="bg-surface-container-highest border-none rounded-xl py-2 pl-3 pr-8 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer min-w-[140px]"
              >
                <option value="runware:101@1">FLUX.1 Dev</option>
                <option value="alibaba:qwen-image-2-0">Qwen Image 2.0</option>
                <option value="bytedance:seedream-5-0-lite">Seedream 5.0 Lite</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm" data-icon="image">image</span>
            </div>
            
            <div className="relative group shrink-0">
              <select 
                value={globalAudioModel}
                onChange={(e) => {
                  setGlobalAudioModel(e.target.value);
                  setQualityTier("Custom");
                }}
                className="bg-surface-container-highest border-none rounded-xl py-2 pl-3 pr-8 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer min-w-[140px]"
              >
                <option value="elevenlabs:1@1">ElevenLabs</option>
                <option value="google:tts-1">Google Cloud TTS</option>
              </select>
            </div>
            
            <div className="relative group shrink-0">
              <select 
                value={globalScriptModel}
                onChange={(e) => setGlobalScriptModel(e.target.value)}
                className="bg-surface-container-highest border-none rounded-xl py-2 pl-3 pr-8 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer min-w-[140px]"
              >
                <option value="runware:meta:llama-3.1-8b-instruct">Runware Llama 8B (Fast & Cheap)</option>
                <option value="runware:minimax:m2.5">Runware MiniMax</option>
                <option value="runware:meta:llama-3.1-70b-instruct">Runware Llama 70B</option>
                <option value="runware:meta:llama-3.1-405b-instruct">Runware Llama 405B</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm" data-icon="edit_note">edit_note</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
            {/* Cost Estimator Badge */}
            <div className="flex flex-col justify-center bg-surface-container-highest px-4 py-2 rounded-xl border border-outline-variant/10">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest font-bold">Estimated Cost</span>
              <div className="flex items-center gap-1">
                <span className="font-headline font-bold text-on-surface">${estimatedTotalCost.toFixed(2)}</span>
                <span className="text-[10px] text-outline font-body">total</span>
              </div>
            </div>

            <button onClick={handleGenerateVideo} className="px-8 py-3 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-headline font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined" data-icon="movie">movie</span>
              Generate Video
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-12 gap-8 pb-20">
          
          {/* Left Side: Script Scenes */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : scriptData?.scenes?.map((scene: Scene, index: number) => (
              <div 
                key={scene.id} 
                onClick={() => setActiveScene(scene)}
                className={`group relative bg-surface-container-high rounded-2xl p-6 border transition-all cursor-pointer ${activeScene?.id === scene.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-outline-variant'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-headline font-bold text-sm ${activeScene?.id === scene.id ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-outline'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className={`font-headline font-bold text-lg ${activeScene?.id === scene.id ? '' : 'text-outline'}`}>Scene {index + 1}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label text-xs text-outline bg-surface-container-low px-2 py-1 rounded">
                      ~{scene.duration_estimate_seconds}s
                    </span>
                    <button 
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-error/10 text-outline hover:text-error transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!scriptData || scriptData.scenes.length <= 1) return;
                        
                        const newScenes = scriptData.scenes.filter(s => s.id !== scene.id);
                        // Re-number scenes
                        newScenes.forEach((s, idx) => s.scene_number = idx + 1);
                        
                        setScriptData({ ...scriptData, scenes: newScenes });
                        if (activeScene?.id === scene.id) {
                          setActiveScene(newScenes[0]);
                        }
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]" data-icon="close">close</span>
                    </button>
                  </div>
                </div>
                <textarea 
                  className={`w-full bg-transparent border-none p-0 font-body leading-relaxed pl-4 border-l-2 resize-none focus:ring-0 ${activeScene?.id === scene.id ? 'text-on-surface/90 border-primary-container' : 'text-on-surface/60 border-outline-variant/30 overflow-hidden'}`}
                  value={scene.narration}
                  rows={activeScene?.id === scene.id ? 4 : 2}
                  onChange={(e) => {
                    if (!scriptData) return;
                    const newScenes = [...scriptData.scenes];
                    newScenes[index] = { ...newScenes[index], narration: e.target.value };
                    setScriptData({ ...scriptData, scenes: newScenes });
                    if (activeScene?.id === scene.id) {
                      setActiveScene(newScenes[index]);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => setActiveScene(scene)}
                  placeholder="Enter narration script for this scene..."
                />
                {activeScene?.id === scene.id && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary" data-icon="chevron_right">chevron_right</span>
                  </div>
                )}
              </div>
            ))}

            {/* Add Scene Button */}
            <button 
              onClick={() => {
                if (!scriptData || !scriptData.scenes) return;
                const newId = Math.max(...(scriptData.scenes?.map(s => s.id) || [0]), 0) + 1;
                const newScene: Scene = {
                  id: newId,
                  scene_number: scriptData.scenes.length + 1,
                  duration_estimate_seconds: 8,
                  narration: "",
                  visual_prompt: ""
                };
                setScriptData({
                  ...scriptData,
                  scenes: [...scriptData.scenes, newScene]
                });
                setActiveScene(newScene);
              }}
              className="w-full py-4 border-2 border-dashed border-outline-variant/20 rounded-2xl font-body text-outline hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" data-icon="add_circle">add_circle</span>
              Insert New Scene
            </button>
          </div>

          {/* Right Side: Visual Prompt Builder */}
          <div className="col-span-12 lg:col-span-5">
            <div className="sticky top-8 bg-surface-container-high rounded-3xl p-8 border border-outline-variant/10 shadow-2xl space-y-8">
              
              <div className="flex items-center justify-between">
                <h3 className="font-headline font-bold text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" data-icon="auto_videocam">auto_videocam</span>
                  Scene Visual Prompt
                </h3>
                <span className="font-label text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full uppercase font-black">
                  Scene {activeScene?.scene_number ? String(activeScene.scene_number).padStart(2, '0') : '01'}
                </span>
              </div>

              {/* Preview Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden group">
                {isGeneratingPreview ? (
                  <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <span className="text-xs text-outline font-body">Generating with Runware FLUX...</span>
                    </div>
                  </div>
                ) : scenePreviewUrl ? (
                  <img className="w-full h-full object-cover" alt="AI Generated Scene Preview" src={scenePreviewUrl} />
                ) : (
                  <img className="w-full h-full object-cover" data-alt="Futuristic cybernetic city with glowing blue lights" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWw1Us6dn05plyX9ELd9d-P8A9fzgTcAAqeCsjy4JkAJAPd7jtHhVRyGJFvJdqCqVBnDDJg4h4lmA6vi6Q5Ituqj0lcfcb5HlMDhwnlCs498lVRiZS87qm_Rrl6Eu1I9YwAB0EHEEu8MOs0RtEhOUP2mtzWI413ZViuISJFWcN-c8KA65jF0Kf6rB_3nQ5RiE1tWsp-3cXfrcrFaz3nZX8Mnl1Zh71Rcyqx_kn2ETlLwzUB86e7MkQlsYPbdR0L0p1tU7VEltiMmz0" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                  <p className="text-xs font-body text-white/70 italic line-clamp-1">Visualizing: {activeScene?.visual_prompt || '...'}</p>
                </div>
                <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-sm" data-icon="fullscreen">fullscreen</span>
                </button>
              </div>

              {/* Prompt Input */}
              <div className="space-y-3">
                <label className="font-label text-xs text-outline uppercase tracking-wider font-bold">Scene Visual Prompt</label>
                <textarea 
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 font-body text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary/40 resize-none transition-all placeholder:text-outline-variant" 
                  placeholder="Describe the visuals for this scene..." 
                  rows={4} 
                  value={activeScene?.visual_prompt || ""}
                  onChange={(e) => {
                    if (!scriptData || !activeScene) return;
                    const sceneIndex = scriptData.scenes.findIndex(s => s.id === activeScene.id);
                    if (sceneIndex === -1) return;
                    
                    const newScenes = [...scriptData.scenes];
                    newScenes[sceneIndex] = { ...newScenes[sceneIndex], visual_prompt: e.target.value };
                    setScriptData({ ...scriptData, scenes: newScenes });
                    setActiveScene(newScenes[sceneIndex]);
                  }}
                ></textarea>
              </div>

              {/* Advanced Model Overrides */}
              <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-outline text-sm" data-icon="tune">tune</span>
                  <h4 className="font-label text-xs text-outline uppercase tracking-wider font-bold">Scene Overrides</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-label text-[10px] text-outline-variant uppercase tracking-widest">Video Model</label>
                    <div className="relative group">
                      <select 
                        value={activeScene?.video_model_override || ""}
                        onChange={(e) => {
                          if (!scriptData || !activeScene) return;
                          const sceneIndex = scriptData.scenes.findIndex(s => s.id === activeScene.id);
                          const newScenes = [...scriptData.scenes];
                          newScenes[sceneIndex] = { ...newScenes[sceneIndex], video_model_override: e.target.value || undefined };
                          setScriptData({ ...scriptData, scenes: newScenes });
                          setActiveScene(newScenes[sceneIndex]);
                        }}
                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-lg p-2.5 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                      >
                        <option value="">Global Default</option>
                        <option value="klingai:video-3-0-standard">Kling 3.0 Std</option>
                        <option value="klingai:5@3">Kling 1.5</option>
                        <option value="klingai:video-3-0-pro">Kling 3.0 Pro</option>
                        <option value="lightricks:ltx-2.3">LTX 2.3</option>
                        <option value="lightricks:ltx-2.3-fast">LTX 2.3 Fast</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm" data-icon="expand_more">expand_more</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-label text-[10px] text-outline-variant uppercase tracking-widest">Image Model</label>
                    <div className="relative group">
                      <select 
                        value={activeScene?.image_model_override || ""}
                        onChange={(e) => {
                          if (!scriptData || !activeScene) return;
                          const sceneIndex = scriptData.scenes.findIndex(s => s.id === activeScene.id);
                          const newScenes = [...scriptData.scenes];
                          newScenes[sceneIndex] = { ...newScenes[sceneIndex], image_model_override: e.target.value || undefined };
                          setScriptData({ ...scriptData, scenes: newScenes });
                          setActiveScene(newScenes[sceneIndex]);
                        }}
                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-lg p-2.5 font-body text-xs text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                      >
                        <option value="">Global Default</option>
                        <option value="runware:101@1">FLUX.1 Dev</option>
                        <option value="alibaba:qwen-image-2-0">Qwen 2.0</option>
                        <option value="bytedance:seedream-5-0-lite">Seedream</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm" data-icon="expand_more">expand_more</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio & Subtitles */}
              <div className="space-y-6 pt-2 border-t border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-sm" data-icon="settings_voice">settings_voice</span>
                  <h4 className="font-label text-xs text-outline uppercase tracking-wider font-bold">Audio &amp; Subtitles</h4>
                </div>

                {/* Voice Provider Selection */}
                <div className="space-y-3">
                  <label className="font-label text-[11px] text-outline-variant uppercase tracking-widest">Voice Provider</label>
                  <div className="relative group">
                    <select className="w-full bg-surface-container-low border-none rounded-xl p-4 font-body text-sm text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                      <option>ElevenLabs (High Fidelity)</option>
                      <option>Google Cloud TTS</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg" data-icon="expand_more">expand_more</span>
                  </div>
                </div>

                {/* Subtitles Toggle & Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-body text-sm font-semibold text-on-surface">Subtitles &amp; Captions</span>
                      <span className="text-[11px] text-outline font-body">Burn-in subtitles into the video</span>
                    </div>
                    <button className="w-12 h-6 rounded-full bg-primary relative transition-colors">
                      <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-on-primary"></div>
                    </button>
                  </div>

                  <button className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 font-body text-sm font-medium text-on-surface/80 hover:bg-surface-container-low hover:text-primary transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-lg" data-icon="text_format">text_format</span>
                      Caption Style Settings
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="tune">tune</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={handleRegenerateSceneImage}
                  disabled={isGeneratingPreview || !activeScene?.visual_prompt}
                  className="flex-1 px-4 py-3 rounded-xl border border-outline-variant/30 font-body text-sm font-semibold hover:bg-surface-container-lowest transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-lg transition-transform duration-500 ${isGeneratingPreview ? 'animate-spin' : 'group-hover:rotate-180'}`} data-icon="refresh">refresh</span>
                  {isGeneratingPreview ? 'Generating...' : 'Generate Scene Preview'}
                </button>
              </div>

              {/* AI Assistance Tip - powered by Runware Prompt Enhancer */}
              <div className="p-4 bg-tertiary/10 rounded-2xl border border-tertiary/20 flex gap-4">
                <span className="material-symbols-outlined text-tertiary" data-icon="lightbulb">lightbulb</span>
                <p className="text-xs font-body text-tertiary-fixed leading-relaxed">
                  <strong className="block mb-1">Runware AI Tip:</strong>
                  {enhancedTip 
                    ? <>Try this enhanced prompt: <em className="text-tertiary">&quot;{enhancedTip}&quot;</em></>
                    : 'Using words like "Anamorphic" or "Volumetric Lighting" will significantly improve the cinematic depth of this scene.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
