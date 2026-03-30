"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AppMode = "link" | "short-story" | "music-video" | "notepad";

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
};

export type ScriptData = {
  id?: string;
  title: string;
  angle: string;
  scenes: Scene[];
  characterProfiles?: CharacterProfile[];
  character_identities?: Record<string, string>; // locked physical descriptions per character (from AI)
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

export type QualityTier = "basic" | "medium" | "pro";

export type VideoDimension = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
};

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
  basic: {
    label: "Basic",
    description: "Free — Pollinations Text + Images + Ken Burns + Edge TTS",
    // Basic is FREE: Edge TTS (free) + Pollinations images (free tier) + Ken Burns (client-side)
    // Only cost is text generation (negligible) and images
    pollenPerImageScene: 0.00012, // 1 image per scene
    pollenPerTTS: 0,              // Edge TTS is free
    pollenPerVideoScene: 0,       // Ken Burns is client-side, free
    pollenFixed: 0.0009,          // 1 text generation call
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    useAIVideo: false,
    videoSceneStrategy: "none" as const,
    usePollsTTS: false, // Edge TTS (free)
    imageModel: "pollinations",
    textModel: "pollinations",
  },
  medium: {
    label: "Medium",
    description: "Pollinations Text + Images + Alternating AI Video & Ken Burns",
    // Per-scene costs (applied individually based on whether scene gets AI video or not)
    pollenPerImageScene: 0.00012, // 1 image per scene
    pollenPerTTS: 0.001,          // ElevenLabs TTS per scene
    pollenPerVideoScene: 0.40,    // AI video cost (only for video scenes, ~8s × $0.05/s)
    pollenFixed: 0.002,           // text gen + music gen
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    useAIVideo: true,
    videoSceneStrategy: "alternating" as const, // 3 AI video, 3 Ken Burns, repeating
    alternatingGroupSize: 3,
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "pollinations",
  },
  pro: {
    label: "Pro",
    description: "Pollinations Text + Images + AI Video (all scenes)",
    pollenPerImageScene: 0.00012, // 1 image per scene
    pollenPerTTS: 0.001,          // ElevenLabs TTS per scene
    pollenPerVideoScene: 0.40,    // AI video cost per scene (~8s × $0.05/s)
    pollenFixed: 0.002,           // text gen + music gen
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    borderColor: "border-tertiary/20",
    useAIVideo: true,
    videoSceneStrategy: "all" as const,
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "pollinations",
  },
};

// Helper: calculate accurate total cost for a given tier and scene count
export function calculateTotalCost(tierKey: QualityTier, sceneCount: number, musicEnabled: boolean = false): number {
  const tier = QUALITY_TIERS[tierKey] || QUALITY_TIERS.basic;
  const imageCost = (tier.pollenPerImageScene || 0) * sceneCount;
  const ttsCost = tier.pollenPerTTS * sceneCount;

  // Calculate how many scenes get AI video
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
  const videoCost = tier.pollenPerVideoScene * videoSceneCount;
  const musicCost = musicEnabled ? POLLEN_COSTS.musicGeneration : 0;

  return tier.pollenFixed + imageCost + ttsCost + videoCost + musicCost;
}

