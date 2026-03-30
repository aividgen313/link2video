"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

export type AppMode = "link" | "short-story" | "music-video" | "notepad" | "director";

export type NotepadSourceType = "text" | "url" | "pdf" | "clipboard";

export type NotepadSource = {
  id: string;
  type: NotepadSourceType;
  title: string;
  rawContent: string;
  extractedFacts: string[] | null;
  addedAt: number;
  preview: string;
  sourceUrl?: string;
};

export type NotepadImage = {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  width: number;
  height: number;
  addedAt: number;
};

export type NotepadData = {
  projectName: string;
  sources: NotepadSource[];
  images: NotepadImage[];
  synthesizedKnowledge: string | null;
  lastSynthesizedAt: number | null;
  suggestedTitle?: string;
  suggestedAngle?: string;
  themes?: string[];
  coreThesis?: string;
};

export type Scene = {
  id: number;
  scene_number: number;
  narration: string;
  visual_prompt: string;
  duration_estimate_seconds: number;
  video_model_override?: string;
  image_model_override?: string;
  camera_angle?: string;
  lighting?: string;
  mood?: string;
  characters?: string[]; // character profile IDs referenced in this scene
  visual_variations?: string[]; // distinct visual prompts for multi-image scenes (Action, Reaction, Detail, etc.)
};

export type ScriptData = {
  id?: string;
  title: string;
  angle: string;
  scenes: Scene[];
  characterProfiles?: CharacterProfile[];
  character_identities?: Record<string, string>; // locked physical descriptions per character (from AI)
  isDemo?: boolean;
};

export type CharacterProfile = {
  id: string;
  name: string;
  appearance: string; // detailed physical appearance for image gen
  age?: string;
  race?: string;
  gender?: string;
  clothing?: string;
  role: string; // protagonist, antagonist, supporting, etc.
  referencePhotoUrl?: string; // user-uploaded photo for AI likeness matching
};

export type MusicSegment = {
  id: number;
  type: "intro" | "verse" | "chorus" | "bridge" | "outro";
  startTime: number; // seconds
  endTime: number;
  lyrics: string;
};

export type QualityTier = "free" | "basic" | "medium" | "pro";

export type VideoDimension = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
};

export type VideoResolution = "480p" | "720p" | "1080p" | "4k";

export type CaptionStyle = {
  fontColor: string;
  fontSize: number; // percentage of height, e.g., 5
  position: "bottom" | "middle" | "top";
  showBackground: boolean;
};

export const VIDEO_RESOLUTIONS: { id: VideoResolution; label: string; longestSide: number }[] = [
  { id: "480p", label: "480p (SD)", longestSide: 854 },
  { id: "720p", label: "720p (HD)", longestSide: 1280 },
  { id: "1080p", label: "1080p (Full HD)", longestSide: 1920 },
  { id: "4k", label: "4K (Ultra HD)", longestSide: 3840 },
];

export const VIDEO_DIMENSIONS: VideoDimension[] = [
  { id: "16:9", label: "YouTube / Widescreen (16:9)", width: 1280, height: 720, aspectRatio: "16/9" },
  { id: "9:16", label: "TikTok / Instagram Story (9:16)", width: 720, height: 1280, aspectRatio: "9/16" },
  { id: "1:1", label: "Instagram Square (1:1)", width: 720, height: 720, aspectRatio: "1/1" },
  { id: "4:5", label: "Instagram Portrait (4:5)", width: 576, height: 720, aspectRatio: "4/5" },
  { id: "21:9", label: "Cinematic Ultrawide (21:9)", width: 1280, height: 549, aspectRatio: "21/9" },
];

export const VOICES = [
  { id: "adam", name: "Adam", gender: "Male", description: "Deep & Authoritative" },
  { id: "josh", name: "Josh", gender: "Male", description: "Calm & Warm" },
  { id: "arnold", name: "Arnold", gender: "Male", description: "Crisp & Clear" },
  { id: "sam", name: "Sam", gender: "Male", description: "Raspy & Mature" },
  { id: "rachel", name: "Rachel", gender: "Female", description: "Calm & Professional" },
  { id: "domi", name: "Domi", gender: "Female", description: "Strong & Confident" },
  { id: "bella", name: "Bella", gender: "Female", description: "Warm & Friendly" },
  { id: "elli", name: "Elli", gender: "Female", description: "Young & Energetic" },
  { id: "custom", name: "My Custom Voice", gender: "Custom", description: "ElevenLabs API" },
];

