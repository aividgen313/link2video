"use client";
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { Scene, useAppContext } from "./AppContext";

// ── Types ──

export type TransitionType = "none" | "fade" | "dissolve" | "wipe-left" | "wipe-right" | "zoom-in" | "zoom-out" | "slide-left" | "slide-right";
export type FilterType = "none" | "cinematic" | "vintage" | "noir" | "warm" | "cool" | "vivid" | "muted" | "sepia" | "dramatic";
export type KenBurnsDirection = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

export interface TextOverlay {
  id: string;
  text: string;
  position: "center" | "lower-third" | "top" | "custom";
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  letterSpacing?: number;
  lineHeight?: number;
  backgroundColor?: string;
  opacity?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderRadius?: number;
  padding?: number;
  strokeWidth?: number;
  strokeColor?: string;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  animation?: "none" | "fade-in" | "slide-up" | "typewriter" | "scale-in" | "bounce" | "glow";
}

export interface EditorScene {
  id: number;
  orderIndex: number;
  trackId: string; // which track this clip lives on
  narration: string;
  visual_prompt: string;
  duration: number;
  imageUrl: string;
  audioUrl: string | null;
  aiVideoUrl: string | null;
  overlays: TextOverlay[];
  camera_angle?: string;
  lighting?: string;
  mood?: string;
  // Features
  transition: TransitionType;
  transitionDuration: number; // seconds (0.3 - 2.0)
  filter: FilterType;
  kenBurns: KenBurnsDirection;
  playbackSpeed: number; // 0.25 - 4.0
  volume: number; // 0-1 for scene audio
  isMuted: boolean;
  isLocked: boolean;
  isHidden: boolean;
  marker?: string; // bookmark label
  // For imported media
  sourceFileName?: string;
}

export type TrackType = "video" | "audio";

export interface EditorTrack {
  id: string;
  type: TrackType;
  label: string; // "V1", "V2", "A1" etc
  isMuted: boolean;
  isLocked: boolean;
  isCollapsed: boolean;
  volume: number; // 0-1 for audio tracks
  height: number; // px for timeline rendering
}

export interface MusicTrackState {
  url: string;
  name: string;
  duration: number;
  volume: number;
}

export interface ExportProgress {
  percent: number;
  status: string;
  isExporting: boolean;
}

interface HistoryEntry {
  scenes: EditorScene[];
  selectedSceneId: number | null;
}

interface EditorContextType {
  scenes: EditorScene[];
  setScenes: (scenes: EditorScene[]) => void;
  selectedSceneId: number | null;
  setSelectedSceneId: (id: number | null) => void;
  selectedScene: EditorScene | null;
  playheadPosition: number;
  setPlayheadPosition: (pos: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  musicTrack: MusicTrackState | null;
  setMusicTrack: (track: MusicTrackState | null) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  exportProgress: ExportProgress | null;
  setExportProgress: (progress: ExportProgress | null) => void;
  totalDuration: number;

  // Tracks
  tracks: EditorTrack[];
  addTrack: (type: TrackType) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<EditorTrack>) => void;
  getTrackScenes: (trackId: string) => EditorScene[];

  // Selection
  selectedSceneIds: Set<number>;
  toggleSceneSelection: (id: number) => void;
  selectAllScenes: () => void;
  clearSelection: () => void;

  // Actions
  reorderScene: (fromIndex: number, toIndex: number) => void;
  updateScene: (id: number, updates: Partial<EditorScene>) => void;
  deleteScene: (id: number) => void;
  duplicateScene: (id: number) => void;
  splitScene: (id: number, splitAt: number) => void;
  insertScene: (afterId: number | null) => void;
  mergeScenes: (id1: number, id2: number) => void;
  importMedia: (file: File, trackId?: string) => Promise<void>;
  addOverlay: (sceneId: number, overlay: TextOverlay) => void;
  updateOverlay: (sceneId: number, overlayId: string, updates: Partial<TextOverlay>) => void;
  removeOverlay: (sceneId: number, overlayId: string) => void;
  getSceneAtTime: (time: number) => EditorScene | null;
  getSceneStartTime: (sceneId: number) => number;
  isInitialized: boolean;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Batch operations
  applyToSelected: (updates: Partial<EditorScene>) => void;
  deleteSelected: () => void;

  // Snap & grid
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;

