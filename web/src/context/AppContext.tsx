"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

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
// xAI Grok EXACT pricing (from docs.x.ai/developers/models):
//
// TEXT: grok-4-1-fast-non-reasoning
//   Input:  $0.20 / 1M tokens (cached: $0.05)
//   Output: $0.50 / 1M tokens
//   Per script gen (~3K in + 2K out): ~$0.0016
//   Per scene (amortized across 8): ~$0.001
//
// IMAGE: grok-imagine-image = $0.02 per image
//
// VIDEO: grok-imagine-video = $0.05 per SECOND
//   8-second scene = $0.40  ← THIS IS EXPENSIVE
//   15-second scene = $0.75
//
// TTS: ElevenLabs via Pollinations (free with API key)
// Edge TTS: free (basic tier)
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
    description: "Grok Text + Pollinations Images + Grok Video (key scenes)",
    usdPerScene: 0.001, // base: $0.001 text + FREE images (video scenes add ~$0.40 each)
    usdBreakdown: "Free images + $0.40 for 2-3 video scenes",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    useAIVideo: true,
    videoSceneStrategy: "key_scenes" as const, // only hook + climax + ending get video
    maxVideoScenes: 3, // cap at 3 Grok Video scenes
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "grok",
  },
  pro: {
    label: "Pro",
    description: "Grok Text + Pollinations Images + Grok Video (all scenes)",
    usdPerScene: 0.40, // $0.001 text + FREE images + $0.40 video (8s × $0.05/s)
    usdBreakdown: "Free images + $0.40/video (all scenes)",
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    borderColor: "border-tertiary/20",
    useAIVideo: true,
    videoSceneStrategy: "all" as const, // every scene gets AI video
    usePollsTTS: true,
    imageModel: "pollinations",
    textModel: "grok",
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

export function AppProvider({ children }: { children: ReactNode }) {
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
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(3);
  const [storyboardImages, setStoryboardImages] = useState<Record<number, string>>({});
  const [referenceImages, setReferenceImages] = useState<Record<string, string[]>>({});
  const [globalScriptModel] = useState("groq");
  // Short Story Mode
  const [storyText, setStoryText] = useState("");
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  // Music Video Mode
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [musicSegments, setMusicSegments] = useState<MusicSegment[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);

  // Derived model values based on quality tier
  const globalVideoModel = qualityTier === "pro" ? "pollinations:wan" : "kenburns";
  const globalImageModel = "pollinations:flux";
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