// ═══════════════════════════════════════════════════════════════
// All services via Pollinations (enter.pollinations.ai):
// TEXT: Free models (openai, deepseek, mistral, openai-fast, claude-fast)
// IMAGE: nanobanana-pro, seedream-pro (via gen.pollinations.ai/image/)
// VIDEO: wan, seedance-pro, seedance, ltx-2 (via gen.pollinations.ai/video/)
// TTS: ElevenLabs via Pollinations (free with API key) / Edge TTS (basic)
// ═══════════════════════════════════════════════════════════════

export const QUALITY_TIERS = {
  free: {
    label: "Free",
    description: "FLUX + LTX-2 (Alternating images/video) to minimize cost.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: "bolt",
    useAIVideo: true,
    videoSceneStrategy: "alternating" as const,
    alternatingGroupSize: 1,      // 1 Video, 1 Image
    usePollsTTS: false,           // Edge TTS (free)
    imageModel: "flux",
    textModel: "pollinations",
    videoModel: "ltx-2",
  },
  basic: {
    label: "Basic",
    description: "Ken Burns + Edge TTS — High Performance, Low Cost.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    useAIVideo: false,
    videoSceneStrategy: "none" as const,
    usePollsTTS: false, // Edge TTS (free)
    imageModel: "flux",
    textModel: "pollinations",
    videoModel: undefined,
  },
  medium: {
    label: "Medium",
    description: "Flux + Alternating AI Video & Ken Burns + ElevenLabs.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    useAIVideo: true,
    videoSceneStrategy: "alternating" as const, // 3 AI video, 3 Ken Burns, repeating
    alternatingGroupSize: 3,
    usePollsTTS: true,
    imageModel: "flux",
    textModel: "pollinations",
    videoModel: undefined,
  },
  pro: {
    label: "Pro",
    description: "Flux + AI Video (all scenes) + ElevenLabs — Maximum Quality.",
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    borderColor: "border-tertiary/20",
    useAIVideo: true,
    videoSceneStrategy: "all" as const,
    usePollsTTS: true,
    imageModel: "flux",
    textModel: "pollinations",
    videoModel: undefined,
  },
};

// Helper: calculate accurate total cost for a given tier and scene count
export function calculateTotalCost(tierKey: QualityTier, sceneCount: number, musicEnabled: boolean = false, targetDurationMinutes: number = 3): number {
  const tier = QUALITY_TIERS[tierKey];
  
  // 1. Text Generation (Script + Metadata)
  const textCost = POLLEN_COSTS.textGeneration;

  // 2. Image Generation (6 images per scene for storyboard)
  const imagesPerScene = 6; 
  const totalImages = sceneCount * imagesPerScene;
  const imageCost = totalImages * POLLEN_COSTS.imageGeneration;

  // 3. TTS Generation (Estimate 0.01 per scene based on char counts)
  const ttsCost = sceneCount * POLLEN_COSTS.ttsGeneration;

  // 4. Video Generation (Based on total video duration)
  let videoSceneCount = 0;
  if (tier.useAIVideo) {
    if (tier.videoSceneStrategy === "all") {
      videoSceneCount = sceneCount;
    } else if (tier.videoSceneStrategy === "alternating") {
      const groupSize = (tier as any).alternatingGroupSize || 3;
      for (let i = 0; i < sceneCount; i++) {
        if (Math.floor(i / groupSize) % 2 === 0) videoSceneCount++;
      }
    }
  }
  
  // Estimate video duration: video seconds = (total duration / total scenes) * video scenes
  const totalVideoSeconds = (videoSceneCount / sceneCount) * (targetDurationMinutes * 60);
  const videoRate = (tierKey === 'free' || tierKey === 'basic') ? POLLEN_COSTS.videoPerSecondFree : POLLEN_COSTS.videoPerSecond;
  const videoCost = totalVideoSeconds * videoRate;
  
  // 5. Music Generation ($0.005 per second)
  const musicCost = musicEnabled ? (targetDurationMinutes * 60 * POLLEN_COSTS.musicPerSecond) : 0;

  // Add 10% buffer for unexpected API retries/tokens
  const baseTotal = textCost + imageCost + ttsCost + videoCost + musicCost;
  return baseTotal * 1.1; 
}