  // Preview
  showSafeZones: boolean;
  setShowSafeZones: (v: boolean) => void;
  previewScale: "fit" | "fill" | "100";
  setPreviewScale: (v: "fit" | "fill" | "100") => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function useEditorContext() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorProvider");
  return ctx;
}

// ── Smart auto-assignment helpers ──

const TRANSITION_ROTATE: TransitionType[] = [
  "fade", "dissolve", "fade", "wipe-left", "fade", "dissolve", "fade", "wipe-right",
];

function pickTransition(scene: Scene, index: number, total: number): TransitionType {
  if (index === 0) return "none"; // first scene has no incoming transition

  const mood = (scene.mood || "").toLowerCase();
  const camera = (scene.camera_angle || "").toLowerCase();
  const text = `${mood} ${camera} ${(scene.narration || "").toLowerCase()}`;

  if (/emotional|touching|sad|heartfelt|tender|grief|powerful|dramatic/.test(text)) return "dissolve";
  if (/fast|action|energetic|intense|exciting|rapid|dynamic/.test(text)) return index % 2 === 0 ? "wipe-left" : "wipe-right";
  if (/establishing|wide|aerial|birds.eye|overview|landscape/.test(text)) return "zoom-in";
  if (/close.?up|portrait|intimate|face|detailed/.test(text)) return "fade";
  if (index === total - 1) return "fade"; // last scene always fades out cleanly

  return TRANSITION_ROTATE[index % TRANSITION_ROTATE.length];
}

function pickKenBurns(scene: Scene, index: number): KenBurnsDirection {
  const text = `${(scene.camera_angle || "").toLowerCase()} ${(scene.narration || "").toLowerCase()}`;
  if (/wide|establishing|aerial|landscape|overview|exterior/.test(text)) return "zoom-in";
  if (/close.?up|tight|portrait|face|detail/.test(text)) return "zoom-out";
  if (/left|west|backward|retreat/.test(text)) return "pan-left";
  if (/right|east|forward|advance/.test(text)) return "pan-right";
  if (/up|rise|ascend|sky|height/.test(text)) return "pan-up";
  if (/down|fall|descend|ground/.test(text)) return "pan-down";
  // Alternate zoom-in / zoom-out for visual variety
  return index % 2 === 0 ? "zoom-in" : "zoom-out";
}

// ── Provider ──

const MAX_HISTORY = 50;

const DEFAULT_TRACKS: EditorTrack[] = [
  { id: "v1", type: "video", label: "V1", isMuted: false, isLocked: false, isCollapsed: false, volume: 1, height: 60 },
  { id: "a1", type: "audio", label: "A1", isMuted: false, isLocked: false, isCollapsed: false, volume: 1, height: 36 },
];

