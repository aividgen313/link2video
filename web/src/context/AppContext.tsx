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
  const tier = QUALITY_TIERS[tierKey];
  const imageCost = tier.pollenPerImageScene * sceneCount;
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
  // Music Video Mode
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [musicSegments, setMusicSegments] = useState<MusicSegment[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);

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
    if (saved.audioFileName) setAudioFileName(saved.audioFileName);
    if (saved.lyrics) setLyrics(saved.lyrics);
    if (saved.musicSegments) setMusicSegments(saved.musicSegments);
    if (saved.audioDuration) setAudioDuration(saved.audioDuration);
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
        storyText, characterProfiles, audioFileName,
        lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
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
          storyText, characterProfiles, audioFileName,
          lyrics, musicSegments, audioDuration, youtubeStyleSuffix,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackState));
      } catch { /* truly full — nothing we can do */ }
    }
  }, [
    mode, url, angle, scriptData, qualityTier, globalVisualStyle,
    videoDimension, selectedVoice, musicEnabled, captionsEnabled,
    targetDurationMinutes, referenceImages, sceneDurations,
    storyboardImages,
    storyText, characterProfiles, audioFileName,
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
      audioFile, setAudioFile,
      audioFileName, setAudioFileName,
      lyrics, setLyrics,
      musicSegments, setMusicSegments,
      audioDuration, setAudioDuration,
      globalVideoModel,
      globalImageModel,
      globalAudioModel,
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