// Pollinations pricing reference (1 pollen ≈ $1 USD)
// NOTE: During Beta, $5 USD buys 10 Diamonds/Pollen (2x Bonus)
export const POLLEN_COSTS = {
  textGeneration: 0.001,      // per API call (average)
  imageGeneration: 0.001,     // per image (Flux)
  ttsGeneration: 0.002,      // per scene (approx. 200 characters)
  videoPerSecond: 0.05,      // per second of Pro video (Wan)
  videoPerSecondFree: 0.01,  // per second of Free video (LTX-2)
  musicPerSecond: 0.005,     // per second of Music
  avgSceneDuration: 6,       // average scene duration in seconds
};

// ── Background task types ──────────────────────────────────────────────────
export type BackgroundTaskState = "idle" | "running" | "complete" | "error";

export interface ExtractProgress {
  state: BackgroundTaskState;
  done: number;
  total: number;
  currentTitle: string;
  error: string | null;
}

export interface SynthesizeProgress {
  state: BackgroundTaskState;
  percent: number; // 0 – 100
  error: string | null;
}

export interface ScriptGenerationProgress {
  state: BackgroundTaskState;
  elapsedSeconds: number;
  error: string | null;
}

interface AppContextType {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  // Core
  url: string;
  setUrl: (url: string) => void;
  angle: string;
  setAngle: (angle: string) => void;
  scriptData: ScriptData | null;
  setScriptData: (data: ScriptData | null) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  finalVideoUrl: string | null;
  setFinalVideoUrl: (url: string | null) => void;
  qualityTier: QualityTier;
  setQualityTier: (tier: QualityTier) => void;
  globalVisualStyle: string;
  setGlobalVisualStyle: (style: string) => void;
  videoDimension: VideoDimension;
  setVideoDimension: (dim: VideoDimension) => void;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  captionsEnabled: boolean;
  setCaptionsEnabled: (enabled: boolean) => void;
  pollenUsed: number;
  setPollenUsed: (pollen: number | ((prev: number) => number)) => void;
  pollenBalance: number | null;
  pollenTier: string | null;
  pollenResetAt: string | null;
  isFetchingBalance: boolean;
  hasMounted: boolean;
  targetDurationMinutes: number;
  setTargetDurationMinutes: (min: number) => void;
  videoResolution: VideoResolution;
  setVideoResolution: (res: VideoResolution) => void;
  imagesPerScene: number;
  setImagesPerScene: (count: number) => void;
  storyboardImages: Record<number, string[]>;
  setStoryboardImages: (imgs: Record<number, string[]> | ((prev: Record<number, string[]>) => Record<number, string[]>)) => void;
  // Reference images for subjects (people, locations, brands)
  referenceImages: Record<string, string[]>; // { "Lorena Bobbitt": ["url1", "url2"], ... }
  setReferenceImages: (imgs: Record<string, string[]>) => void;
  // Scene-level generated assets (transferred from generate page to editor)
  sceneAudioUrls: Record<number, string>;
  setSceneAudioUrls: (urls: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
  sceneVideoUrls: Record<number, string>;
  setSceneVideoUrls: (urls: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
  // Actual measured scene durations (from audio length + padding)
  sceneDurations: Record<number, number>;
  setSceneDurations: (durations: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void;
  // YouTube style clone suffix (appended to every visual_prompt)
  youtubeStyleSuffix: string;
  setYoutubeStyleSuffix: (suffix: string) => void;
  // Short Story Mode
  storyText: string;
  setStoryText: (text: string) => void;
  characterProfiles: CharacterProfile[];
  setCharacterProfiles: (profiles: CharacterProfile[]) => void;
  activeStyle: string | null;
  setActiveStyle: (style: string | null) => void;
  settingText: string;
  setSettingText: (text: string) => void;
  // Music Video Mode
  audioFile: string | null; // base64 data URL of uploaded audio
  setAudioFile: (file: string | null) => void;
  audioFileName: string | null;
  setAudioFileName: (name: string | null) => void;
  lyrics: string;
  setLyrics: (lyrics: string) => void;
  musicSegments: MusicSegment[];
  setMusicSegments: (segments: MusicSegment[]) => void;
  audioDuration: number; // seconds
  setAudioDuration: (dur: number) => void;
  // Notepad
  notepadData: NotepadData;
  setNotepadData: (data: NotepadData | ((prev: NotepadData) => NotepadData)) => void;
  // Navigation intent — true only when user explicitly clicked "Generate" from home page
  // Prevents auto-triggering API calls when browsing via sidebar
  generateRequested: boolean;
  setGenerateRequested: (val: boolean) => void;
  // Background tasks — global so they persist across page navigation
  extractProgress: ExtractProgress;
  startExtraction: () => Promise<void>;
  synthesizeProgress: SynthesizeProgress;
  startSynthesis: (targetDuration: number) => Promise<void>;
  startCombinedExtractionAndSynthesis: (targetDuration: number) => Promise<void>;
  // Legacy (kept for script page compatibility)
  globalVideoModel: string;
  globalImageModel: string;
  globalAudioModel: string;
  globalScriptModel: string;
  setGlobalScriptModel: (model: string) => void;
  // Script Generation Progress (Background)
  scriptGenerationProgress: ScriptGenerationProgress;
  startScriptGeneration: () => Promise<void>;
  resetScriptGeneration: () => void;
  // Director Mode
  directorMode: boolean;
  setDirectorMode: (val: boolean) => void;
  // Caption Settings
  captionStyle: CaptionStyle;
  setCaptionStyle: (style: CaptionStyle) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = "link2video_state";

// Read all saved state at once (only call on client after mount)
function loadAllSaved(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with defaults (matches server render for hydration)
  const [mode, setMode] = useState<AppMode>("link");
  const [url, setUrl] = useState("");
  const [angle, setAngle] = useState("");
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [qualityTier, setQualityTier] = useState<QualityTier>("basic");
  const [globalVisualStyle, setGlobalVisualStyle] = useState("Cinematic Documentary");
  const [videoDimension, setVideoDimension] = useState<VideoDimension>(VIDEO_DIMENSIONS[0]);
  const [selectedVoice, setSelectedVoice] = useState("adam");
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [pollenUsed, setPollenUsed] = useState(0);
  const [pollenBalance, setPollenBalance] = useState<number | null>(null);
  const [pollenTier, setPollenTier] = useState<string | null>(null);
  const [pollenResetAt, setPollenResetAt] = useState<string | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch Pollinations balance on mount and whenever pollen is consumed
  useEffect(() => {
    let cancelled = false;
    const fetchBalance = async () => {
      setIsFetchingBalance(true);
      try {
        const res = await fetch("/api/balance");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.balance === "number") {
          setPollenBalance(data.balance);
          if (data.tier) setPollenTier(data.tier);
          if (data.resetAt) setPollenResetAt(data.resetAt);
        }
      } catch {
        // silently fail — balance is cosmetic
      } finally {
        if (!cancelled) setIsFetchingBalance(false);
      }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [pollenUsed]); // re-fetch every time credits are spent
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(3);
  const [directorMode, setDirectorMode] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({
    fontColor: "#ffffff",
    fontSize: 5,
    position: "bottom",
    showBackground: true,
  });
  const [videoResolution, setVideoResolution] = useState<VideoResolution>("720p");
  const [imagesPerScene, setImagesPerScene] = useState(6); // Default to 4-6 range (6)
  const [storyboardImages, setStoryboardImages] = useState<Record<number, string[]>>({});
  const [referenceImages, setReferenceImages] = useState<Record<string, string[]>>({});
  const [sceneAudioUrls, setSceneAudioUrls] = useState<Record<number, string>>({});
  const [sceneVideoUrls, setSceneVideoUrls] = useState<Record<number, string>>({});
  const [sceneDurations, setSceneDurations] = useState<Record<number, number>>({});
  const [youtubeStyleSuffix, setYoutubeStyleSuffix] = useState("");
  const [generateRequested, setGenerateRequested] = useState(false); // session-only, never persisted
  const [globalScriptModel] = useState("pollinations");
  // Short Story Mode
  const [storyText, setStoryText] = useState("");
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [settingText, setSettingText] = useState("");
  // Music Video Mode
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [musicSegments, setMusicSegments] = useState<MusicSegment[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  // Notepad Mode
  const [notepadData, setNotepadData] = useState<NotepadData>({ projectName: "", sources: [], images: [], synthesizedKnowledge: null, lastSynthesizedAt: null });

  // Sync videoDimension (width/height) when resolution or aspect ratio changes
  useEffect(() => {
    const res = VIDEO_RESOLUTIONS.find(r => r.id === videoResolution);
    if (!res) return;
    
    const longestSide = res.longestSide;
    const currentDim = videoDimension;
    const [wRatio, hRatio] = currentDim.id.split(":").map(Number);
    
    let newWidth, newHeight;
    if (wRatio >= hRatio) {
      // Landscape or Square
      newWidth = longestSide;
      newHeight = Math.round((longestSide * hRatio) / wRatio);
    } else {
      // Portrait
      newHeight = longestSide;
      newWidth = Math.round((longestSide * wRatio) / hRatio);
    }

    // Ensure even numbers for FFmpeg
    newWidth = Math.round(newWidth / 2) * 2;
    newHeight = Math.round(newHeight / 2) * 2;

    if (newWidth !== currentDim.width || newHeight !== currentDim.height) {
      setVideoDimension({ ...currentDim, width: newWidth, height: newHeight });
    }
  }, [videoResolution, videoDimension.id]);

  // ── Background task state (persists across page navigation) ──────────────
  const [extractProgress, setExtractProgress] = useState<ExtractProgress>({
    state: "idle", done: 0, total: 0, currentTitle: "", error: null,
  });
  const [synthesizeProgress, setSynthesizeProgress] = useState<SynthesizeProgress>({
    state: "idle", percent: 0, error: null,
  });

  const extractRef = useRef(false);
  const synthesizeRef = useRef(false);
  const notepadDataRef = useRef(notepadData);
  const directorModeRef = useRef(directorMode);

  // ── Script Generation (Background) ───────────────────────────────────────
  const [scriptGenerationProgress, setScriptGenerationProgress] = useState<ScriptGenerationProgress>({
    state: "idle", elapsedSeconds: 0, error: null
  });
  const scriptGenRef = useRef(false);
  const scriptTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetScriptGeneration = useCallback(() => {
    setScriptGenerationProgress({ state: "idle", elapsedSeconds: 0, error: null });
    scriptGenRef.current = false;
    if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
  }, []);

  const startScriptGeneration = useCallback(async () => {
    if (scriptGenRef.current) return;
    
    // Validate inputs using refs for latest state
    const hasInput = url || storyText || audioFile;
    if (!hasInput) {
      console.warn("[ScriptGen] No input provided (URL/Story/Audio)");
      return;
    }

    scriptGenRef.current = true;
    setScriptGenerationProgress({ state: "running", elapsedSeconds: 0, error: null });
    
    // Start timer
    if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
    scriptTimerRef.current = setInterval(() => {
      setScriptGenerationProgress(p => ({ ...p, elapsedSeconds: p.elapsedSeconds + 1 }));
    }, 1000);

    try {
      // Build request body
      const requestBody: Record<string, any> = {
        visualStyle: globalVisualStyle,
        durationMinutes: targetDurationMinutes,
        mode,
        ...(youtubeStyleSuffix ? { youtubeStyleSuffix } : {}),
        ...(activeStyle ? { activeStyle } : {}),
        ...(settingText ? { settingText } : {}),
        directorMode: directorModeRef.current,
      };

      if (mode === "short-story" || mode === "notepad") {
        requestBody.storyText = storyText;
        requestBody.characterProfiles = characterProfiles;
        if (angle) requestBody.angle = angle;
      } else if (mode === "music-video") {
        requestBody.lyrics = lyrics;
        requestBody.musicSegments = musicSegments;
        requestBody.characterProfiles = characterProfiles;
        if (audioDuration > 0) requestBody.durationMinutes = audioDuration / 60;
      } else {
        requestBody.url = url || "https://example.com/mock";
        requestBody.angle = angle;
        if (characterProfiles.length > 0) requestBody.characterProfiles = characterProfiles;
      }

      console.log("[ScriptGen] Starting API call...");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(900000), // 15 mins
      });

      if (!res.ok) throw new Error(`API failed with status ${res.status}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setScriptData(data);
      setScriptGenerationProgress(p => ({ ...p, state: "complete" }));
      console.log("[ScriptGen] Successfully completed.");
      
      // Clear timer
      if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
    } catch (err: any) {
      console.error("[ScriptGen] Error:", err);
      setScriptGenerationProgress(p => ({ ...p, state: "error", error: err.message || "Failed to generate script" }));
      if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
    } finally {
      scriptGenRef.current = false;
    }
  }, [url, storyText, audioFile, globalVisualStyle, targetDurationMinutes, mode, youtubeStyleSuffix, activeStyle, settingText, angle, characterProfiles, lyrics, musicSegments, audioDuration]);

  // Keep ref in sync
  useEffect(() => {
    notepadDataRef.current = notepadData;
    directorModeRef.current = directorMode;
  }, [notepadData, directorMode]);

  // Global extraction handler — runs per-source with accurate incremental progress
  const startExtraction = useCallback(() => {
    if (extractRef.current) return Promise.resolve(); // Already running
    
    // Check using our latest ref to prevent stale closure
    const unextracted = notepadDataRef.current.sources.filter((s: NotepadSource) => s.extractedFacts === null);
    if (unextracted.length === 0) return Promise.resolve(); // nothing to do

    extractRef.current = true;
    return (async () => {
      try {
        setExtractProgress({ state: "running", done: 0, total: unextracted.length, currentTitle: unextracted[0]?.title || "", error: null });

        for (let i = 0; i < unextracted.length; i++) {
          const source = unextracted[i];
          setExtractProgress(p => ({ ...p, done: i, currentTitle: source.title }));
          
          let success = false;
          let retries = 2;

          while (retries >= 0 && !success) {
            try {
              console.log(`[Extraction] Attempting ${source.title} (retries left: ${retries})...`);
              const res = await fetch("/api/notepad/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sources: [{ id: source.id, title: source.title, rawContent: source.rawContent }] }),
                signal: AbortSignal.timeout(150000), // 2.5 min — server allows 120s + network buffer
              });
              
              const data = await res.json();
              if (data.error) throw new Error(data.error);
              
              if (!data.extractions || data.extractions.length === 0) {
                throw new Error("No extracted facts returned");
              }

              const extraction = data.extractions[0];
              setNotepadData((p: NotepadData) => ({
                ...p,
                sources: p.sources.map((s: NotepadSource) => s.id === extraction.sourceId ? { ...s, extractedFacts: extraction.facts } : s),
              }));
              success = true;
              console.log(`[Extraction] Successfully extracted facts for ${source.title}`);
              
            } catch (err: any) {
              console.warn(`[Extraction] Failed attempt for ${source.title}:`, err.message);
              retries--;
              
              if (retries < 0) {
                console.log(`[Extraction] Max retries reached for ${source.title}. Using fallback facts.`);
                setNotepadData((p: NotepadData) => ({
                  ...p,
                  sources: p.sources.map((s: NotepadSource) => s.id === source.id ? {
                    ...s,
                    extractedFacts: [
                      `Source title: ${source.title}`,
                      `Content excerpt: ${source.rawContent ? source.rawContent.substring(0, 200).trim() : "No content provided"}${source.rawContent && source.rawContent.length > 200 ? "..." : ""}`,
                    ],
                  } : s),
                }));
                success = true; // Move to next source
              } else {
                await new Promise(r => setTimeout(r, 1500));
              }
            }
          }
          setExtractProgress(p => ({ ...p, done: i + 1 }));
        }

        console.log("[Extraction] All sources processed successfully.");
        setExtractProgress(p => ({ ...p, state: "complete" }));
        setTimeout(() => setExtractProgress({ state: "idle", done: 0, total: 0, currentTitle: "", error: null }), 3000);
      } catch (globalErr: any) {
        console.error("[Extraction] Global unhandled error in background task:", globalErr);
        setExtractProgress(p => ({ ...p, state: "error", error: globalErr.message || "Unknown error occurred" }));
        // Ensure UI resets eventually so user isn't permanently locked out
        setTimeout(() => setExtractProgress({ state: "idle", done: 0, total: 0, currentTitle: "", error: null }), 5000);
      } finally {
        extractRef.current = false;
      }
    })();
  }, []);

  // Global synthesis handler
  const startSynthesis = useCallback((targetDurationMins: number) => {
    if (synthesizeRef.current) return Promise.resolve();
    
    // Check using ref
    const sourcesWithFacts = notepadDataRef.current.sources
      .filter((s: NotepadSource) => s.extractedFacts && s.extractedFacts.length > 0)
      .map((s: NotepadSource) => ({ title: s.title, facts: s.extractedFacts! }));

    if (sourcesWithFacts.length === 0) return Promise.resolve();

    synthesizeRef.current = true;
    return (async () => {
      setSynthesizeProgress({ state: "running", percent: 10, error: null });

      // Simulated smooth increment while API works
      const interval = setInterval(() => {
        setSynthesizeProgress(p => {
          if (p.state !== "running") { clearInterval(interval); return p; }
          if (p.percent >= 90) return p;
          const inc = p.percent < 50 ? 4 : p.percent < 75 ? 2 : 1;
          return { ...p, percent: p.percent + inc };
        });
      }, 1500);

      try {
        const res = await fetch("/api/notepad/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sources: sourcesWithFacts, 
            targetDurationMinutes: targetDurationMins,
            directorMode: directorModeRef.current
          }),
          signal: AbortSignal.timeout(660000), // 11 min — server allows 600s (10 min) + network buffer
        });
        const data = await res.json();
        clearInterval(interval);
        
        if (data.error) throw new Error(data.error);

        setNotepadData((p: NotepadData) => ({
          ...p,
          synthesizedKnowledge: data.synthesis,
          lastSynthesizedAt: Date.now(),
          suggestedTitle: data.suggestedTitle,
          suggestedAngle: data.suggestedAngle,
          themes: data.themes,
          coreThesis: data.coreThesis,
        }));
        setSynthesizeProgress({ state: "complete", percent: 100, error: null });
        setTimeout(() => setSynthesizeProgress({ state: "idle", percent: 0, error: null }), 3000);
      } catch (e: any) {
        clearInterval(interval);
        setSynthesizeProgress({ state: "error", percent: 0, error: e.message || "Synthesis failed" });
        setTimeout(() => setSynthesizeProgress({ state: "idle", percent: 0, error: null }), 5000);
      } finally {
        synthesizeRef.current = false;
      }
    })();
  }, []);

  // Removed auto-triggering extraction as per user request

  // Consolidated handler for the new "Extract Knowledge" button
  const startCombinedExtractionAndSynthesis = useCallback(async (targetDurationMins: number) => {
    // 1. Run extraction for any pending sources
    const pending = notepadDataRef.current.sources.filter((s: NotepadSource) => s.extractedFacts === null);
    if (pending.length > 0) {
      console.log(`[Combined] Starting extraction for ${pending.length} pending sources...`);
      await startExtraction();
    } else {
      console.log("[Combined] No pending extractions needed.");
    }

    // 2. Trigger synthesis
    console.log("[Combined] Starting synthesis...");
    await startSynthesis(targetDurationMins);
  }, [startExtraction, startSynthesis]);

  // Hydrate state from localStorage AFTER mount (avoids hydration mismatch)
  useEffect(() => {
    const saved = loadAllSaved();
    if (Object.keys(saved).length === 0) return;
    if (saved.mode) setMode(saved.mode);
    if (saved.url) setUrl(saved.url);
    if (saved.angle) setAngle(saved.angle);
    if (saved.scriptData) setScriptData(saved.scriptData);
    if (saved.qualityTier) setQualityTier(saved.qualityTier);
    if (saved.globalVisualStyle) setGlobalVisualStyle(saved.globalVisualStyle);
    if (saved.videoDimension) setVideoDimension(saved.videoDimension);
    if (saved.videoResolution) setVideoResolution(saved.videoResolution);
    if (saved.selectedVoice) setSelectedVoice(saved.selectedVoice);
    if (saved.musicEnabled !== undefined) setMusicEnabled(saved.musicEnabled);
    if (saved.captionsEnabled !== undefined) setCaptionsEnabled(saved.captionsEnabled);
    if (saved.targetDurationMinutes) setTargetDurationMinutes(saved.targetDurationMinutes);
    if (saved.storyboardImages) setStoryboardImages(saved.storyboardImages);
    if (saved.referenceImages) setReferenceImages(saved.referenceImages);
    if (saved.sceneDurations) setSceneDurations(saved.sceneDurations);
    if (saved.youtubeStyleSuffix) setYoutubeStyleSuffix(saved.youtubeStyleSuffix);
    if (saved.storyText) setStoryText(saved.storyText);
    if (saved.characterProfiles) setCharacterProfiles(saved.characterProfiles);
    if (saved.activeStyle) setActiveStyle(saved.activeStyle);
    if (saved.settingText) setSettingText(saved.settingText);
    if (saved.audioFileName) setAudioFileName(saved.audioFileName);
    if (saved.lyrics) setLyrics(saved.lyrics);
    if (saved.musicSegments) setMusicSegments(saved.musicSegments);
    if (saved.audioDuration) setAudioDuration(saved.audioDuration);
    if (saved.notepadData) setNotepadData(saved.notepadData);
    if (saved.pollenUsed) setPollenUsed(saved.pollenUsed);
    if (saved.directorMode !== undefined) setDirectorMode(saved.directorMode);
    if (saved.captionStyle !== undefined) setCaptionStyle(saved.captionStyle);
    if (saved.scriptGenerationProgress) setScriptGenerationProgress(saved.scriptGenerationProgress);
  }, []);

  // Persist key state to localStorage/sessionStorage.
  // NOTE: audioFile, sceneAudioUrls, and sceneVideoUrls are excluded because
  // they contain large base64 data URLs that easily exceed the ~5 MB quota.
  // storyboardImages is included but stripped on quota failure (fallback) so
  // the rest of the state (scriptData, settings, etc.) is always preserved.
  useEffect(() => {
    try {
      const state = {
        mode, url, angle, scriptData, qualityTier, globalVisualStyle,
        videoDimension, selectedVoice, musicEnabled, captionsEnabled,
        targetDurationMinutes, referenceImages, sceneDurations,
        storyboardImages,
        imagesPerScene,
        videoResolution,
        storyText, characterProfiles, activeStyle, settingText, audioFileName,
        lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
        pollenUsed,
        notepadData: { ...notepadData, sources: notepadData.sources.map(s => ({ ...s, rawContent: s.rawContent.substring(0, 10000) })) },
        directorMode,
        captionStyle,
        scriptGenerationProgress,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    } catch (e) {
      // Quota exceeded — retry without storyboardImages (they're the largest)
      console.warn("localStorage quota exceeded, retrying without images:", e);
      try {
        const fallbackState = {
          mode, url, angle, scriptData, qualityTier, globalVisualStyle,
          videoDimension, selectedVoice, musicEnabled, captionsEnabled,
          targetDurationMinutes, referenceImages, sceneDurations,
          storyboardImages: {},
          storyText, characterProfiles, activeStyle, settingText, audioFileName,
          lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
          notepadData: { projectName: notepadData.projectName, sources: [], images: [], synthesizedKnowledge: notepadData.synthesizedKnowledge, lastSynthesizedAt: notepadData.lastSynthesizedAt },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackState));
      } catch { /* truly full — nothing we can do */ }
    }
  }, [
    mode, url, angle, scriptData, qualityTier, globalVisualStyle,
    videoDimension, selectedVoice, musicEnabled, captionsEnabled,
    targetDurationMinutes, referenceImages, sceneDurations,
    storyboardImages,
    storyText, characterProfiles, settingText, audioFileName,
    lyrics, musicSegments, audioDuration, youtubeStyleSuffix, notepadData, directorMode, captionStyle,
  ]);

  // Derived model values based on quality tier
  const globalVideoModel = qualityTier === "pro" ? "pollinations:wan" : "kenburns";
  const globalImageModel = "pollinations:nanobanana-pro";
  const globalAudioModel = qualityTier === "basic" ? "edge-tts" : "pollinations:elevenlabs";

  return (
    <AppContext.Provider value={{
      mode, setMode,
      url, setUrl,
      angle, setAngle,
      scriptData, setScriptData,
      isGenerating, setIsGenerating,
      finalVideoUrl, setFinalVideoUrl,
      qualityTier, setQualityTier,
      globalVisualStyle, setGlobalVisualStyle,
      videoDimension, setVideoDimension,
      selectedVoice, setSelectedVoice,
      musicEnabled, setMusicEnabled,
      captionsEnabled, setCaptionsEnabled,
      pollenUsed, setPollenUsed,
      pollenBalance, pollenTier, pollenResetAt,
      isFetchingBalance, hasMounted,
      targetDurationMinutes, setTargetDurationMinutes,
      videoResolution, setVideoResolution,
      imagesPerScene, setImagesPerScene,
      storyboardImages, setStoryboardImages,
      referenceImages, setReferenceImages,
      sceneAudioUrls, setSceneAudioUrls,
      sceneVideoUrls, setSceneVideoUrls,
      sceneDurations, setSceneDurations,
      youtubeStyleSuffix, setYoutubeStyleSuffix,
      storyText, setStoryText,
      characterProfiles, setCharacterProfiles,
      activeStyle, setActiveStyle,
      settingText, setSettingText,
      audioFile, setAudioFile,
      audioFileName, setAudioFileName,
      lyrics, setLyrics,
      musicSegments, setMusicSegments,
      audioDuration, setAudioDuration,
      globalVideoModel,
      globalImageModel,
      globalAudioModel,
      notepadData, setNotepadData,
      generateRequested, setGenerateRequested,
      extractProgress, startExtraction,
      synthesizeProgress, startSynthesis,
      startCombinedExtractionAndSynthesis,
      globalScriptModel,
      setGlobalScriptModel: () => {},
      scriptGenerationProgress,
      startScriptGeneration,
      resetScriptGeneration,
      directorMode,
      setDirectorMode,
      captionStyle,
      setCaptionStyle,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