export function EditorProvider({ children }: { children: ReactNode }) {
  const { scriptData, storyboardImages, sceneAudioUrls, sceneVideoUrls } = useAppContext();

  const [isInitialized, setIsInitialized] = useState(false);
  const [scenes, setScenesRaw] = useState<EditorScene[]>([]);
  const [tracks, setTracks] = useState<EditorTrack[]>(DEFAULT_TRACKS);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<number>>(new Set());
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrackState | null>(null);
  const [zoom, setZoom] = useState(40);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [previewScale, setPreviewScale] = useState<"fit" | "fill" | "100">("fit");

  // Undo/Redo history
  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) return;
    historyRef.current = [
      ...historyRef.current.slice(-MAX_HISTORY),
      { scenes: JSON.parse(JSON.stringify(scenes)), selectedSceneId },
    ];
    futureRef.current = [];
  }, [scenes, selectedSceneId]);

  // Initialize from AppContext on first render
  if (!isInitialized && scriptData?.scenes?.length) {
    const editorScenes: EditorScene[] = scriptData.scenes.map((s: Scene, i: number) => ({
      id: s.id,
      orderIndex: i,
      trackId: "v1",
      narration: s.narration || "",
      visual_prompt: s.visual_prompt || "",
      duration: s.duration_estimate_seconds || 8,
      imageUrl: storyboardImages[s.id] || "",
      audioUrl: sceneAudioUrls[s.id] || null,
      aiVideoUrl: sceneVideoUrls[s.id] || null,
      overlays: [],
      camera_angle: s.camera_angle,
      lighting: s.lighting,
      mood: s.mood,
      transition: pickTransition(s, i, scriptData.scenes.length),
      transitionDuration: 0.5,
      filter: "none",
      kenBurns: pickKenBurns(s, i),
      playbackSpeed: 1,
      volume: 1,
      isMuted: false,
      isLocked: false,
      isHidden: false,
    }));
    setScenesRaw(editorScenes);
    if (editorScenes.length > 0) {
      setSelectedSceneId(editorScenes[0].id);
      setSelectedSceneIds(new Set([editorScenes[0].id]));
    }
    setIsInitialized(true);
  }

  const setScenesWithHistory = useCallback((updater: EditorScene[] | ((prev: EditorScene[]) => EditorScene[])) => {
    setScenesRaw(prev => {
      // Push current state to history
      if (!skipHistoryRef.current) {
        historyRef.current = [
          ...historyRef.current.slice(-MAX_HISTORY),
          { scenes: JSON.parse(JSON.stringify(prev)), selectedSceneId },
        ];
        futureRef.current = [];
      }
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next.map((s, i) => ({ ...s, orderIndex: i }));
    });
  }, [selectedSceneId]);

  const setScenes = useCallback((newScenes: EditorScene[]) => {
    setScenesWithHistory(newScenes);
  }, [setScenesWithHistory]);

  const selectedScene = scenes.find(s => s.id === selectedSceneId) || null;
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  // Undo/Redo
  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const current = { scenes: JSON.parse(JSON.stringify(scenes)), selectedSceneId };
    futureRef.current = [...futureRef.current, current];
    const prev = historyRef.current.pop()!;
    skipHistoryRef.current = true;
    setScenesRaw(prev.scenes);
    setSelectedSceneId(prev.selectedSceneId);
    skipHistoryRef.current = false;
  }, [scenes, selectedSceneId]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const current = { scenes: JSON.parse(JSON.stringify(scenes)), selectedSceneId };
    historyRef.current = [...historyRef.current, current];
    const next = futureRef.current.pop()!;
    skipHistoryRef.current = true;
    setScenesRaw(next.scenes);
    setSelectedSceneId(next.selectedSceneId);
    skipHistoryRef.current = false;
  }, [scenes, selectedSceneId]);

  // Selection
  const toggleSceneSelection = useCallback((id: number) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllScenes = useCallback(() => {
    setSelectedSceneIds(new Set(scenes.map(s => s.id)));
  }, [scenes]);

  const clearSelection = useCallback(() => {
    setSelectedSceneIds(new Set());
  }, []);

  // Scene operations
  const reorderScene = useCallback((fromIndex: number, toIndex: number) => {
    setScenesWithHistory(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
  }, [setScenesWithHistory]);

  const updateScene = useCallback((id: number, updates: Partial<EditorScene>) => {
    setScenesWithHistory(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [setScenesWithHistory]);

  const deleteScene = useCallback((id: number) => {
    setScenesWithHistory(prev => prev.filter(s => s.id !== id));
    setSelectedSceneId(prev => prev === id ? null : prev);
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setScenesWithHistory]);

  const duplicateScene = useCallback((id: number) => {
    setScenesWithHistory(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const maxId = Math.max(...prev.map(s => s.id)) + 1;
      const dupe: EditorScene = {
        ...JSON.parse(JSON.stringify(prev[idx])),
        id: maxId,
        overlays: prev[idx].overlays.map(o => ({ ...o, id: `${o.id}-copy-${Date.now()}` })),
      };
      const arr = [...prev];
      arr.splice(idx + 1, 0, dupe);
      return arr;
    });
  }, [setScenesWithHistory]);

  const splitScene = useCallback((id: number, splitAt: number) => {
    setScenesWithHistory(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const scene = prev[idx];
      if (splitAt <= 0 || splitAt >= scene.duration) return prev;
      const maxId = Math.max(...prev.map(s => s.id)) + 1;
      const first: EditorScene = { ...scene, duration: splitAt };
      const second: EditorScene = {
        ...scene,
        id: maxId,
        duration: scene.duration - splitAt,
        transition: "none",
        overlays: [],
      };
      const arr = [...prev];
      arr.splice(idx, 1, first, second);
      return arr;
    });
  }, [setScenesWithHistory]);

  const insertScene = useCallback((afterId: number | null) => {
    setScenesWithHistory(prev => {
      const maxId = prev.length > 0 ? Math.max(...prev.map(s => s.id)) + 1 : 1;
      const newScene: EditorScene = {
        id: maxId,
        orderIndex: 0,
        trackId: "v1",
        narration: "",
        visual_prompt: "",
        duration: 5,
        imageUrl: "",
        audioUrl: null,
        aiVideoUrl: null,
        overlays: [],
        transition: "fade",
        transitionDuration: 0.5,
        filter: "none",
        kenBurns: "zoom-in",
        playbackSpeed: 1,
        volume: 1,
        isMuted: false,
        isLocked: false,
        isHidden: false,
      };
      if (afterId === null) return [newScene, ...prev];
      const idx = prev.findIndex(s => s.id === afterId);
      const arr = [...prev];
      arr.splice(idx + 1, 0, newScene);
      return arr;
    });
  }, [setScenesWithHistory]);

  const mergeScenes = useCallback((id1: number, id2: number) => {
    setScenesWithHistory(prev => {
      const s1 = prev.find(s => s.id === id1);
      const s2 = prev.find(s => s.id === id2);
      if (!s1 || !s2) return prev;
      const merged: EditorScene = {
        ...s1,
        duration: s1.duration + s2.duration,
        narration: [s1.narration, s2.narration].filter(Boolean).join(" "),
        overlays: [...s1.overlays, ...s2.overlays],
      };
      return prev.map(s => s.id === id1 ? merged : s).filter(s => s.id !== id2);
    });
  }, [setScenesWithHistory]);

  // Batch
  const applyToSelected = useCallback((updates: Partial<EditorScene>) => {
    setScenesWithHistory(prev =>
      prev.map(s => selectedSceneIds.has(s.id) ? { ...s, ...updates } : s)
    );
  }, [setScenesWithHistory, selectedSceneIds]);

  const deleteSelected = useCallback(() => {
    setScenesWithHistory(prev => prev.filter(s => !selectedSceneIds.has(s.id)));
    setSelectedSceneIds(new Set());
    setSelectedSceneId(null);
  }, [setScenesWithHistory, selectedSceneIds]);

  // Overlays
  const addOverlay = useCallback((sceneId: number, overlay: TextOverlay) => {
    setScenesWithHistory(prev => prev.map(s =>
      s.id === sceneId ? { ...s, overlays: [...s.overlays, overlay] } : s
    ));
  }, [setScenesWithHistory]);

  const updateOverlay = useCallback((sceneId: number, overlayId: string, updates: Partial<TextOverlay>) => {
    setScenesWithHistory(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, overlays: s.overlays.map(o => o.id === overlayId ? { ...o, ...updates } : o) }
        : s
    ));
  }, [setScenesWithHistory]);

  const removeOverlay = useCallback((sceneId: number, overlayId: string) => {
    setScenesWithHistory(prev => prev.map(s =>
      s.id === sceneId
        ? { ...s, overlays: s.overlays.filter(o => o.id !== overlayId) }
        : s
    ));
  }, [setScenesWithHistory]);

  const getSceneStartTime = useCallback((sceneId: number) => {
    // Calculate start time within the scene's track
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return 0;
    let time = 0;
    for (const s of scenes) {
      if (s.trackId !== scene.trackId) continue;
      if (s.id === sceneId) return time;
      time += s.duration;
    }
    return 0;
  }, [scenes]);

  const getSceneAtTime = useCallback((time: number) => {
    // Get scene on V1 track at time
    let cumulative = 0;
    const v1Scenes = scenes.filter(s => s.trackId === "v1");
    for (const s of v1Scenes) {
      cumulative += s.duration;
      if (time < cumulative) return s;
    }
    return v1Scenes[v1Scenes.length - 1] || null;
  }, [scenes]);

  // ── Track management ──
  const addTrack = useCallback((type: TrackType) => {
    setTracks(prev => {
      const existing = prev.filter(t => t.type === type);
      const num = existing.length + 1;
      const label = `${type === "video" ? "V" : "A"}${num}`;
      const id = label.toLowerCase();
      if (prev.find(t => t.id === id)) return prev; // already exists
      const newTrack: EditorTrack = {
        id,
        type,
        label,
        isMuted: false,
        isLocked: false,
        isCollapsed: false,
        volume: 1,
        height: type === "video" ? 60 : 36,
      };
      // Insert video tracks before audio, audio at end
      if (type === "video") {
        const lastVideoIdx = prev.reduce((acc, t, i) => t.type === "video" ? i : acc, -1);
        const arr = [...prev];
        arr.splice(lastVideoIdx + 1, 0, newTrack);
        return arr;
      }
      return [...prev, newTrack];
    });
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    // Don't remove the last video track
    setTracks(prev => {
      const videoTracks = prev.filter(t => t.type === "video");
      const target = prev.find(t => t.id === trackId);
      if (!target) return prev;
      if (target.type === "video" && videoTracks.length <= 1) return prev;
      return prev.filter(t => t.id !== trackId);
    });
    // Remove all clips on that track
    setScenesWithHistory(prev => prev.filter(s => s.trackId !== trackId));
  }, [setScenesWithHistory]);

  const updateTrack = useCallback((trackId: string, updates: Partial<EditorTrack>) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t));
  }, []);

  const getTrackScenes = useCallback((trackId: string) => {
    return scenes.filter(s => s.trackId === trackId);
  }, [scenes]);

  // ── Import media files ──
  const importMedia = useCallback(async (file: File, trackId?: string) => {
    const maxId = scenes.length > 0 ? Math.max(...scenes.map(s => s.id)) + 1 : 1;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    if (isImage || isVideo) {
      const targetTrack = trackId || "v1";
      // Ensure target track exists
      if (!tracks.find(t => t.id === targetTrack)) {
        addTrack("video");
      }

      let duration = 8; // default for images
      if (isVideo) {
        // Get video duration
        duration = await new Promise<number>((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => { resolve(video.duration || 8); URL.revokeObjectURL(video.src); };
          video.onerror = () => resolve(8);
          video.src = URL.createObjectURL(file);
        });
      }

      const newScene: EditorScene = {
        id: maxId,
        orderIndex: 0,
        trackId: targetTrack,
        narration: "",
        visual_prompt: "",
        duration: Math.round(duration),
        imageUrl: isImage ? dataUrl : "",
        audioUrl: null,
        aiVideoUrl: isVideo ? dataUrl : null,
        overlays: [],
        transition: "none",
        transitionDuration: 0.5,
        filter: "none",
        kenBurns: "zoom-in",
        playbackSpeed: 1,
        volume: 1,
        isMuted: false,
        isLocked: false,
        isHidden: false,
        sourceFileName: file.name,
      };
      setScenesWithHistory(prev => [...prev, newScene]);
      setSelectedSceneId(maxId);
    } else if (isAudio) {
      const targetTrack = trackId || "a1";
      if (!tracks.find(t => t.id === targetTrack)) {
        addTrack("audio");
      }
      // Get audio duration
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration || 10);
        audio.onerror = () => resolve(10);
        audio.src = dataUrl;
      });
      const newScene: EditorScene = {
        id: maxId,
        orderIndex: 0,
        trackId: targetTrack,
        narration: "",
        visual_prompt: "",
        duration: Math.round(duration),
        imageUrl: "",
        audioUrl: dataUrl,
        aiVideoUrl: null,
        overlays: [],
        transition: "none",
        transitionDuration: 0.5,
        filter: "none",
        kenBurns: "zoom-in",
        playbackSpeed: 1,
        volume: 1,
        isMuted: false,
        isLocked: false,
        isHidden: false,
        sourceFileName: file.name,
      };
      setScenesWithHistory(prev => [...prev, newScene]);
      setSelectedSceneId(maxId);
    }
  }, [scenes, tracks, addTrack, setScenesWithHistory]);

  return (
    <EditorContext.Provider value={{
      scenes, setScenes,
      selectedSceneId, setSelectedSceneId,
      selectedScene,
      playheadPosition, setPlayheadPosition,
      isPlaying, setIsPlaying,
      musicTrack, setMusicTrack,
      zoom, setZoom,
      exportProgress, setExportProgress,
      totalDuration,
      tracks, addTrack, removeTrack, updateTrack, getTrackScenes,
      selectedSceneIds, toggleSceneSelection, selectAllScenes, clearSelection,
      reorderScene, updateScene, deleteScene, duplicateScene,
      splitScene, insertScene, mergeScenes, importMedia,
      addOverlay, updateOverlay, removeOverlay,
      getSceneAtTime, getSceneStartTime,
      isInitialized,
      undo, redo, canUndo, canRedo,
      applyToSelected, deleteSelected,
      snapEnabled, setSnapEnabled,
      showSafeZones, setShowSafeZones,
      previewScale, setPreviewScale,
    }}>
      {children}
    </EditorContext.Provider>
  );
}
