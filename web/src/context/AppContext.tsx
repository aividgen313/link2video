"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AppMode = "link" | "short-story" | "music-video";

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
  title: string;
  angle: string;
  scenes: Scene[];
  characterProfiles?: CharacterProfile[];
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
    description: "Free — Pollinations Text + Images + Ken Burns",
    usdPerScene: 0.00,
    usdBreakdown: "Free (Pollinations)",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    useAIVideo: false,
    videoSceneStrategy: "none" as const, // no AI video
    usePollsTTS: false, // Edge TTS (free)
    imageModel: "pollinations",
    textModel: "pollinations",
  },
  medium: {
    label: "Medium",
    description: "Pollinations Text + Images + Alternating AI Video & Ken Burns",
    usdPerScene: 0.00,
    usdBreakdown: "3 AI video → 3 Ken Burns → repeating",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    useAIVideo: true,
    videoSceneStrategy: "alternating" as const, // 3 AI video, 3 Ken Burns, repeating
    alternatingGroupSize: 3, // group size for alternating pattern
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "pollinations",
  },
  pro: {
    label: "Pro",
    description: "Pollinations Text + Images + AI Video (all scenes)",
    usdPerScene: 0.00,
    usdBreakdown: "Pollinations credits for all video scenes",
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    borderColor: "border-tertiary/20",
    useAIVideo: true,
    videoSceneStrategy: "all" as const, // every scene gets AI video
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "pollinations",
  },
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
  creditsUsed: number;
  setCreditsUsed: (credits: number) => void;
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
  // YouTube style clone suffix (appended to every visual_prompt)
  youtubeStyleSuffix: string;
  setYoutubeStyleSuffix: (suffix: string) => void;
  // Short Story Mode
  storyText: string;
  setStoryText: (text: string) => void;
  characterProfiles: CharacterProfile[];
  setCharacterProfiles: (profiles: CharacterProfile[]) => void;
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
  // Legacy (kept for script page compatibility)
  globalVideoModel: string;
  globalImageModel: string;
  globalAudioModel: string;
  globalScriptModel: string;
  setGlobalScriptModel: (model: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = "link2video_state";

function loadSaved<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    // Try localStorage first (persistent), fall back to sessionStorage (legacy)
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return key in parsed ? parsed[key] : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>(() => loadSaved("mode", "link"));
  const [url, setUrl] = useState(() => loadSaved("url", ""));
  const [angle, setAngle] = useState(() => loadSaved("angle", ""));
  const [scriptData, setScriptData] = useState<ScriptData | null>(() => loadSaved("scriptData", null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [qualityTier, setQualityTier] = useState<QualityTier>(() => loadSaved("qualityTier", "basic"));
  const [globalVisualStyle, setGlobalVisualStyle] = useState(() => loadSaved("globalVisualStyle", "Cinematic Documentary"));
  const [videoDimension, setVideoDimension] = useState<VideoDimension>(() => loadSaved("videoDimension", VIDEO_DIMENSIONS[0]));
  const [selectedVoice, setSelectedVoice] = useState(() => loadSaved("selectedVoice", "adam"));
  const [musicEnabled, setMusicEnabled] = useState(() => loadSaved("musicEnabled", false));
  const [captionsEnabled, setCaptionsEnabled] = useState(() => loadSaved("captionsEnabled", false));
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(() => loadSaved("targetDurationMinutes", 3));
  const [storyboardImages, setStoryboardImages] = useState<Record<number, string>>(() => loadSaved("storyboardImages", {}));
  const [referenceImages, setReferenceImages] = useState<Record<string, string[]>>(() => loadSaved("referenceImages", {}));
  const [sceneAudioUrls, setSceneAudioUrls] = useState<Record<number, string>>(() => loadSaved("sceneAudioUrls", {}));
  const [sceneVideoUrls, setSceneVideoUrls] = useState<Record<number, string>>(() => loadSaved("sceneVideoUrls", {}));
  const [youtubeStyleSuffix, setYoutubeStyleSuffix] = useState(() => loadSaved("youtubeStyleSuffix", ""));
  const [globalScriptModel] = useState("pollinations");
  // Short Story Mode
  const [storyText, setStoryText] = useState(() => loadSaved("storyText", ""));
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>(() => loadSaved("characterProfiles", []));
  // Music Video Mode
  const [audioFile, setAudioFile] = useState<string | null>(() => loadSaved("audioFile", null));
  const [audioFileName, setAudioFileName] = useState<string | null>(() => loadSaved("audioFileName", null));
  const [lyrics, setLyrics] = useState(() => loadSaved("lyrics", ""));
  const [musicSegments, setMusicSegments] = useState<MusicSegment[]>(() => loadSaved("musicSegments", []));
  const [audioDuration, setAudioDuration] = useState(() => loadSaved("audioDuration", 0));

  // Persist key state to sessionStorage
  useEffect(() => {
    try {
      const state = {
        mode, url, angle, scriptData, qualityTier, globalVisualStyle,
        videoDimension, selectedVoice, musicEnabled, captionsEnabled,
        targetDurationMinutes, storyboardImages, referenceImages,
        sceneAudioUrls, sceneVideoUrls,
        storyText, characterProfiles, audioFile, audioFileName,
        lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }, [
    mode, url, angle, scriptData, qualityTier, globalVisualStyle,
    videoDimension, selectedVoice, musicEnabled, captionsEnabled,
    targetDurationMinutes, storyboardImages, referenceImages,
    sceneAudioUrls, sceneVideoUrls,
    storyText, characterProfiles, audioFile, audioFileName,
    lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
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
      creditsUsed, setCreditsUsed,
      targetDurationMinutes, setTargetDurationMinutes,
      storyboardImages, setStoryboardImages,
      referenceImages, setReferenceImages,
      sceneAudioUrls, setSceneAudioUrls,
      sceneVideoUrls, setSceneVideoUrls,
      youtubeStyleSuffix, setYoutubeStyleSuffix,
      storyText, setStoryText,
      characterProfiles, setCharacterProfiles,
      audioFile, setAudioFile,
      audioFileName, setAudioFileName,
      lyrics, setLyrics,
      musicSegments, setMusicSegments,
      audioDuration, setAudioDuration,
      globalVideoModel,
      globalImageModel,
      globalAudioModel,
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
