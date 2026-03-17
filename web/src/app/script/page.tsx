"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, Scene } from "@/context/AppContext";

export default function ScriptBuilder() {
  const router = useRouter();
  const { url, angle, scriptData, setScriptData } = useAppContext();
  const [isLoading, setIsLoading] = useState(!scriptData);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [scenePreviewUrl, setScenePreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [enhancedTip, setEnhancedTip] = useState<string | null>(null);

  useEffect(() => {
    if (scriptData) {
      setIsLoading(false);
      if (scriptData.scenes.length > 0) setActiveScene(scriptData.scenes[0]);
      return;
    }
    
    const fetchScript = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url || "https://example.com/mock", angle })
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
          width: 1280,
          height: 720,
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
        <span className="text-outline text-sm font-label uppercase tracking-widest">Project:</span>
        <span className="font-headline font-bold text-on-surface">The Future of AI Cities</span>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-8 w-full mt-4">
        {/* Header Section */}
        <div className="flex items-end justify-between border-b border-outline-variant/5 pb-8">
          <div>
            <span className="font-label text-tertiary text-xs font-bold uppercase tracking-[0.2em] block mb-2">Editor Phase 02</span>
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Generated Story Script</h2>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-2.5 rounded-xl border border-outline-variant/20 font-body text-sm font-semibold hover:bg-surface-container-high transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm" data-icon="edit">edit</span>
              Edit Script
            </button>
            <button onClick={handleGenerateVideo} className="px-8 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-headline font-bold hover:shadow-lg transition-all flex items-center gap-2">
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
            ) : scriptData?.scenes.map((scene: Scene, index: number) => (
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
                  <span className="font-label text-xs text-outline bg-surface-container-low px-2 py-1 rounded">
                    ~{scene.duration_estimate_seconds}s
                  </span>
                </div>
                <p className={`font-body leading-relaxed pl-4 border-l-2 ${activeScene?.id === scene.id ? 'text-on-surface/80 italic border-primary-container' : 'text-on-surface/60 border-outline-variant/30'}`}>
                  "{scene.narration}"
                </p>
                {activeScene?.id === scene.id && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary" data-icon="chevron_right">chevron_right</span>
                  </div>
                )}
              </div>
            ))}

            {/* Add Scene Button */}
            <button className="w-full py-4 border-2 border-dashed border-outline-variant/20 rounded-2xl font-body text-outline hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2">
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
                <label className="font-label text-xs text-outline uppercase tracking-wider font-bold">Scene Prompt</label>
                <textarea 
                  className="w-full bg-surface-container-low border-none rounded-xl p-4 font-body text-sm text-on-surface focus:ring-2 focus:ring-primary/40 resize-none transition-all" 
                  placeholder="Describe the visuals for this scene..." 
                  rows={4} 
                  value={activeScene?.visual_prompt || ""}
                  readOnly
                ></textarea>
              </div>

              {/* Style Selection */}
              <div className="space-y-3">
                <label className="font-label text-xs text-outline uppercase tracking-wider font-bold">Visual Style</label>
                <div className="relative group">
                  <select className="w-full bg-surface-container-low border-none rounded-xl p-4 font-body text-sm text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                    <option>Cinematic</option>
                    <option>Documentary</option>
                    <option>Dark Thriller</option>
                    <option>Luxury Aesthetic</option>
                    <option>Anime</option>
                    <option>News Style</option>
                    <option>Storytime</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline" data-icon="expand_more">expand_more</span>
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
