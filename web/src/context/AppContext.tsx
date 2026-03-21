"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type Scene = {
  id: number;
  scene_number: number;
  narration: string;
  visual_prompt: string;
  duration_estimate_seconds: number;
  video_model_override?: string;
  image_model_override?: string;
};

export type ScriptData = {
  title: string;
  angle: string;
  scenes: Scene[];
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

// Credit costs per scene (in Pollinations credits)
export const QUALITY_TIERS = {
  basic: {
    label: "Basic",
    description: "Free — Edge TTS + AI Images (Ken Burns)",
    creditsPerScene: 0.002,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    useAIVideo: false,
    usePollsTTS: false, // Uses Edge TTS (free)
  },
  medium: {
    label: "Medium",
    description: "ElevenLabs TTS + HD Images",
    creditsPerScene: 0.004,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    useAIVideo: false,
    usePollsTTS: true,
  },
  pro: {
    label: "Pro",
    description: "AI Video Generation (Wan model)",
    creditsPerScene: 0.016,
    color: "text-tertiary",
    bgColor: "bg-tertiary/10",
    borderColor: "border-tertiary/20",
    useAIVideo: true,
    usePollsTTS: true,
  },
};

interface AppContextType {
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
  storyboardImages: Record<number, string>;
  setStoryboardImages: (imgs: Record<number, string>) => void;
  // Legacy (kept for script page compatibility)
  globalVideoModel: string;
  globalImageModel: string;
  globalAudioModel: string;
  globalScriptModel: string;
  setGlobalScriptModel: (model: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
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
  const [storyboardImages, setStoryboardImages] = useState<Record<number, string>>({});
  const [globalScriptModel] = useState("groq");

  // Derived model values based on quality tier
  const globalVideoModel = qualityTier === "pro" ? "pollinations:wan" : "kenburns";
  const globalImageModel = "pollinations:flux";
  const globalAudioModel = qualityTier === "basic" ? "edge-tts" : "pollinations:elevenlabs";

  return (
    <AppContext.Provider value={{
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
      storyboardImages, setStoryboardImages,
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
