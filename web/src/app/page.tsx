"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VOICES, VIDEO_DIMENSIONS, QUALITY_TIERS, QualityTier, AppMode, CharacterProfile, POLLEN_COSTS } from "@/context/AppContext";

const DURATION_PRESETS = [
  { label: "1 min", value: 1 },
  { label: "3 min", value: 3 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "120 min", value: 120 },
];
import { getHistory, deleteFromHistory, type VideoHistoryItem } from "@/lib/videoHistory";
import { getSavedStyles, saveStyle, deleteStyle, type SavedStyle } from "@/lib/savedStyles";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Video STYLE templates
const STYLE_TEMPLATES = [
  { label: "POV Scenario", icon: "person_play", description: "Immersive 2nd-person day-in-the-life experience", prefix: "POV: ", placeholder: "Your life after winning the $500 million lottery", example: "POV: Your life after winning the $500 million lottery" },
  { label: "POV Levels", icon: "leaderboard", description: "2nd-person tier-by-tier progression from bottom to top", prefix: "POV | Your life as every ", placeholder: "NBA level", example: "POV | Your life as every NBA level" },
  { label: "Every Level", icon: "trending_up", description: "3rd-person breakdown of each wealth/skill tier", prefix: "Every level of ", placeholder: "wealth explained by how you wake up", example: "Every level of wealth explained by how you wake up" },
  { label: "Origin Story", icon: "attach_money", description: "How someone built extraordinary wealth from nothing", prefix: "How ", placeholder: "Black athletes ACTUALLY become billionaires", example: "How Black athletes ACTUALLY become billionaires" },
  { label: "Quit Your Job", icon: "work_off", description: "Side hustle / passive income / escape the 9-5 blueprint", prefix: "", placeholder: "How I quit my 9-5 and now make $30K/month from home", example: "How I quit my 9-5 and now make $30K/month from home" },
  { label: "Dark Truth", icon: "visibility", description: "Exposé revealing hidden truths behind industries or people", prefix: "The dark truth about ", placeholder: "why most millionaires are secretly broke", example: "The dark truth about why most millionaires are secretly broke" },
  { label: "Explainer", icon: "school", description: "Simple breakdown of complex topics anyone can understand", prefix: "Simply explaining ", placeholder: "why the stock market actually crashes", example: "Simply explaining why the stock market actually crashes" },
  { label: "Documentary", icon: "movie", description: "Cinematic Netflix-style deep-dive with dramatic tension", prefix: "", placeholder: "The rise and fall of the world's youngest billionaire", example: "The rise and fall of the world's youngest billionaire" },
];

const VISUAL_STYLES = [
  { value: "Cinematic Documentary", label: "Cinematic Documentary" },
  { value: "Photorealistic", label: "Photorealistic" },
  { value: "Film Noir", label: "Film Noir" },
  { value: "70s Retro Film", label: "70s Retro Film" },
  { value: "80s VHS Aesthetic", label: "80s VHS Aesthetic" },
  { value: "90s Camcorder", label: "90s Camcorder" },
  { value: "Golden Hour Cinema", label: "Golden Hour Cinema" },
  { value: "Neon Noir", label: "Neon Noir" },
  { value: "Wes Anderson", label: "Wes Anderson" },
  { value: "Christopher Nolan", label: "Christopher Nolan" },
  { value: "Tarantino Grindhouse", label: "Tarantino Grindhouse" },
  { value: "Blade Runner Cyberpunk", label: "Blade Runner Cyberpunk" },
  { value: "IMAX Documentary", label: "IMAX Documentary" },
  { value: "Drone Footage", label: "Drone Footage" },
  { value: "Animated Storytime", label: "Animated Storytime" },
  { value: "3D Render", label: "3D Render (Pixar)" },
  { value: "Anime", label: "Anime (Studio Ghibli)" },
  { value: "Manga Panel", label: "Manga Panel" },
  { value: "Comic Book", label: "Comic Book" },
  { value: "Graphic Novel", label: "Graphic Novel" },
  { value: "Flat Vector", label: "Flat Vector" },
  { value: "Isometric 3D", label: "Isometric 3D" },
  { value: "Claymation", label: "Claymation" },
  { value: "Stop Motion", label: "Stop Motion" },
  { value: "Papercraft", label: "Papercraft" },
  { value: "Storybook Illustration", label: "Storybook Illustration" },
  { value: "Pixel Art", label: "Pixel Art" },
  { value: "Retro Game", label: "Retro Game" },
  { value: "Low Poly 3D", label: "Low Poly 3D" },
  { value: "Chibi Cartoon", label: "Chibi Cartoon" },
  { value: "Oil Painting", label: "Oil Painting" },
  { value: "Watercolor", label: "Watercolor" },
  { value: "Charcoal Sketch", label: "Charcoal Sketch" },
  { value: "Pencil Drawing", label: "Pencil Drawing" },
  { value: "Renaissance Art", label: "Renaissance Art" },
  { value: "Impressionist", label: "Impressionist" },
  { value: "Surrealism", label: "Surrealism (Dali)" },
  { value: "Pop Art", label: "Pop Art (Warhol)" },
  { value: "Art Deco", label: "Art Deco" },
  { value: "Ukiyo-e Japanese", label: "Ukiyo-e Japanese" },
  { value: "Graffiti Street Art", label: "Graffiti Street Art" },
  { value: "Collage Mixed Media", label: "Collage Mixed Media" },
  { value: "Portrait Photography", label: "Portrait Photography" },
  { value: "Street Photography", label: "Street Photography" },
  { value: "Fashion Editorial", label: "Fashion Editorial" },
  { value: "Sports Action", label: "Sports Action" },
  { value: "Macro Close-Up", label: "Macro Close-Up" },
  { value: "Aerial Photography", label: "Aerial Photography" },
  { value: "Black and White", label: "Black and White" },
  { value: "Polaroid Vintage", label: "Polaroid Vintage" },
  { value: "Tilt-Shift Miniature", label: "Tilt-Shift Miniature" },
  { value: "Long Exposure", label: "Long Exposure" },
  { value: "Dark Fantasy", label: "Dark Fantasy" },
  { value: "Gothic Horror", label: "Gothic Horror" },
  { value: "Dystopian", label: "Dystopian" },
  { value: "Post-Apocalyptic", label: "Post-Apocalyptic" },
  { value: "Sci-Fi Futuristic", label: "Sci-Fi Futuristic" },
  { value: "Cyberpunk 2077", label: "Cyberpunk 2077" },
  { value: "Vaporwave", label: "Vaporwave" },
  { value: "Synthwave", label: "Synthwave" },
  { value: "Holographic", label: "Holographic" },
  { value: "National Geographic", label: "National Geographic" },
  { value: "Luxury Lifestyle", label: "Luxury Lifestyle" },
  { value: "Minimalist Clean", label: "Minimalist Clean" },
  { value: "Vintage Sepia", label: "Vintage Sepia" },
];