// Pollinations pricing reference (1 pollen ≈ $1 USD)
export const POLLEN_COSTS = {
  textGeneration: 0.0009,    // per API call (script, angles)
  imageGeneration: 0.00012,  // per image (nanobanana-pro)
  ttsGeneration: 0.001,      // per TTS request (elevenlabs)
  videoPerSecond: 0.05,      // per second of AI video (wan model)
  musicGeneration: 0.001,    // per music generation request
  avgSceneDuration: 8,       // average scene duration in seconds
};

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
  setPollenUsed: (pollen: number) => void;
  pollenBalance: number | null;
  isFetchingBalance: boolean;
  targetDurationMinutes: number;
  setTargetDurationMinutes: (min: number) => void;
  storyboardImages: Record<number, string>;
  setStoryboardImages: (imgs: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
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
  // Legacy (kept for script page compatibility)
  globalVideoModel: string;
  globalImageModel: string;
  globalAudioModel: string;
  globalScriptModel: string;
  setGlobalScriptModel: (model: string) => void;
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
  const isHydrating = React.useRef(true);
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
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

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
  const [storyboardImages, setStoryboardImages] = useState<Record<number, string>>({});
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

  // Hydrate state from localStorage AFTER mount (avoids hydration mismatch)
  useEffect(() => {
    const saved = loadAllSaved();
    if (!saved || Object.keys(saved).length === 0) {
      isHydrating.current = false;
      return;
    }
    
    // Batch updates where possible or just apply directly since it's on mount
    if (saved.mode && ["link", "short-story", "music-video", "notepad"].includes(saved.mode)) setMode(saved.mode as AppMode);
    if (saved.url && typeof saved.url === "string") setUrl(saved.url);
    if (saved.angle && typeof saved.angle === "string") setAngle(saved.angle);
    if (saved.scriptData && typeof saved.scriptData === "object") setScriptData(saved.scriptData);
    
    // Strict validation for quality tier
    if (saved.qualityTier && ["basic", "medium", "pro"].includes(saved.qualityTier)) {
      setQualityTier(saved.qualityTier as QualityTier);
    } else {
      setQualityTier("basic");
    }
    
    if (saved.globalVisualStyle && typeof saved.globalVisualStyle === "string") setGlobalVisualStyle(saved.globalVisualStyle);
    if (saved.videoDimension && typeof saved.videoDimension === "object") setVideoDimension(saved.videoDimension);
    if (saved.selectedVoice && typeof saved.selectedVoice === "string") setSelectedVoice(saved.selectedVoice);
    if (saved.musicEnabled !== undefined) setMusicEnabled(!!saved.musicEnabled);
    if (saved.captionsEnabled !== undefined) setCaptionsEnabled(!!saved.captionsEnabled);
    if (saved.targetDurationMinutes) setTargetDurationMinutes(Number(saved.targetDurationMinutes) || 3);
    if (saved.storyboardImages && typeof saved.storyboardImages === "object" && !Array.isArray(saved.storyboardImages)) setStoryboardImages(saved.storyboardImages);
    if (saved.referenceImages && typeof saved.referenceImages === "object" && !Array.isArray(saved.referenceImages)) setReferenceImages(saved.referenceImages);
    if (saved.sceneDurations && typeof saved.sceneDurations === "object" && !Array.isArray(saved.sceneDurations)) setSceneDurations(saved.sceneDurations);
    if (saved.youtubeStyleSuffix && typeof saved.youtubeStyleSuffix === "string") setYoutubeStyleSuffix(saved.youtubeStyleSuffix);
    if (saved.storyText && typeof saved.storyText === "string") setStoryText(saved.storyText);
    if (saved.characterProfiles) setCharacterProfiles(Array.isArray(saved.characterProfiles) ? saved.characterProfiles : []);
    if (saved.activeStyle && typeof saved.activeStyle === "string") setActiveStyle(saved.activeStyle);
    if (saved.settingText && typeof saved.settingText === "string") setSettingText(saved.settingText);
    if (saved.audioFileName && typeof saved.audioFileName === "string") setAudioFileName(saved.audioFileName);
    if (saved.lyrics && typeof saved.lyrics === "string") setLyrics(saved.lyrics);
    if (saved.musicSegments) setMusicSegments(Array.isArray(saved.musicSegments) ? saved.musicSegments : []);
    if (saved.audioDuration) setAudioDuration(Number(saved.audioDuration) || 0);
    
    // Schema Migration & Validation for NotepadData
    let newNotepadData: NotepadData = { projectName: "", sources: [], images: [], synthesizedKnowledge: null, lastSynthesizedAt: null };
    if (saved.notepadData && typeof saved.notepadData === "object") {
      newNotepadData = {
        projectName: typeof saved.notepadData.projectName === "string" ? saved.notepadData.projectName : "",
        sources: Array.isArray(saved.notepadData.sources) ? saved.notepadData.sources : [],
        images: Array.isArray(saved.notepadData.images) ? saved.notepadData.images : [],
        synthesizedKnowledge: typeof saved.notepadData.synthesizedKnowledge === "string" ? saved.notepadData.synthesizedKnowledge : null,
        lastSynthesizedAt: typeof saved.notepadData.lastSynthesizedAt === "number" ? saved.notepadData.lastSynthesizedAt : null,
      };
    }
    setNotepadData(newNotepadData);

    // Hydration finished
    // Use requestAnimationFrame to let React process the massive batch of state updates,
    // then clear the hydration flag so the persistence effect can safely run.
    requestAnimationFrame(() => {
      setTimeout(() => {
        isHydrating.current = false;
      }, 150);
    });
  }, []);

  // Persist key state to localStorage/sessionStorage.
  useEffect(() => {
    if (isHydrating.current) return;

    try {
      const state = {
        mode, url, angle, scriptData, qualityTier, globalVisualStyle,
        videoDimension, selectedVoice, musicEnabled, captionsEnabled,
        targetDurationMinutes, referenceImages, sceneDurations,
        storyboardImages,
        storyText, characterProfiles, activeStyle, settingText, audioFileName,
        lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
        notepadData: { 
          ...notepadData, 
          sources: (notepadData.sources || []).map(s => ({ ...s, rawContent: (s.rawContent || "").substring(0, 10000) })) 
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    } catch (e) {
      // Quota exceeded — retry without storyboardImages
      console.warn("localStorage quota exceeded, retrying without images:", e);
      try {
        const fallbackState = {
          mode, url, angle, scriptData, qualityTier, globalVisualStyle,
          videoDimension, selectedVoice, musicEnabled, captionsEnabled,
          targetDurationMinutes, referenceImages, sceneDurations,
          storyboardImages: {},
          storyText, characterProfiles, activeStyle, settingText, audioFileName,
          lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
          notepadData: { 
            projectName: notepadData.projectName, 
            sources: [], 
            images: [], 
            synthesizedKnowledge: notepadData.synthesizedKnowledge, 
            lastSynthesizedAt: notepadData.lastSynthesizedAt 
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackState));
      } catch { /* truly full */ }
    }
  }, [
    mode, url, angle, scriptData, qualityTier, globalVisualStyle,
    videoDimension, selectedVoice, musicEnabled, captionsEnabled,
    targetDurationMinutes, referenceImages, sceneDurations,
    storyboardImages,
    storyText, characterProfiles, settingText, audioFileName,
    lyrics, musicSegments, audioDuration, youtubeStyleSuffix, notepadData,
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
      pollenBalance, isFetchingBalance,
      targetDurationMinutes, setTargetDurationMinutes,
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
      globalScriptModel,
      setGlobalScriptModel: () => {},
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
