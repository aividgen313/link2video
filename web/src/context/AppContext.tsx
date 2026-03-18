"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  globalVideoModel: string;
  setGlobalVideoModel: (model: string) => void;
  globalImageModel: string;
  setGlobalImageModel: (model: string) => void;
  globalAudioModel: string;
  setGlobalAudioModel: (model: string) => void;
  globalScriptModel: string;
  setGlobalScriptModel: (model: string) => void;
  qualityTier: string;
  setQualityTier: (tier: string) => void;
  globalVisualStyle: string;
  setGlobalVisualStyle: (style: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState("");
  const [angle, setAngle] = useState("");
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  
  // Quality Tier State
  const [qualityTier, setQualityTier] = useState("Medium");
  
  // Default Global Models
  const [globalVideoModel, setGlobalVideoModel] = useState("klingai:video-3-0-standard");
  const [globalImageModel, setGlobalImageModel] = useState("runware:101@1");
  const [globalAudioModel, setGlobalAudioModel] = useState("elevenlabs:1@1");
  const [globalScriptModel, setGlobalScriptModel] = useState("gemini-2.0-flash");
  const [globalVisualStyle, setGlobalVisualStyle] = useState("Cinematic Documentary");

  // Sync Quality Tier to Models
  useEffect(() => {
    switch (qualityTier) {
      case "Premium":
        setGlobalVideoModel("klingai:video-3-0-pro");
        setGlobalImageModel("alibaba:qwen-image-2-0");
        break;
      case "Medium":
        setGlobalVideoModel("klingai:video-3-0-standard");
        setGlobalImageModel("runware:101@1");
        break;
      case "Basic":
        setGlobalVideoModel("lightricks:ltx-2.3-fast");
        setGlobalImageModel("bytedance:seedream-5-0-lite");
        break;
      case "Custom":
      default:
        break; // Leave models as they are
    }
  }, [qualityTier]);

  return (
    <AppContext.Provider value={{
      url, setUrl,
      angle, setAngle,
      scriptData, setScriptData,
      isGenerating, setIsGenerating,
      finalVideoUrl, setFinalVideoUrl,
      globalVideoModel, setGlobalVideoModel,
      globalImageModel, setGlobalImageModel,
      globalAudioModel, setGlobalAudioModel,
      qualityTier, setQualityTier,
      globalScriptModel, setGlobalScriptModel,
      globalVisualStyle, setGlobalVisualStyle
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