const MODE_TABS: { mode: AppMode; label: string; icon: string; desc: string }[] = [
  { mode: "link", label: "Link / Topic", icon: "link", desc: "Paste a URL or topic" },
  { mode: "short-story", label: "Short Story", icon: "auto_stories", desc: "Paste or write a story" },
  { mode: "music-video", label: "Music Video", icon: "music_note", desc: "Upload audio + lyrics" },
];

export default function Home() {
  const router = useRouter();
  const {
    url, setUrl,
    mode, setMode,
    qualityTier, setQualityTier,
    globalVisualStyle, setGlobalVisualStyle,
    videoDimension, setVideoDimension,
    selectedVoice, setSelectedVoice,
    musicEnabled, setMusicEnabled,
    captionsEnabled, setCaptionsEnabled,
    targetDurationMinutes, setTargetDurationMinutes,
    creditsUsed,
    storyText, setStoryText,
    characterProfiles, setCharacterProfiles,
    audioFile, setAudioFile,
    audioFileName, setAudioFileName,
    lyrics, setLyrics,
    musicSegments, setMusicSegments,
    audioDuration, setAudioDuration,
    setScriptData,
    setStoryboardImages,
    setFinalVideoUrl,
    setYoutubeStyleSuffix,
    setGenerateRequested,
  } = useAppContext();

  const [inputValue, setInputValue] = useState(url || "");
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [recentVideos, setRecentVideos] = useState<VideoHistoryItem[]>([]);
  const [isExtractingChars, setIsExtractingChars] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pollinations balance
  const [pollenBalance, setPollenBalance] = useState<number | null>(null);
  const [pollenTier, setPollenTier] = useState<string | null>(null);
  const [pollenResetAt, setPollenResetAt] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // YouTube Style Clone
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAnalyzingYT, setIsAnalyzingYT] = useState(false);
  const [analyzedStyle, setAnalyzedStyle] = useState<SavedStyle | null>(null);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [showStyleClone, setShowStyleClone] = useState(false);
  const [appliedStyleId, setAppliedStyleId] = useState<string | null>(null);

  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => { if (hasMounted) { setRecentVideos(getHistory()); setSavedStyles(getSavedStyles()); } }, [hasMounted]);

  // Fetch Pollinations balance on mount
  useEffect(() => {
    if (!hasMounted) return;
    const fetchBalance = async () => {
      setBalanceLoading(true);
      try {
        const res = await fetch("/api/balance");
        if (!res.ok) throw new Error("Balance fetch failed");
        const data = await res.json();
        setPollenBalance(data.balance ?? 0);
        setPollenTier(data.tier || null);
        setPollenResetAt(data.nextResetAt || null);
      } catch {
        setPollenBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [hasMounted]);

  const handleGenerate = () => {
    // Reset previous generation state
    setScriptData(null);
    setStoryboardImages({});
    setFinalVideoUrl(null);
    setGenerateRequested(true); // Signal that user explicitly requested generation

    if (mode === "link") {
      if (!inputValue.trim()) return;
      setUrl(inputValue);
      router.push("/story");
    } else if (mode === "short-story") {
      if (!storyText.trim()) return;
      setUrl(storyText.substring(0, 100)); // for display purposes
      router.push("/script");
    } else if (mode === "music-video") {
      if (!audioFile) return;
      setUrl(audioFileName || "Music Video");
      router.push("/script");
    }
  };

  // Extract characters from story text via AI
  const handleExtractCharacters = async () => {
    if (!storyText.trim() || isExtractingChars) return;
    setIsExtractingChars(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "extract-characters",
          storyText: storyText.substring(0, 5000),
        }),
      });
      if (!res.ok) {
        throw new Error(`Character extraction failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.characters && Array.isArray(data.characters)) {
        setCharacterProfiles(data.characters);
      }
    } catch (err) {
      console.error("Character extraction error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to extract characters. Please try again.");
    } finally {
      setIsExtractingChars(false);
    }
  };

  // Handle audio file upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);

    // Read as base64
    const reader = new FileReader();
    reader.onload = () => {
      setAudioFile(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Get duration via Web Audio API
    const arrayBuffer = await file.arrayBuffer();
    try {
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioDuration(audioBuffer.duration);
      setTargetDurationMinutes(Math.ceil(audioBuffer.duration / 60));
      audioCtx.close();
    } catch {
      // Fallback: estimate from file size (~16KB/s for 128kbps MP3)
      const estimatedDuration = file.size / 16000;
      setAudioDuration(estimatedDuration);
      setTargetDurationMinutes(Math.ceil(estimatedDuration / 60));
    }
  };

  // Analyze audio segments
  const handleAnalyzeAudio = async () => {
    if (!audioDuration || isAnalyzingAudio) return;
    setIsAnalyzingAudio(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/analyze-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: lyrics || "",
          durationSeconds: Math.round(audioDuration),
        }),
      });
      if (!res.ok) throw new Error(`Audio analysis failed (HTTP ${res.status})`);
      const data = await res.json();
      if (data.segments) {
        setMusicSegments(data.segments);
      }
    } catch (err) {
      console.error("Audio analysis error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to analyze audio");
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // Analyze YouTube video style
  const handleAnalyzeYouTube = async () => {
    if (!youtubeUrl.trim() || isAnalyzingYT) return;
    setIsAnalyzingYT(true);
    setAnalyzedStyle(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/analyze-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });
      if (!res.ok) throw new Error(`YouTube analysis failed (HTTP ${res.status})`);
      const data = await res.json();
      if (data.success && data.style) {
        const style: SavedStyle = {
          id: `yt_${Date.now()}`,
          ...data.style,
        };
        setAnalyzedStyle(style);
        // Auto-apply the visual style
        applyStyle(style);
      } else {
        setErrorMsg(data.error || "Failed to analyze video style");
      }
    } catch (err) {
      console.error("YouTube analysis error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to analyze video. Check the URL and try again.");
    } finally {
      setIsAnalyzingYT(false);
    }
  };

  const applyStyle = (style: SavedStyle) => {
    // Find closest matching visual style or set directly
    const match = VISUAL_STYLES.find(v => v.value.toLowerCase() === style.visualStyle?.toLowerCase());
    if (match) {
      setGlobalVisualStyle(match.value);
    } else if (style.visualStyle) {
      setGlobalVisualStyle(style.visualStyle);
    }
    // Set the visual prompt suffix so it gets appended to every scene
    setYoutubeStyleSuffix(style.visualPromptSuffix || "");
    setAppliedStyleId(style.id);
  };

  const handleSaveStyle = (style: SavedStyle) => {
    saveStyle(style);
    setSavedStyles(getSavedStyles());
  };

  const handleDeleteStyle = (id: string) => {
    deleteStyle(id);
    setSavedStyles(getSavedStyles());
    if (appliedStyleId === id) setAppliedStyleId(null);
  };

  const tier = QUALITY_TIERS[qualityTier];
  const sceneCount = Math.ceil(targetDurationMinutes * 60 / 8);
  // Calculate video scene breakdown
  const strat: string = tier.videoSceneStrategy;
  const videoScenes = strat === "all" ? sceneCount
    : strat === "alternating" ? Math.ceil(sceneCount / 2)
    : strat === "key_scenes" ? Math.min((tier as any).maxVideoScenes || 3, sceneCount)
    : 0;
  const kenBurnsScenes = sceneCount - videoScenes;

  // Estimate number of scenes based on duration (~7 scenes per minute)
  const estScenes = Math.max(1, Math.round(targetDurationMinutes * 7));

  // Calculate pollen costs
  const imageCostPollen = POLLEN_COSTS.imageGeneration * estScenes;
  const ttsCostPollen = POLLEN_COSTS.ttsGeneration * estScenes;
  const avgVideoDuration = POLLEN_COSTS.avgSceneDuration;
  const videoScenesCount = qualityTier === "pro" ? estScenes
    : qualityTier === "medium" ? Math.ceil(estScenes / 2)
    : 0;
  const videoCostPollen = videoScenesCount * avgVideoDuration * POLLEN_COSTS.videoPerSecond;
  const musicCostPollen = musicEnabled ? POLLEN_COSTS.musicGeneration : 0;
  const totalPollen = POLLEN_COSTS.textGeneration + imageCostPollen + ttsCostPollen + videoCostPollen + musicCostPollen;

  const canGenerate = mode === "link" ? inputValue.trim().length > 0
    : mode === "short-story" ? storyText.trim().length > 0
    : mode === "music-video" ? !!audioFile
    : false;

  return (
    <>
      <div className="max-w-3xl mx-auto w-full">
        <div className="glass-card rounded-[2rem] p-6 md:p-10 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary/8 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-headline text-2xl md:text-4xl font-extrabold tracking-tighter">Create New Video</h3>

              {/* Pollinations Balance Widget */}
              {hasMounted && (
                <div className="shrink-0">
                  {balanceLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass">
                      <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-[10px] text-outline">Loading...</span>
                    </div>
                  ) : pollenBalance !== null ? (
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${pollenBalance > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-base ${pollenBalance > 0 ? "text-emerald-400" : "text-red-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {pollenBalance > 0 ? "eco" : "warning"}
                        </span>
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold font-headline tabular-nums ${pollenBalance > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {pollenBalance.toFixed(4)} <span className="text-[10px] font-normal opacity-70">pollen</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {pollenTier && (
                              <span className="text-[9px] uppercase font-bold tracking-wider text-outline/60">
                                {pollenTier}
                              </span>
                            )}
                            {pollenResetAt && (
                              <span className="text-[9px] text-outline/40">
                                · resets {new Date(pollenResetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {pollenBalance === 0 && (
                        <a
                          href="https://pollinations.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                        >
                          Add Credits →
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex gap-2 p-1 bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl">
              {MODE_TABS.map((tab) => (
                <button
                  key={tab.mode}
                  onClick={() => setMode(tab.mode)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all ${
                    mode === tab.mode
                      ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                      : "text-outline hover:text-on-surface hover:bg-surface-variant/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden text-xs">{tab.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-error/10 border border-error/20 animate-in fade-in">
                <span className="material-symbols-outlined text-error text-lg shrink-0 mt-0.5">error</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-error font-medium">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-error/60 hover:text-error transition-colors shrink-0">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* ===== LINK/TOPIC MODE ===== */}
            {mode === "link" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Paste a link or topic</label>
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-5 pr-12 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-base"
                      placeholder="Wikipedia link, news article, or story idea..."
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">link</span>
                    </button>
                  </div>
                </div>

                {/* Video Style Templates */}
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Video Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STYLE_TEMPLATES.map((s) => {
                      const isActive = activeStyle === s.label;
                      return (
                        <button
                          key={s.label}
                          onClick={() => { setInputValue(s.example); setActiveStyle(s.label); }}
                          className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${isActive ? "bg-primary/10 border-primary/30 text-primary" : "glass border-outline-variant/10 text-outline hover:text-primary hover:border-primary/20"}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base">{s.icon}</span>
                            <span className="font-bold text-sm">{s.label}</span>
                          </div>
                          <span className="text-[10px] leading-tight opacity-70">{s.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ===== SHORT STORY MODE ===== */}
            {mode === "short-story" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Paste or write your story</label>
                  <textarea
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-sm leading-relaxed resize-none"
                    placeholder="Once upon a time, in a city that never sleeps..."
                    rows={8}
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-outline pl-1">{storyText.length} characters · ~{Math.ceil(storyText.split(/\s+/).filter(Boolean).length / 150)} min read</p>
                    <button
                      onClick={handleExtractCharacters}
                      disabled={!storyText.trim() || isExtractingChars}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all disabled:opacity-40"
                    >
                      {isExtractingChars ? (
                        <><div className="w-3 h-3 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /> Extracting...</>
                      ) : (
                        <><span className="material-symbols-outlined text-sm">person_search</span> Extract Characters</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Character Profiles */}
                {characterProfiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Character Profiles ({characterProfiles.length})</label>
                      <button
                        onClick={() => setCharacterProfiles([...characterProfiles, { id: `char_${Date.now()}`, name: "", appearance: "", role: "supporting" }])}
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">add</span> Add Character
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {characterProfiles.map((cp, idx) => (
                        <div key={cp.id} className="glass p-3 rounded-xl border border-outline-variant/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 bg-transparent border-none text-sm font-bold text-on-surface placeholder:text-outline/50 focus:ring-0 p-0"
                              placeholder="Character Name"
                              value={cp.name}
                              onChange={(e) => {
                                const updated = [...characterProfiles];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setCharacterProfiles(updated);
                              }}
                            />
                            <select
                              value={cp.role}
                              onChange={(e) => {
                                const updated = [...characterProfiles];
                                updated[idx] = { ...updated[idx], role: e.target.value };
                                setCharacterProfiles(updated);
                              }}
                              className="bg-surface-container-low border-none rounded-lg px-2 py-1 text-[10px] font-bold text-outline appearance-none"
                            >
                              <option value="protagonist">Protagonist</option>
                              <option value="antagonist">Antagonist</option>
                              <option value="supporting">Supporting</option>
                            </select>
                            <button
                              onClick={() => setCharacterProfiles(characterProfiles.filter((_, i) => i !== idx))}
                              className="text-outline hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                          <textarea
                            className="w-full bg-transparent border-none text-[11px] text-on-surface/70 placeholder:text-outline/40 focus:ring-0 p-0 resize-none leading-relaxed"
                            placeholder="Physical appearance: skin tone, hair, build, age, clothing..."
                            rows={2}
                            value={cp.appearance}
                            onChange={(e) => {
                              const updated = [...characterProfiles];
                              updated[idx] = { ...updated[idx], appearance: e.target.value };
                              setCharacterProfiles(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== MUSIC VIDEO MODE ===== */}
            {mode === "music-video" && (
              <>
                {/* Audio Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Upload Audio File</label>
                  <input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={handleAudioUpload} className="hidden" />
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className={`w-full py-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                      audioFile
                        ? "border-primary/40 bg-primary/5"
                        : "border-outline-variant/20 hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl text-outline">{audioFile ? "audio_file" : "upload_file"}</span>
                    {audioFile ? (
                      <div className="text-center">
                        <p className="font-bold text-sm text-on-surface">{audioFileName}</p>
                        <p className="text-[11px] text-outline">{Math.floor(audioDuration / 60)}:{String(Math.round(audioDuration % 60)).padStart(2, '0')} duration</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="font-bold text-sm text-outline">Click to upload MP3, WAV, M4A</p>
                        <p className="text-[10px] text-outline/60">Max recommended: 10 minutes</p>
                      </div>
                    )}
                  </button>
                </div>

                {/* Lyrics Input */}
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Lyrics (optional — improves scene accuracy)</label>
                  <textarea
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3 px-4 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-sm leading-relaxed resize-none"
                    placeholder="Paste song lyrics here..."
                    rows={5}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />
                </div>

                {/* Analyze Button */}
                {audioFile && (
                  <button
                    onClick={handleAnalyzeAudio}
                    disabled={isAnalyzingAudio}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all disabled:opacity-40"
                  >
                    {isAnalyzingAudio ? (
                      <><div className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /> Analyzing Song Structure...</>
                    ) : (
                      <><span className="material-symbols-outlined text-lg">equalizer</span> Analyze Song Structure ({musicSegments.length > 0 ? `${musicSegments.length} segments` : "auto-detect"})</>
                    )}
                  </button>
                )}

                {/* Segments Preview */}
                {musicSegments.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Song Structure ({musicSegments.length} segments)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {musicSegments.map((seg) => (
                        <span
                          key={seg.id}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                            seg.type === "chorus" ? "bg-primary/10 text-primary border-primary/20"
                            : seg.type === "verse" ? "bg-secondary/10 text-secondary border-secondary/20"
                            : seg.type === "bridge" ? "bg-tertiary/10 text-tertiary border-tertiary/20"
                            : "bg-surface-variant/30 text-outline border-outline-variant/20"
                          }`}
                        >
                          {seg.type} ({seg.endTime - seg.startTime}s)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Character Profiles for Music Video (optional) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Artist / Character Profiles (optional)</label>
                    <button
                      onClick={() => setCharacterProfiles([...characterProfiles, { id: `char_${Date.now()}`, name: "", appearance: "", role: "protagonist" }])}
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> Add
                    </button>
                  </div>
                  {characterProfiles.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {characterProfiles.map((cp, idx) => (
                        <div key={cp.id} className="glass p-3 rounded-xl border border-outline-variant/10 flex items-center gap-2">
                          <input
                            className="flex-1 bg-transparent border-none text-sm font-bold text-on-surface placeholder:text-outline/50 focus:ring-0 p-0"
                            placeholder="Name"
                            value={cp.name}
                            onChange={(e) => {
                              const updated = [...characterProfiles];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setCharacterProfiles(updated);
                            }}
                          />
                          <input
                            className="flex-[2] bg-transparent border-none text-[11px] text-on-surface/70 placeholder:text-outline/40 focus:ring-0 p-0"
                            placeholder="Appearance description..."
                            value={cp.appearance}
                            onChange={(e) => {
                              const updated = [...characterProfiles];
                              updated[idx] = { ...updated[idx], appearance: e.target.value };
                              setCharacterProfiles(updated);
                            }}
                          />
                          <button onClick={() => setCharacterProfiles(characterProfiles.filter((_, i) => i !== idx))} className="text-outline hover:text-error">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quality Tier */}
            <div className="space-y-2">
              <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Quality</label>
              <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest/50 border border-outline-variant/10 p-1.5 rounded-2xl">
                {(["basic", "medium", "pro"] as QualityTier[]).map((t) => {
                  const info = QUALITY_TIERS[t];
                  const isActive = qualityTier === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setQualityTier(t)}
                      className={`py-2.5 px-2 rounded-xl flex flex-col items-center gap-0.5 transition-all ${isActive ? `${info.bgColor} ${info.color} border ${info.borderColor}` : "text-outline hover:bg-surface-variant/30"}`}
                    >
                      <span className="font-bold text-sm">{info.label}</span>
                      <span className="text-[10px] opacity-70 leading-tight text-center hidden sm:block">{t === "basic" ? "KEN BURNS" : t === "medium" ? "KEY SCENES" : "ALL SCENES"}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-outline pl-1">{tier.description}</p>

              {/* Cost Estimator */}
              {hasMounted && (
                <div className="p-4 rounded-2xl bg-surface-container-lowest/50 border border-outline-variant/10 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-sm">calculate</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-outline">Estimated Cost</span>
                  </div>

                  {/* Cost breakdown rows */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-outline">Script generation</span>
                      <span className="text-on-surface font-mono">{POLLEN_COSTS.textGeneration.toFixed(4)} &#x2698;</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-outline">Images ({estScenes} scenes)</span>
                      <span className="text-on-surface font-mono">{(POLLEN_COSTS.imageGeneration * estScenes).toFixed(4)} &#x2698;</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-outline">TTS narration ({estScenes} scenes)</span>
                      <span className="text-on-surface font-mono">{(POLLEN_COSTS.ttsGeneration * estScenes).toFixed(4)} &#x2698;</span>
                    </div>
                    {/* Show AI video cost only for medium/pro */}
                    {qualityTier !== "basic" && (
                      <div className="flex justify-between">
                        <span className="text-outline">AI video ({qualityTier === "pro" ? "all" : "~50%"} scenes)</span>
                        <span className="text-on-surface font-mono">{videoCostPollen.toFixed(4)} &#x2698;</span>
                      </div>
                    )}
                    {musicEnabled && (
                      <div className="flex justify-between">
                        <span className="text-outline">Background music</span>
                        <span className="text-on-surface font-mono">{POLLEN_COSTS.musicGeneration.toFixed(4)} &#x2698;</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-outline-variant/10 pt-2 mt-2">
                      <div className="flex justify-between font-bold">
                        <span className="text-on-surface">Total estimated</span>
                        <span className="text-primary font-mono">{totalPollen.toFixed(4)} &#x2698; <span className="text-outline font-normal">(&#8776; ${totalPollen.toFixed(4)})</span></span>
                      </div>
                    </div>

                    {/* Balance after */}
                    {pollenBalance !== null && (
                      <div className="flex justify-between pt-1">
                        <span className="text-outline">Balance after</span>
                        <span className={`font-mono font-bold ${(pollenBalance - totalPollen) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(pollenBalance - totalPollen).toFixed(4)} &#x2698;
                        </span>
                      </div>
                    )}

                    {/* Warning if insufficient */}
                    {pollenBalance !== null && pollenBalance < totalPollen && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
                        <span className="text-[11px] text-red-400">
                          Insufficient balance. You need {(totalPollen - pollenBalance).toFixed(4)} more pollen.
                          <a href="https://pollinations.ai" target="_blank" rel="noopener noreferrer" className="ml-1 underline font-bold">Add credits &#8594;</a>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Duration — hide for music-video (duration comes from audio) */}
            {mode !== "music-video" && (
              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Duration</label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((d) => {
                    const isActive = targetDurationMinutes === d.value;
                    return (
                      <button
                        key={d.value}
                        onClick={() => setTargetDurationMinutes(d.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface-container-lowest/50 border border-outline-variant/10 text-outline hover:text-primary hover:border-primary/20"}`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-outline pl-1">
                  ~{estScenes} scenes · {targetDurationMinutes >= 60 ? `${targetDurationMinutes / 60}h` : `${targetDurationMinutes}min`} video
                </p>
                {estScenes > 50 && (
                  <p className="text-[10px] text-amber-400 pl-1">
                    {estScenes > 200 ? "⚡ Very long video — script will be generated in chapters to avoid timeouts" : "⚡ Long video — script will be generated in batches"}
                  </p>
                )}
              </div>
            )}

            {/* Row: Dimension + Visual Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Video Size</label>
                <div className="relative">
                  <select
                    value={videoDimension.id}
                    onChange={(e) => setVideoDimension(VIDEO_DIMENSIONS.find(d => d.id === e.target.value) || VIDEO_DIMENSIONS[0])}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer truncate"
                  >
                    {VIDEO_DIMENSIONS.map(d => (<option key={d.id} value={d.id}>{d.label}</option>))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Visual Style</label>
                <div className="relative">
                  <select
                    value={globalVisualStyle}
                    onChange={(e) => setGlobalVisualStyle(e.target.value)}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer truncate"
                  >
                    {VISUAL_STYLES.map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                </div>
              </div>
            </div>

            {/* YouTube Style Clone */}
            <div className="space-y-3">
              <button
                onClick={() => setShowStyleClone(!showStyleClone)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all text-sm font-medium bg-surface-container-lowest/50 border-outline-variant/10 text-on-surface hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">content_copy</span>
                  <span className="text-xs font-semibold">Clone YouTube Style</span>
                  {appliedStyleId && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                </div>
                <span className={`material-symbols-outlined text-base text-outline transition-transform ${showStyleClone ? "rotate-180" : ""}`}>expand_more</span>
              </button>

              {showStyleClone && (
                <div className="space-y-3 p-3 rounded-xl bg-surface-container-lowest/30 border border-outline-variant/10">
                  {/* URL Input + Analyze */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAnalyzeYouTube()}
                      placeholder="Paste YouTube video URL..."
                      className="flex-1 bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl py-2.5 px-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none placeholder:text-outline/40"
                    />
                    <button
                      onClick={handleAnalyzeYouTube}
                      disabled={!youtubeUrl.trim() || isAnalyzingYT}
                      className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      {isAnalyzingYT ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">analytics</span>
                          Analyze
                        </>
                      )}
                    </button>
                  </div>

                  {/* Analyzed Style Preview */}
                  {analyzedStyle && (
                    <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                      {/* Header with thumbnail */}
                      <div className="flex gap-3">
                        {analyzedStyle.thumbnailUrl && (
                          <img src={analyzedStyle.thumbnailUrl} alt="" className="w-28 h-16 rounded-lg object-cover shrink-0 border border-outline-variant/10" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary text-base">style</span>
                            <span className="text-sm font-bold text-on-surface truncate">{analyzedStyle.styleName}</span>
                          </div>
                          {analyzedStyle.sourceVideoTitle && (
                            <p className="text-[10px] text-outline truncate">{analyzedStyle.sourceVideoTitle}</p>
                          )}
                          {analyzedStyle.sourceChannel && (
                            <p className="text-[10px] text-outline/60">{analyzedStyle.sourceChannel}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => { handleSaveStyle(analyzedStyle); }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">bookmark_add</span>
                            Save
                          </button>
                          <button
                            onClick={() => { applyStyle(analyzedStyle); }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${appliedStyleId === analyzedStyle.id ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                          >
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            {appliedStyleId === analyzedStyle.id ? "Applied" : "Apply"}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-outline leading-relaxed">{analyzedStyle.description}</p>

                      {/* Tone tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {analyzedStyle.toneKeywords?.map((kw: string) => (
                          <span key={kw} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{kw}</span>
                        ))}
                      </div>

                      {/* Detailed breakdown grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-outline">
                        <div><span className="font-semibold text-on-surface">Pacing:</span> {analyzedStyle.pacing} {(analyzedStyle as any).sceneDuration && `(~${(analyzedStyle as any).sceneDuration}s/scene)`}</div>
                        <div><span className="font-semibold text-on-surface">Hook:</span> {analyzedStyle.hookStyle}</div>
                        <div><span className="font-semibold text-on-surface">Narration:</span> {analyzedStyle.narrationStyle}</div>
                        <div><span className="font-semibold text-on-surface">Transitions:</span> {analyzedStyle.transitionStyle}</div>
                        {(analyzedStyle as any).colorGrading && (
                          <div><span className="font-semibold text-on-surface">Color:</span> {(analyzedStyle as any).colorGrading}</div>
                        )}
                        {(analyzedStyle as any).lightingStyle && (
                          <div><span className="font-semibold text-on-surface">Lighting:</span> {(analyzedStyle as any).lightingStyle}</div>
                        )}
                        {(analyzedStyle as any).cameraWork && (
                          <div className="col-span-2"><span className="font-semibold text-on-surface">Camera:</span> {(analyzedStyle as any).cameraWork}</div>
                        )}
                        {(analyzedStyle as any).soundDesign && (
                          <div className="col-span-2"><span className="font-semibold text-on-surface">Sound:</span> {(analyzedStyle as any).soundDesign}</div>
                        )}
                        {(analyzedStyle as any).textOnScreen && (
                          <div className="col-span-2"><span className="font-semibold text-on-surface">On-screen text:</span> {(analyzedStyle as any).textOnScreen}</div>
                        )}
                      </div>

                      {/* Scene structure */}
                      {analyzedStyle.sceneStructure && (
                        <div className="text-[10px] text-outline pt-1 border-t border-primary/10">
                          <span className="font-semibold text-on-surface">Structure:</span> {analyzedStyle.sceneStructure}
                        </div>
                      )}

                      {/* Hook example */}
                      {(analyzedStyle as any).hookExample && (
                        <div className="text-[10px] italic text-outline/70 bg-primary/5 rounded-lg px-2.5 py-1.5">
                          &ldquo;{(analyzedStyle as any).hookExample}&rdquo;
                        </div>
                      )}

                      {/* Visual prompt suffix preview */}
                      {analyzedStyle.visualPromptSuffix && (
                        <div className="text-[9px] text-outline/50 border-t border-primary/10 pt-1.5">
                          <span className="font-semibold text-outline/70">Prompt suffix:</span> {analyzedStyle.visualPromptSuffix}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Saved Styles */}
                  {savedStyles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Saved Styles</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {savedStyles.map((s) => (
                          <div
                            key={s.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer text-xs ${appliedStyleId === s.id ? "bg-primary/10 border-primary/20" : "bg-surface-container-lowest/50 border-outline-variant/10 hover:bg-primary/5"}`}
                            onClick={() => applyStyle(s)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-on-surface truncate">{s.styleName}</span>
                                {s.sourceChannel && <span className="text-[10px] text-outline shrink-0">· {s.sourceChannel}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {appliedStyleId === s.id && <span className="material-symbols-outlined text-primary text-sm">check_circle</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteStyle(s.id); }}
                                className="w-5 h-5 rounded flex items-center justify-center text-outline hover:text-error hover:bg-error/10 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">close</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Voiceover + Music + Captions — hide voice for music-video mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mode !== "music-video" && (
                <div className="space-y-2">
                  <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">
                    Voice {qualityTier === "basic" ? "(Free · Edge TTS)" : "(ElevenLabs)"}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer"
                    >
                      {VOICES.map(v => (<option key={v.id} value={v.id}>{v.name} — {v.gender}, {v.description}</option>))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Extras</label>
                <div className="space-y-2">
                  {[
                    ...(mode !== "music-video" ? [{ enabled: musicEnabled, toggle: () => setMusicEnabled(!musicEnabled), onIcon: "music_note", offIcon: "music_off", label: "Background Music" }] : []),
                    { enabled: captionsEnabled, toggle: () => setCaptionsEnabled(!captionsEnabled), onIcon: "closed_caption", offIcon: "closed_caption_disabled", label: mode === "music-video" ? "Burn-in Lyrics" : "Burn-in Captions" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.toggle}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all text-sm font-medium ${item.enabled ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-container-lowest/50 border-outline-variant/10 text-outline"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">{item.enabled ? item.onIcon : item.offIcon}</span>
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${item.enabled ? "bg-primary" : "bg-outline-variant/30"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${item.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Credits tracker */}
            {creditsUsed > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="material-symbols-outlined text-primary text-lg">account_balance_wallet</span>
                <div>
                  <p className="text-xs text-outline font-label uppercase tracking-widest">Credits Used This Session</p>
                  <p className="font-bold text-on-surface">${creditsUsed.toFixed(4)}</p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full primary-gradient text-white font-headline font-extrabold py-4 px-8 rounded-2xl text-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
              >
                {mode === "link" ? "Generate Video" : mode === "short-story" ? "Create Story Video" : "Create Music Video"}
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      {hasMounted && (
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-headline text-xl md:text-2xl font-bold tracking-tight">
              Recent Videos
              {recentVideos.length > 0 && (<span className="ml-2 text-sm font-normal text-outline">({recentVideos.length})</span>)}
            </h3>
          </div>

          {recentVideos.length === 0 ? (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-dashed border-outline-variant/20">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">movie</span>
              <h4 className="font-headline font-bold text-lg mb-1">No videos yet</h4>
              <p className="text-sm text-outline">Generate your first video above and it&apos;ll appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {recentVideos.map((v) => {
                const date = new Date(v.createdAt);
                const timeAgo = formatTimeAgo(date);
                const totalRounded = Math.round(v.totalSeconds);
                const mins = Math.floor(totalRounded / 60);
                const secs = totalRounded % 60;
                const durationLabel = `${mins}:${String(secs).padStart(2, "0")}`;
                return (
                  <div key={v.id} onClick={() => router.push("/editor")} className="group glass-card glass-card-hover rounded-[1.5rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-3px] hover:shadow-xl hover:shadow-primary/5 cursor-pointer hover:ring-2 ring-primary/30 hover:scale-[1.01]">
                    <div className="h-40 md:h-48 relative overflow-hidden bg-surface-container-high">
                      {v.thumbnailUrl ? (
                        <img alt={v.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src={v.thumbnailUrl} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-4xl text-outline/30">movie</span></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{v.dimensionId}</span>
                        <span className="bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold">{durationLabel}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFromHistory(v.id); setRecentVideos(getHistory()); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/60"
                        title="Remove from history"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                    <div className="p-4 md:p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-headline font-bold text-base leading-tight mb-1 line-clamp-2">{v.title}</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${QUALITY_TIERS[v.quality].bgColor} ${QUALITY_TIERS[v.quality].color}`}>{QUALITY_TIERS[v.quality].label}</span>
                          <p className="text-xs text-outline">{timeAgo}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUrl(v.topic); router.push("/story"); }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/20"
                      >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Regenerate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
