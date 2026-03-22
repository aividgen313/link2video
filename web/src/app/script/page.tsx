"use client";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, Scene, QUALITY_TIERS } from "@/context/AppContext";

export default function ScriptBuilder() {
  const router = useRouter();
  const {
    url,
    angle,
    mode,
    scriptData,
    setScriptData,
    qualityTier, setQualityTier,
    globalVisualStyle,
    selectedVoice,
    musicEnabled, setMusicEnabled,
    targetDurationMinutes,
    storyboardImages, setStoryboardImages,
    referenceImages, setReferenceImages,
    storyText,
    characterProfiles,
    lyrics,
    musicSegments,
    audioFile,
    audioDuration,
    youtubeStyleSuffix,
  } = useAppContext();
  const [isLoading, setIsLoading] = useState(!scriptData);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  // Track which scenes are currently generating images
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  // Track if auto-generation has been triggered
  const autoGenTriggered = useRef<Set<number>>(new Set());

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Redirect if no input data
  useEffect(() => {
    if (!hasMounted) return;
    const hasInput = url || storyText || audioFile;
    if (!hasInput && !scriptData) {
      router.push("/");
    }
  }, [hasMounted, url, storyText, audioFile, scriptData, router]);

  const tier = QUALITY_TIERS[qualityTier];
  const estimatedTotalCost = scriptData
    ? (tier.usdPerScene * scriptData.scenes.length).toFixed(4)
    : "0.00";

  // Generate image for a single scene
  const generateSceneImage = useCallback(async (scene: Scene) => {
    if (!scene.visual_prompt || generatingImages[scene.id]) return;

    setGeneratingImages(prev => ({ ...prev, [scene.id]: true }));
    try {
      // All tiers use Pollinations (nanobanana-pro/seedream-pro) for images — NO flux
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visual_prompt,
          width: 1280,
          height: 768,
        }),
      });
      const data = await res.json();
      if (data.success && data.images?.[0]) {
        setStoryboardImages((prev: Record<number, string>) => ({
          ...prev,
          [scene.id]: data.images[0].imageURL,
        }));
      }
    } catch (err) {
      console.error(`Image gen error for scene ${scene.id}:`, err);
    } finally {
      setGeneratingImages(prev => ({ ...prev, [scene.id]: false }));
    }
  }, [qualityTier, generatingImages, setStoryboardImages]);

  // Search for reference images of key subjects (people, locations, brands)
  const searchReferenceImages = useCallback(async (data: any) => {
    if (!data?.scenes) return;
    try {
      // Extract unique subjects from all visual prompts and narrations
      const allText = data.scenes.map((s: any) => `${s.narration} ${s.visual_prompt}`).join(" ");

      // Ask AI to identify key subjects
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "extract-subjects",
          storyText: allText.substring(0, 3000),
        }),
      });
      const subjectData = await res.json();
      if (!subjectData.subjects || subjectData.subjects.length === 0) return;

      // Search for images of each subject
      const imgRes = await fetch("/api/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: subjectData.subjects }),
      });
      const imgData = await imgRes.json();
      if (imgData.subjects) {
        const refMap: Record<string, string[]> = {};
        for (const sub of imgData.subjects) {
          if (sub.images && sub.images.length > 0) {
            refMap[sub.name.toLowerCase()] = sub.images;
          }
        }
        if (Object.keys(refMap).length > 0) {
          console.log("Reference images found:", Object.keys(refMap).join(", "));
          setReferenceImages(refMap);
        }
      }
    } catch (err) {
      console.warn("Reference image search failed (non-critical):", err);
    }
  }, [setReferenceImages]);

  // Auto-generate images for scenes that don't have one yet (2 at a time)
  useEffect(() => {
    if (!scriptData?.scenes || isLoading) return;

    const scenesNeedingImages = scriptData.scenes.filter(
      s => s.visual_prompt && !storyboardImages[s.id] && !generatingImages[s.id] && !autoGenTriggered.current.has(s.id)
    );

    // Generate up to 2 concurrently
    const batch = scenesNeedingImages.slice(0, 2);
    for (const scene of batch) {
      autoGenTriggered.current.add(scene.id);
      generateSceneImage(scene);
    }
  }, [scriptData?.scenes, storyboardImages, generatingImages, isLoading, generateSceneImage]);

  useEffect(() => {
    if (scriptData) {
      setIsLoading(false);
      if (scriptData.scenes.length > 0) setActiveScene(scriptData.scenes[0]);
      return;
    }

    const fetchScript = async () => {
      try {
        setIsLoading(true);
        // Build mode-aware request body
        const requestBody: Record<string, any> = {
          visualStyle: globalVisualStyle,
          durationMinutes: targetDurationMinutes,
          mode,
          ...(youtubeStyleSuffix ? { youtubeStyleSuffix } : {}),
        };
        if (mode === "short-story") {
          requestBody.storyText = storyText;
          requestBody.characterProfiles = characterProfiles;
        } else if (mode === "music-video") {
          requestBody.lyrics = lyrics;
          requestBody.musicSegments = musicSegments;
          requestBody.characterProfiles = characterProfiles;
          if (audioDuration > 0) {
            requestBody.durationMinutes = audioDuration / 60;
          }
        } else {
          requestBody.url = url || "https://example.com/mock";
          requestBody.angle = angle;
        }
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (data.error) {
          setErrorMessage(data.error + (data.message ? `: ${data.message}` : ""));
        } else {
          setScriptData(data);
          setErrorMessage(null);
          if (data.scenes && data.scenes.length > 0) {
            setActiveScene(data.scenes[0]);
          }
          // Search for reference images of key subjects in the background
          searchReferenceImages(data);
        }
      } catch (e) {
        console.error(e);
        setErrorMessage("Failed to generate script. Check your internet connection and try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchScript();
  }, [url, angle, scriptData, setScriptData]);

  const handleGenerateVideo = () => {
    router.push("/storyboard");
  };

  // Continue Writing — AI generates more scenes to extend the script
  const handleContinueWriting = async () => {
    if (!scriptData || isExtending) return;
    setIsExtending(true);
    try {
      const lastScenes = scriptData.scenes.slice(-3);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || scriptData.title,
          angle: scriptData.angle,
          visualStyle: globalVisualStyle,
          durationMinutes: 1,
          continueFrom: lastScenes.map(s => s.narration).join(" "),
          existingTitle: scriptData.title,
        }),
      });
      const data = await res.json();
      if (data.scenes && data.scenes.length > 0) {
        const maxId = Math.max(...scriptData.scenes.map(s => s.id), 0);
        const newScenes = data.scenes.map((s: any, i: number) => ({
          ...s,
          id: maxId + i + 1,
          scene_number: scriptData.scenes.length + i + 1,
        }));
        setScriptData({
          ...scriptData,
          scenes: [...scriptData.scenes, ...newScenes],
        });
      }
    } catch (err) {
      console.error("Continue writing error:", err);
    } finally {
      setIsExtending(false);
    }
  };

  // End Story — AI generates a final concluding scene
  const handleEndStory = async () => {
    if (!scriptData || isExtending) return;
    setIsExtending(true);
    try {
      const lastScenes = scriptData.scenes.slice(-3);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || scriptData.title,
          angle: scriptData.angle,
          visualStyle: globalVisualStyle,
          durationMinutes: 0.2,
          endStory: true,
          continueFrom: lastScenes.map(s => s.narration).join(" "),
          existingTitle: scriptData.title,
        }),
      });
      const data = await res.json();
      if (data.scenes && data.scenes.length > 0) {
        const maxId = Math.max(...scriptData.scenes.map(s => s.id), 0);
        const endScene = {
          ...data.scenes[data.scenes.length - 1],
          id: maxId + 1,
          scene_number: scriptData.scenes.length + 1,
        };
        setScriptData({
          ...scriptData,
          scenes: [...scriptData.scenes, endScene],
        });
      }
    } catch (err) {
      console.error("End story error:", err);
    } finally {
      setIsExtending(false);
    }
  };

  // Calculate script duration
  const scriptDurationSeconds = scriptData?.scenes.reduce((sum, s) => sum + s.duration_estimate_seconds, 0) || 0;
  const scriptDurationFormatted = `${Math.floor(scriptDurationSeconds / 60)}:${String(scriptDurationSeconds % 60).padStart(2, '0')}`;

  // Count images generated vs total
  const totalScenes = scriptData?.scenes.length || 0;
  const imagesReady = scriptData?.scenes.filter(s => storyboardImages[s.id]).length || 0;
  const allImagesReady = totalScenes > 0 && imagesReady === totalScenes;

  if (!hasMounted) return null;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Link href={mode === "link" ? "/story" : "/"} className="text-outline text-sm font-label uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          {mode === "link" ? "Back to Story Angle" : mode === "short-story" ? "Back to Story Input" : "Back to Upload"}
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

          {/* Quality + Settings bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Quality Tier Pills */}
            <div className="flex items-center gap-1 glass p-1 rounded-xl">
              {(["basic", "medium", "pro"] as const).map((t) => {
                const info = QUALITY_TIERS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setQualityTier(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${qualityTier === t ? `${info.bgColor} ${info.color} border ${info.borderColor}` : "text-outline hover:text-on-surface"}`}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>

            {/* Cost Badge */}
            <div className="flex items-center gap-2 glass px-3 py-2 rounded-xl">
              <span className="material-symbols-outlined text-primary text-sm">account_balance_wallet</span>
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider leading-none">Est. Cost</p>
                <p className="font-headline font-bold text-sm text-on-surface">{qualityTier === "basic" ? "FREE" : `$${estimatedTotalCost}`}</p>
              </div>
            </div>

            {/* Music Toggle */}
            <button
              onClick={() => setMusicEnabled(!musicEnabled)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold glass transition-all ${musicEnabled ? "text-primary" : "text-outline"}`}
            >
              <span className="material-symbols-outlined text-sm">{musicEnabled ? "music_note" : "music_off"}</span>
              Music {musicEnabled ? "On" : "Off"}
            </button>

            {/* Images progress indicator */}
            {totalScenes > 0 && (
              <div className="flex items-center gap-2 glass px-3 py-2 rounded-xl">
                <span className="material-symbols-outlined text-sm text-secondary">image</span>
                <span className={`text-xs font-bold ${allImagesReady ? 'text-green-400' : 'text-outline'}`}>
                  {imagesReady}/{totalScenes} images
                </span>
              </div>
            )}

            <button
              onClick={handleGenerateVideo}
              disabled={!allImagesReady}
              className="w-full md:w-auto md:ml-auto primary-gradient text-white px-6 py-2.5 rounded-xl font-headline font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">movie</span>
              {allImagesReady ? 'Generate Video' : `Waiting for images (${imagesReady}/${totalScenes})`}
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-12 gap-8 pb-20">

          {/* Left Side: Script Scenes with Image Previews */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {errorMessage && !isLoading && (
              <div className="bg-error-container border-2 border-error rounded-2xl p-8 mb-6">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-error text-3xl">error</span>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-on-error-container mb-2">Script Generation Failed</h3>
                    <p className="text-on-error-container/80 mb-4">{errorMessage}</p>
                    <button
                      onClick={() => { setErrorMessage(null); setScriptData(null); }}
                      className="px-4 py-2 bg-error text-on-error rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : scriptData?.scenes?.map((scene: Scene, index: number) => (
              <div
                key={scene.id}
                onClick={() => setActiveScene(scene)}
                className={`group relative glass-card rounded-2xl overflow-hidden border transition-all cursor-pointer ${activeScene?.id === scene.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-outline-variant'}`}
              >
                {/* Scene Image Preview */}
                <div className="relative aspect-[16/7] w-full bg-surface-container-highest overflow-hidden">
                  {storyboardImages[scene.id] ? (
                    <img
                      src={storyboardImages[scene.id]}
                      alt={`Scene ${index + 1} preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : generatingImages[scene.id] ? (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <span className="text-[11px] text-outline font-body">Generating image...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
                      <div className="flex flex-col items-center gap-2 text-outline">
                        <span className="material-symbols-outlined text-3xl">image</span>
                        <span className="text-[11px] font-body">No image yet</span>
                      </div>
                    </div>
                  )}

                  {/* Image overlay controls */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <p className="text-[10px] text-white/60 italic line-clamp-1 flex-1 mr-2">
                      {scene.visual_prompt?.substring(0, 80)}...
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reset auto-gen tracking so it can be re-triggered
                        autoGenTriggered.current.delete(scene.id);
                        // Remove existing image to force regeneration
                        setStoryboardImages((prev: Record<number, string>) => {
                          const copy = { ...prev };
                          delete copy[scene.id];
                          return copy;
                        });
                        generateSceneImage(scene);
                      }}
                      disabled={generatingImages[scene.id]}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-md text-white text-[11px] font-bold hover:bg-white/25 transition-all disabled:opacity-50"
                    >
                      <span className={`material-symbols-outlined text-sm ${generatingImages[scene.id] ? 'animate-spin' : ''}`}>refresh</span>
                      {generatingImages[scene.id] ? 'Generating...' : 'Regenerate'}
                    </button>
                  </div>

                  {/* Status badge */}
                  <div className="absolute top-2 right-2">
                    {storyboardImages[scene.id] ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 backdrop-blur-md text-green-400 text-[10px] font-bold">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        Ready
                      </span>
                    ) : generatingImages[scene.id] ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 backdrop-blur-md text-primary text-[10px] font-bold">
                        <div className="w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        Generating
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Scene text content */}
                <div className="p-6">
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
                          newScenes.forEach((s, idx) => s.scene_number = idx + 1);

                          setScriptData({ ...scriptData, scenes: newScenes });
                          if (activeScene?.id === scene.id) {
                            setActiveScene(newScenes[0]);
                          }
                          // Clean up image
                          setStoryboardImages((prev: Record<number, string>) => {
                            const copy = { ...prev };
                            delete copy[scene.id];
                            return copy;
                          });
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
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
                </div>
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
              <span className="material-symbols-outlined">add_circle</span>
              Insert New Scene
            </button>

            {/* Script Duration + Continue/End Buttons */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-outline">
                  Script Duration: <span className="font-bold text-on-surface">{scriptDurationFormatted}</span>
                  <span className="text-outline/60"> · {scriptData?.scenes.length || 0} scenes</span>
                </span>
                <span className="text-xs text-outline">
                  Target: <span className="font-bold text-on-surface">{targetDurationMinutes} min</span>
                </span>
              </div>
              {/* Hide continue/end for music video mode (fixed to audio structure) */}
              {mode !== "music-video" && (
                <div className="flex gap-3">
                  <button
                    onClick={handleContinueWriting}
                    disabled={isExtending || isLoading}
                    className="flex-1 py-3 rounded-2xl font-body font-bold text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {isExtending ? (
                      <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Writing...</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">add</span> Continue Writing</>
                    )}
                  </button>
                  <button
                    onClick={handleEndStory}
                    disabled={isExtending || isLoading}
                    className="flex-1 py-3 rounded-2xl font-body font-bold text-sm bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {isExtending ? (
                      <><div className="w-4 h-4 border-2 border-tertiary/30 border-t-tertiary rounded-full animate-spin" /> Writing...</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">flag</span> End Story</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Visual Prompt Editor for Active Scene */}
          <div className="col-span-12 lg:col-span-5">
            <div className="sticky top-8 glass-card rounded-3xl p-8 shadow-2xl space-y-8">

              <div className="flex items-center justify-between">
                <h3 className="font-headline font-bold text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_videocam</span>
                  Scene Visual Prompt
                </h3>
                <span className="font-label text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full uppercase font-black">
                  Scene {activeScene?.scene_number ? String(activeScene.scene_number).padStart(2, '0') : '01'}
                </span>
              </div>

              {/* Active Scene Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden group">
                {activeScene && storyboardImages[activeScene.id] ? (
                  <img className="w-full h-full object-cover" alt="Scene Preview" src={storyboardImages[activeScene.id]} />
                ) : activeScene && generatingImages[activeScene.id] ? (
                  <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <span className="text-xs text-outline font-body">Generating preview...</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-outline">
                      <span className="material-symbols-outlined text-4xl">image</span>
                      <span className="text-xs font-body">Edit prompt and generate</span>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                  <p className="text-xs font-body text-white/70 italic line-clamp-1">Visualizing: {activeScene?.visual_prompt || '...'}</p>
                </div>
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

              {/* Scene info */}
              <div className="pt-4 border-t border-outline-variant/10">
                <div className="flex items-center justify-between text-xs text-outline">
                  <span className="font-label uppercase tracking-widest">Duration</span>
                  <span className="font-bold text-on-surface">~{activeScene?.duration_estimate_seconds || 8}s</span>
                </div>
              </div>

              {/* Audio & Subtitles */}
              <div className="space-y-6 pt-2 border-t border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-sm">settings_voice</span>
                  <h4 className="font-label text-xs text-outline uppercase tracking-wider font-bold">Audio &amp; Subtitles</h4>
                </div>

                <div className="space-y-3">
                  <label className="font-label text-[11px] text-outline-variant uppercase tracking-widest">Voice Provider</label>
                  <div className="relative group">
                    <select className="w-full bg-surface-container-low border-none rounded-xl p-4 font-body text-sm text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                      <option>ElevenLabs (High Fidelity)</option>
                      <option>Google Cloud TTS</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                  </div>
                </div>

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
                      <span className="material-symbols-outlined text-lg">text_format</span>
                      Caption Style Settings
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">tune</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    if (!activeScene) return;
                    autoGenTriggered.current.delete(activeScene.id);
                    setStoryboardImages((prev: Record<number, string>) => {
                      const copy = { ...prev };
                      delete copy[activeScene.id];
                      return copy;
                    });
                    generateSceneImage(activeScene);
                  }}
                  disabled={!activeScene?.visual_prompt || (activeScene ? generatingImages[activeScene.id] : false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-outline-variant/30 font-body text-sm font-semibold hover:bg-surface-container-lowest transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-lg transition-transform duration-500 ${activeScene && generatingImages[activeScene.id] ? 'animate-spin' : 'group-hover:rotate-180'}`}>refresh</span>
                  {activeScene && generatingImages[activeScene.id] ? 'Generating...' : 'Regenerate Image'}
                </button>
              </div>

              {/* AI Tip */}
              <div className="p-4 bg-tertiary/10 rounded-2xl border border-tertiary/20 flex gap-3">
                <span className="material-symbols-outlined text-tertiary shrink-0">lightbulb</span>
                <p className="text-xs font-body text-on-surface leading-relaxed">
                  <strong className="block mb-1 text-tertiary">Pro Tip</strong>
                  Images auto-generate for each scene. Hover over any scene image and click <em>&quot;Regenerate&quot;</em> to get a new one. Edit the visual prompt on the right to fine-tune before regenerating.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
