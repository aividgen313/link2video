"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VOICES, VIDEO_DIMENSIONS, VIDEO_RESOLUTIONS, QualityTier, VideoResolution, AppMode, CharacterProfile, POLLEN_COSTS, QUALITY_TIERS, calculateTotalCost } from "@/context/AppContext";
import { CostCalculator } from "@/components/CostCalculator";
import { PollensBalanceWidget } from "@/components/PollensBalanceWidget";

const DURATION_PRESETS = [
  { label: "1 min", value: 1 },
  { label: "3 min", value: 3 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "12 min", value: 12 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "120 min", value: 120 },
];
import { getHistory, deleteFromHistory, loadProjectState, syncHistoryWithCloud, getThumbnailBlob, type VideoHistoryItem } from "@/lib/videoHistory";
import { getSavedStyles, saveStyle, deleteStyle, type SavedStyle } from "@/lib/savedStyles";

function ProjectThumbnail({ video }: { video: VideoHistoryItem }) {
  const [thumb, setThumb] = useState<string | undefined>(video.thumbnailUrl);

  useEffect(() => {
    // If we have a thumbnailUrl that is NOT a blob: or data: URL, it's likely a cloud URL and fine.
    // If it's missing or if hasThumbnail flag is set, try to load the high-res one from IDB.
    if (!thumb || video.hasThumbnail) {
      getThumbnailBlob(video.id).then(blobUrl => {
        if (blobUrl) setThumb(blobUrl);
      });
    }
  }, [video.id, video.hasThumbnail]);

  return (
    <div className="w-20 h-11 rounded-lg bg-surface-container-high overflow-hidden shrink-0">
      {thumb ? (
        <img src={thumb} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined text-outline/20 text-lg">movie</span>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  { mode: "short-story", label: "Story", icon: "auto_stories", desc: "Paste or write a story" },
  { mode: "music-video", label: "Music Video", icon: "music_note", desc: "Upload audio + lyrics" },
  { mode: "director", label: "Director", icon: "movie_edit", desc: "Script with dialogue" },
];

const PRO_TIPS = [
  "Director Mode is best for character-heavy stories and dialogue.",
  "Use 'Dynamic' resolution for the fastest preview generation.",
  "Add reference photos for characters to keep their look consistent.",
  "Pro Tier uses a cinematically optimized video model.",
  "You can edit any AI-generated narration in the Script phase.",
  "Try 'Neon Noir' style for a futuristic cyberpunk aesthetic.",
];

function ProTips() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex(prev => (prev + 1) % PRO_TIPS.length), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-subtle border border-primary/10 w-fit mx-auto mt-6 animate-fade-in">
      <span className="material-symbols-outlined text-primary text-xs animate-pulse">lightbulb</span>
      <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Pro Tip:</span>
      <span className="text-[11px] text-on-surface/80 font-medium italic">{PRO_TIPS[index]}</span>
    </div>
  );
}

function DownloadButton({ video, onError, onFallback }: { video: VideoHistoryItem; onError: (msg: string) => void; onFallback: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        try {
          const state = await loadProjectState(video.id);
          if (state?.finalVideoUrl && !state.finalVideoUrl.startsWith("blob:")) {
            const a = document.createElement("a");
            a.href = state.finalVideoUrl;
            a.download = `${video.title || "video"}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            // No persistent video URL — open in editor to re-export
            onFallback();
          }
        } catch {
          onError("Download failed — open the project to re-export.");
        } finally {
          setLoading(false);
        }
      }}
      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/20 disabled:opacity-50"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      ) : (
        <span className="material-symbols-outlined text-base">download</span>
      )}
      {loading ? "Loading..." : "Download"}
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    url, setUrl, angle, setAngle, scriptData, setScriptData,
    isGenerating, setIsGenerating, finalVideoUrl, setFinalVideoUrl,
    qualityTier, setQualityTier, globalVisualStyle, setGlobalVisualStyle,
    videoDimension, setVideoDimension, selectedVoice, setSelectedVoice,
    captionsEnabled, setCaptionsEnabled,
    targetDurationMinutes, setTargetDurationMinutes,
    pollenUsed, mode, setMode, storyText, setStoryText,
    characterProfiles, setCharacterProfiles,
    audioFile, setAudioFile, audioFileName, setAudioFileName,
    lyrics, setLyrics, musicSegments, setMusicSegments,
    audioDuration, setAudioDuration,
    setStoryboardImages, setSceneAudioUrls, setSceneVideoUrls, setSceneDurations,
    setYoutubeStyleSuffix, setGenerateRequested,
    settingText, setSettingText,
    activeStyle, setActiveStyle,
    directorMode, setDirectorMode,
    imagesPerScene, setImagesPerScene,
    videoResolution, setVideoResolution,
    captionStyle, setCaptionStyle,
  } = useAppContext();

  const [inputValue, setInputValue] = useState(url || "");
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
  useEffect(() => {
    if (hasMounted) {
      setRecentVideos(getHistory());
      setSavedStyles(getSavedStyles());
      // Background sync with cloud
      syncHistoryWithCloud().then(synced => {
        setRecentVideos(synced);
      });
    }
  }, [hasMounted]);

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

  const handleOpenProject = async (v: VideoHistoryItem) => {
    try {
      const state = await loadProjectState(v.id);
      if (state && state.scriptData) {
        // Inject editor scenes/tracks into scriptData so EditorContext picks them up
        const mergedScriptData = { 
          ...state.scriptData, 
          editorScenes: state.editorScenes, 
          editorTracks: state.editorTracks 
        };
        setScriptData(mergedScriptData);
        setStoryboardImages(state.storyboardImages || {});
        setSceneAudioUrls(state.sceneAudioUrls || {});
        setSceneVideoUrls(state.sceneVideoUrls || {});
        setSceneDurations(state.sceneDurations || {});
        setFinalVideoUrl(state.finalVideoUrl || null);
        // Restore metadata from history item
        if (v.quality) setQualityTier(v.quality);
        if (v.dimensionId) {
          const dim = VIDEO_DIMENSIONS.find(d => d.id === v.dimensionId);
          if (dim) setVideoDimension(dim);
        }
        if (v.topic) setUrl(v.topic);
        if (v.angle) setAngle(v.angle);
        if (v.activeStyle) setActiveStyle(v.activeStyle);
        if (v.settingText) setSettingText(v.settingText);
        router.push(`/editor?projectId=${v.id}`);
      } else {
        setErrorMsg("Project data not found — it may have been cleared by browser storage. Try regenerating.");
      }
    } catch (e) {
      console.error("Failed to open project:", e);
      setErrorMsg("Failed to open project. Try refreshing the page.");
    }
  };

  const handleGenerate = () => {
    // Reset previous generation state
    setScriptData(null);
    setStoryboardImages({});
    setFinalVideoUrl(null);
    setGenerateRequested(true); // Signal that user explicitly requested generation

    if (mode === "link") {
      if (!inputValue.trim()) return;
      setUrl(inputValue);
      router.push("/script"); // skip story page — angle auto-selected on script page
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
  // Estimate number of scenes: ~8s per scene = 7.5 scenes/min, rounded up
  const estScenes = Math.max(1, Math.ceil(targetDurationMinutes * 60 / 8));

  // Calculate pollen costs — single source of truth
  const totalPollen = calculateTotalCost(qualityTier, estScenes, false);
  const tierDef = QUALITY_TIERS[qualityTier];
  const imageCostPollen = tierDef.pollenPerImageScene * estScenes;
  const ttsCostPollen = tierDef.pollenPerTTS * estScenes;
  // Count video scenes using same logic as calculateTotalCost
  const videoScenesCount = qualityTier === "pro" ? estScenes
    : qualityTier === "medium" ? (() => { let c = 0; for (let i = 0; i < estScenes; i++) { if (Math.floor(i / 3) % 2 === 0) c++; } return c; })()
    : qualityTier === "free" ? (() => { let c = 0; for (let i = 0; i < estScenes; i++) { if (i % 2 === 0) c++; } return c; })()
    : 0;
  const videoCostPollen = tierDef.pollenPerVideoScene * videoScenesCount;
  const musicCostPollen = 0;

  const canGenerate = mode === "link" ? inputValue.trim().length > 0
    : mode === "short-story" ? storyText.trim().length > 0
    : mode === "music-video" ? !!audioFile
    : false;

  const [showAllProjects, setShowAllProjects] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"projects" | "styles">("projects");
  const SIDEBAR_LIMIT = 6;
  const visibleProjects = showAllProjects ? recentVideos : recentVideos.slice(0, SIDEBAR_LIMIT);

  return (
    <>
      {/* ── Error Toast ─────────────────────────────────── */}
      {errorMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-red-500/10 border border-red-500/30 backdrop-blur-md animate-fade-in-up max-w-sm w-full mx-4">
          <span className="material-symbols-outlined text-red-400 text-lg shrink-0">error</span>
          <p className="text-sm text-red-400 flex-1 leading-snug">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-400 transition-colors shrink-0">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ── Dashboard: Horizontal Split Layout ── */}
      <div className="flex gap-6 w-full h-[calc(100vh-140px)] min-h-0 overflow-hidden animate-fade-in-up">
        {/* ═══ CENTER: Create Video Form (scrollable) ═══ */}
        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-1">
          <div className="max-w-4xl mx-auto w-full space-y-8 pb-10">
            {/* Main Create Card */}
            <div className="glass-card rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl border-white/20 dark:border-white/5">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
              <div className="absolute -bottom-48 -left-24 w-80 h-80 bg-tertiary/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative z-10 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                      </div>
                      <span className="text-xs font-black tracking-[0.2em] text-primary uppercase">Studio v3.5</span>
                    </div>
                    <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tight text-on-surface leading-[1.1]">
                      Craft Your <span className="text-gradient">Masterpiece</span>
                    </h1>
                    <p className="text-sm md:text-base text-outline font-medium max-w-md">Transform any content into world-class video in seconds.</p>
                  </div>

                  {/* Pollinations Balance Widget */}
                  <PollensBalanceWidget />
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex gap-2 p-1.5 glass-subtle rounded-2xl">
                  {MODE_TABS.map((tab) => (
                    <button
                      key={tab.mode}
                      onClick={() => setMode(tab.mode)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold spring-transition press-scale ${
                        mode === tab.mode
                          ? "glass-elevated text-primary"
                          : "text-outline hover:text-on-surface hover:bg-surface-variant/30"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden text-xs">{tab.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>

                <ProTips />

                {/* ===== LINK/TOPIC MODE ===== */}
                {mode === "link" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Paste a link or topic</label>
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
                      <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Video Style</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {STYLE_TEMPLATES.map((s) => {
                          const isActive = activeStyle === s.label;
                          return (
                            <button
                              key={s.label}
                              onClick={() => setActiveStyle(s.label)}
                              className={`flex flex-col items-start gap-1 p-3 rounded-xl spring-transition press-scale text-left ${isActive ? "glass-elevated text-primary" : "glass-subtle text-outline hover:text-primary hover:border-primary/20"}`}
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

                    {/* Optional Character References for Link Mode */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Character References (optional)</label>
                        {characterProfiles.length === 0 && (
                          <button
                            onClick={() => setCharacterProfiles([{ id: `char_${Date.now()}`, name: "", appearance: "", role: "protagonist" }])}
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span> Add Character
                          </button>
                        )}
                        {characterProfiles.length > 0 && (
                          <button
                            onClick={() => setCharacterProfiles([...characterProfiles, { id: `char_${Date.now()}`, name: "", appearance: "", role: "supporting" }])}
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">add</span> Add
                          </button>
                        )}
                      </div>
                      {characterProfiles.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {characterProfiles.map((cp, idx) => (
                            <div key={cp.id} className="glass p-2.5 rounded-xl border border-outline-variant/10">
                              <div className="flex items-start gap-2.5">
                                <label className="flex-shrink-0 cursor-pointer group/photo">
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const updated = [...characterProfiles];
                                      updated[idx] = { ...updated[idx], referencePhotoUrl: reader.result as string };
                                      setCharacterProfiles(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }} />
                                  {cp.referencePhotoUrl ? (
                                    <div className="w-11 h-11 rounded-lg overflow-hidden relative">
                                      <img src={cp.referencePhotoUrl} alt={cp.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg bg-surface-container-highest border border-dashed border-outline-variant/30 flex items-center justify-center group-hover/photo:border-primary/40 transition-all">
                                      <span className="material-symbols-outlined text-outline/40 group-hover/photo:text-primary text-base">add_a_photo</span>
                                    </div>
                                  )}
                                </label>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <input className="flex-1 bg-transparent border-none text-sm font-bold" placeholder="Name" value={cp.name} onChange={(e) => { const u = [...characterProfiles]; u[idx] = { ...u[idx], name: e.target.value }; setCharacterProfiles(u); }} />
                                    <button onClick={() => setCharacterProfiles(characterProfiles.filter((_, i) => i !== idx))}><span className="material-symbols-outlined text-sm text-outline">close</span></button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ===== SHORT STORY MODE ===== */}
                {mode === "short-story" && (
                  <div className="space-y-4">
                    <textarea
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-5 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-sm leading-relaxed resize-none"
                      placeholder="Once upon a time..."
                      rows={8}
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                    />
                    <button onClick={handleExtractCharacters} className="flex items-center gap-2 text-xs text-primary font-bold">
                      <span className="material-symbols-outlined text-sm">person_search</span> Extract Characters
                    </button>
                  </div>
                )}

                {/* ===== MUSIC VIDEO MODE ===== */}
                {mode === "music-video" && (
                  <div className="space-y-4">
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                    <button onClick={() => audioInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-outline-variant/20 rounded-2xl flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-3xl text-outline">upload_file</span>
                      <span className="text-sm font-bold text-outline">{audioFileName || "Upload Audio File"}</span>
                    </button>
                    <textarea
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3 px-4 text-sm"
                      placeholder="Paste song lyrics here..."
                      rows={5}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                    />
                  </div>
                )}

                {/* Global Settings Section */}
                <div className="space-y-6 pt-4 border-t border-outline-variant/10">
                  <div className="space-y-2">
                    <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Quality Tier</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["free", "basic", "medium", "pro"] as QualityTier[]).map((t) => {
                        const info = QUALITY_TIERS[t];
                        const isActive = qualityTier === t;
                        const estCost = calculateTotalCost(t, estScenes, false).toFixed(2);
                        return (
                          <button key={t} onClick={() => setQualityTier(t)} className={`py-2.5 px-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${isActive ? `${info.bgColor} ${info.color} ${info.borderColor}` : "border-transparent text-outline hover:bg-surface-variant/30"}`}>
                            <span className="font-bold text-sm">{info.label}</span>
                            <span className="text-[10px] font-bold opacity-80">${estCost}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Video Size</label>
                      <select
                        value={videoDimension.id}
                        onChange={(e) => setVideoDimension(VIDEO_DIMENSIONS.find(d => d.id === e.target.value) || VIDEO_DIMENSIONS[0])}
                        className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 text-sm"
                      >
                        {VIDEO_DIMENSIONS.map(d => (<option key={d.id} value={d.id}>{d.label}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Export Quality</label>
                      <select
                        value={videoResolution}
                        onChange={(e) => setVideoResolution(e.target.value as VideoResolution)}
                        className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 text-sm"
                      >
                        {VIDEO_RESOLUTIONS.map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Visual Style</label>
                    <select
                      value={globalVisualStyle}
                      onChange={(e) => setGlobalVisualStyle(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 text-sm"
                    >
                      {VISUAL_STYLES.map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
                    </select>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[13px] font-headline font-bold text-on-surface/70 uppercase tracking-wider">Estimated Costs</label>
                    <CostCalculator currentTier={qualityTier} />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border glass-subtle">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">closed_caption</span>
                      <span className="text-xs font-bold text-on-surface">Enable Captions</span>
                    </div>
                    <button onClick={() => setCaptionsEnabled(!captionsEnabled)} className={`w-8 h-4 rounded-full relative transition-colors ${captionsEnabled ? "bg-primary" : "bg-outline/20"}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${captionsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>

                {/* Generate Action */}
                <div className="pt-8 border-t border-outline-variant/10">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating}
                    className={`w-full py-5 rounded-3xl font-headline font-black text-xl flex items-center justify-center gap-3 transition-all ${canGenerate ? "bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.01]" : "bg-surface-container-high text-outline opacity-50"}`}
                  >
                    {isGenerating ? "Engines Starting..." : "Generate Magic"}
                    {!isGenerating && <span className="material-symbols-outlined">arrow_forward</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT SIDEBAR: Tabbed Panel ═══ */}
        {hasMounted && (
          <div className="hidden lg:flex flex-col w-[340px] xl:w-[380px] shrink-0 glass-card rounded-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-outline-variant/10">
              <button 
                onClick={() => setSidebarTab("projects")}
                className={`flex-1 px-5 py-4 font-headline font-black text-xs uppercase tracking-widest transition-all ${sidebarTab === "projects" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-outline hover:text-on-surface"}`}
              >
                Projects
              </button>
              <button 
                onClick={() => setSidebarTab("styles")}
                className={`flex-1 px-5 py-4 font-headline font-black text-xs uppercase tracking-widest transition-all ${sidebarTab === "styles" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-outline hover:text-on-surface"}`}
              >
                Captions
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6">
              {sidebarTab === "projects" ? (
                recentVideos.length === 0 ? (
                  <p className="text-center text-outline text-xs mt-10">No projects yet</p>
                ) : (
                  <div className="space-y-3">
                    {visibleProjects.map((v) => (
                      <div key={v.id} className="group flex items-center gap-2">
                        <div onClick={() => handleOpenProject(v)} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all flex-1 min-w-0">
                          <ProjectThumbnail video={v} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs truncate">{v.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-outline">{formatTimeAgo(new Date(v.createdAt))}</p>
                              {v.totalSeconds && v.totalSeconds > 0 && (
                                <>
                                  <span className="w-0.5 h-0.5 rounded-full bg-outline/30 shrink-0" />
                                  <p className="text-[10px] text-primary/80 font-bold">{formatDuration(v.totalSeconds)}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this project?")) {
                              deleteFromHistory(v.id);
                              setRecentVideos(getHistory());
                            }
                          }}
                          className="p-2 text-outline hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary">text_fields</span>
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-on-surface leading-none">Global Caption Style</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-outline font-bold uppercase">Font Color</span>
                        <input 
                          type="color" 
                          value={captionStyle.fontColor} 
                          onChange={(e) => setCaptionStyle({ ...captionStyle, fontColor: e.target.value })}
                          className="w-full h-10 rounded-xl bg-surface-container-lowest border border-outline-variant/10 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-outline font-bold uppercase">Text Size</span>
                        <select 
                          value={captionStyle.fontSize} 
                          onChange={(e) => setCaptionStyle({ ...captionStyle, fontSize: Number(e.target.value) })}
                          className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl py-2 px-3 text-xs font-bold"
                        >
                          <option value={3}>Small</option>
                          <option value={5}>Medium</option>
                          <option value={8}>Large</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-outline font-bold uppercase">Position</span>
                      <div className="grid grid-cols-3 gap-2">
                        {(["top", "middle", "bottom"] as const).map(p => (
                          <button key={p} onClick={() => setCaptionStyle({ ...captionStyle, position: p })} className={`py-2 rounded-lg border text-[10px] font-bold capitalize transition-all ${captionStyle.position === p ? "bg-primary/10 border-primary text-primary" : "text-outline border-outline/10 hover:bg-surface-variant/30"}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setCaptionStyle({ ...captionStyle, showBackground: !captionStyle.showBackground })} 
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${captionStyle.showBackground ? "bg-primary/10 border-primary text-primary" : "text-outline border-outline/10 hover:bg-surface-variant/30"}`}
                    >
                      <span className="text-[11px] font-bold uppercase">Show Background Box</span>
                      <span className="material-symbols-outlined text-base">{captionStyle.showBackground ? "check_box" : "check_box_outline_blank"}</span>
                    </button>
                  </div>
                  
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex gap-3">
                         <span className="material-symbols-outlined text-primary text-lg">info</span>
                         <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            These styles will be applied to <strong>all scenes</strong> in your next video generation. You can always fine-tune them later in the Editor.
                         </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
