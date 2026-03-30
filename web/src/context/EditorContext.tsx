"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, ReactNode } from "react";
import { Scene, useAppContext, VIDEO_DIMENSIONS } from "./AppContext";

// ── Types ──

export type WorkspacePreset = "editing" | "review" | "library";

export type TransitionType = "none" | "fade" | "dissolve" | "wipe-left" | "wipe-right" | "zoom-in" | "zoom-out" | "slide-left" | "slide-right";
export type FilterType = "none" | "cinematic" | "vintage" | "noir" | "warm" | "cool" | "vivid" | "muted" | "sepia" | "dramatic";
export type KenBurnsDirection = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

export interface TextOverlay {
  id: string;
  text: string;
  position?: "center" | "lower-third" | "top" | "custom";
  x?: number;
  y?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
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
  startTime?: number; // relative to scene start (s)
  duration?: number; // duration of visibility (s)
}

export interface EditorScene {
  id: number;
  orderIndex: number;
  trackId: string; // which track this clip lives on
  narration: string;
  visual_prompt: string;
  duration: number;
  imageUrl: string | null;
  imageUrls: string[] | null;
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
  playheadRef: React.MutableRefObject<number>;
  setPlayheadPosition: (pos: number, skipStateUpdate?: boolean) => void;
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
  reorderScene: (fromIndex: number, toIndex: number, targetTrackId?: string) => void;
  updateScene: (id: number, updates: Partial<EditorScene>) => void;
  deleteScene: (id: number) => void;
  duplicateScene: (id: number) => void;
  splitScene: (id: number, splitAt: number) => void;
  insertScene: (afterId: number | null) => void;
  mergeScenes: (id1: number, id2: number) => void;
  generateCaptionsForAllScenes: () => void;
  autoCaptionProject: () => void;
  importMedia: (file: File, trackId?: string, atIndex?: number) => Promise<void>;
  resetProject: () => void;
  orientation: "16:9" | "9:16";
  setOrientation: (o: "16:9" | "9:16") => void;
  applyRandomSoftTransitions: () => void;
  removeAllTransitions: () => void;
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

  // Global transition controls
  applyDefaultTransitions: (type?: TransitionType, duration?: number) => void;

  // Snap & grid
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;

  // Preview
  showSafeZones: boolean;
  setShowSafeZones: (v: boolean) => void;
  previewScale: "fit" | "fill" | "100";
  setPreviewScale: (v: "fit" | "fill" | "100") => void;

  // Workspace
  activeWorkspace: WorkspacePreset;
  setActiveWorkspace: (w: WorkspacePreset) => void;

  // Status/Toast
  statusMessage: { text: string; type: "success" | "error" } | null;
  showStatus: (text: string, type: "success" | "error") => void;
  globalCaptionStyle: Partial<TextOverlay>;
  setGlobalCaptionStyle: (style: Partial<TextOverlay>) => void;
  updateGlobalCaptionStyle: (updates: Partial<TextOverlay>) => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function useEditorContext() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorProvider");
  return ctx;
}

// ── Provider ──

const MAX_HISTORY = 50;

const DEFAULT_TRACKS: EditorTrack[] = [
  { id: "v1", type: "video", label: "V1", isMuted: false, isLocked: false, isCollapsed: false, volume: 1, height: 60 },
  { id: "a1", type: "audio", label: "A1", isMuted: false, isLocked: false, isCollapsed: false, volume: 1, height: 36 },
];

export function EditorProvider({ children }: { children: ReactNode }) {
  const { scriptData, setScriptData, storyboardImages, sceneAudioUrls, sceneVideoUrls, sceneDurations, setVideoDimension } = useAppContext();

  const [isInitialized, setIsInitialized] = useState(false);
  const [scenes, setScenesRaw] = useState<EditorScene[]>([]);
  const [tracks, setTracks] = useState<EditorTrack[]>(DEFAULT_TRACKS);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<number>>(new Set());
  const [playheadPosition, setPlayheadPositionRaw] = useState(0);
  const playheadRef = useRef(0);
  
  // High-performance playhead update that doesn't trigger React re-renders unless requested
  const setPlayheadPosition = useCallback((pos: number, skipStateUpdate = false) => {
    playheadRef.current = pos;
    if (!skipStateUpdate) {
       setPlayheadPositionRaw(pos);
    }
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrackState | null>(null);
  const [zoom, setZoom] = useState(5);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [previewScale, setPreviewScale] = useState<"fit" | "fill" | "100">("fit");
  const [activeWorkspace, setActiveWorkspaceRaw] = useState<WorkspacePreset>("editing");
  const [orientation, setOrientation] = useState<"16:9" | "9:16">("16:9");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Global Caption Style ---
  const [globalCaptionStyle, setGlobalCaptionStyle] = useState<Partial<TextOverlay>>({
    fontSize: 48,
    color: "#FFFFFF",
    fontFamily: "Inter, system-ui",
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    shadowEnabled: true,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 10,
    position: "lower-third",
    x: 50,
    y: 80,
    animation: "fade-in",
  });

  const showStatus = useCallback((text: string, type: "success" | "error") => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMessage({ text, type });
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const setActiveWorkspace = useCallback((w: WorkspacePreset) => {
    setActiveWorkspaceRaw(w);
    // When switching to library, we should probably tell the UI to show the 'Media' tab
    // We can't reach into SourceMonitor state directly from here, but we can emit a custom event
    if (w === "library") {
      window.dispatchEvent(new CustomEvent("editor-switch-tab", { detail: "media" }));
    } else if (w === "editing") {
      window.dispatchEvent(new CustomEvent("editor-switch-tab", { detail: "scenes" }));
    }
  }, []);

  // Sync orientation with AppContext for export
  useEffect(() => {
    const dim = VIDEO_DIMENSIONS.find(d => d.id === orientation);
    if (dim) {
      setVideoDimension(dim);
      showStatus(`Changed aspect ratio to ${dim.label}`, "success");
    }
  }, [orientation, setVideoDimension, showStatus]);

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

  // Initialize / re-initialize scenes whenever scriptData changes.
  useEffect(() => {
    if (!scriptData?.scenes?.length) {
      setIsInitialized(false);
      return;
    }

    setIsInitialized(false);

    // Check if we have native editor scenes in AppContext (restored from storage)
    const savedScenes = (scriptData as any).editorScenes;
    const savedTracks = (scriptData as any).editorTracks;
    const savedOrientation = (scriptData as any).orientation;
    const savedZoom = (scriptData as any).zoom;

    if (savedScenes && Array.isArray(savedScenes) && savedScenes.length > 0) {
      setScenesRaw(savedScenes);
      if (savedTracks) setTracks(savedTracks);
      if (savedOrientation) setOrientation(savedOrientation);
      if (savedZoom) setZoom(savedZoom);
      
      // Reset history when restoring a new project
      historyRef.current = [];
      futureRef.current = [];
      
      setIsInitialized(true);
      return;
    }

    // Default: Map script scenes to Editor scenes (V1/A1 pairs)
    // Inherit orientation from the script generation settings if available
    const initialOrientation = (scriptData as any).aspect_ratio === "9:16" ? "9:16" : "16:9";
    setOrientation(initialOrientation);

    const editorScenes: EditorScene[] = [];
    scriptData.scenes.forEach((s: Scene, i: number) => {
      const dur = sceneDurations[s.id] || s.duration_estimate_seconds || 8;

      // 1. Video Clip (V1)
      editorScenes.push({
        id: s.id * 10,
        orderIndex: i * 2,
        trackId: "v1",
        narration: s.narration || "",
        visual_prompt: s.visual_prompt || "",
        duration: dur,
        imageUrl: (storyboardImages[s.id] as any)?.[0] || null,
        imageUrls: storyboardImages[s.id] || null,
        audioUrl: null,
        aiVideoUrl: sceneVideoUrls[s.id] || null,
        overlays: [],
        camera_angle: s.camera_angle,
        lighting: s.lighting,
        mood: s.mood,
        transition: "none",
        transitionDuration: 0,
        filter: "none",
        kenBurns: "zoom-in",
        playbackSpeed: 1,
        volume: 0,
        isMuted: false,
        isLocked: false,
        isHidden: false,
      });

      // 2. Audio Clip (A1)
      if (sceneAudioUrls[s.id]) {
        editorScenes.push({
          id: s.id * 10 + 1,
          orderIndex: i * 2 + 1,
          trackId: "a1",
          narration: s.narration || "",
          visual_prompt: "",
          duration: dur,
          imageUrl: null,
          imageUrls: null,
          audioUrl: sceneAudioUrls[s.id],
          aiVideoUrl: null,
          overlays: [],
          transition: "none",
          transitionDuration: 0,
          filter: "none",
          kenBurns: "zoom-in",
          playbackSpeed: 1,
          volume: 1,
          isMuted: false,
          isLocked: false,
          isHidden: false,
          sourceFileName: `Narration ${i + 1}`,
        });
      }
    });

    // Reset history when restoring a new project
    historyRef.current = [];
    futureRef.current = [];

    setScenesRaw(editorScenes);
    if (editorScenes.length > 0) {
      const firstVid = editorScenes.find(s => s.trackId === "v1");
      if (firstVid) {
        setSelectedSceneId(firstVid.id);
        setSelectedSceneIds(new Set([firstVid.id]));
      }
    }
    setTracks(DEFAULT_TRACKS); // Reset to default tracks for new generation
    setIsInitialized(true);
  }, [scriptData]);


  // Measure actual audio durations and adjust scene durations if they're too short
  const audioMeasuredRef = useRef(false);
  const lastAudioStateRef = useRef<string>("");

  // Reset audioMeasuredRef when a new project loads so durations are re-measured
  useEffect(() => {
    // Only reset if it's actually a different set of audio URLs
    const audioFingerprint = JSON.stringify(Object.values(sceneAudioUrls));
    if (audioFingerprint !== lastAudioStateRef.current) {
      audioMeasuredRef.current = false;
      lastAudioStateRef.current = audioFingerprint;
    }
  }, [sceneAudioUrls]);

  useEffect(() => {
    if (!isInitialized || audioMeasuredRef.current || scenes.length === 0) return;
    audioMeasuredRef.current = true;

    const measureAndAdjust = async () => {
      const updates: { id: number; duration: number }[] = [];

      await Promise.all(scenes.map(scene => {
        if (!scene.audioUrl) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const audio = new Audio(scene.audioUrl!);
          audio.addEventListener("loadedmetadata", () => {
            const audioDur = audio.duration;
            // Scene should match the exact audio duration with a tiny buffer
            const needed = audioDur + 0.2;
            if (isFinite(needed)) {
              const exactNeeded = Math.ceil(needed * 10) / 10;
              // Update the Audio clip itself
              updates.push({ id: scene.id, duration: exactNeeded });
              // Also update the corresponding Video clip (which is always scene.id - 1 in our generation scheme)
              updates.push({ id: scene.id - 1, duration: exactNeeded });
            }
            resolve();
          });
          audio.addEventListener("error", () => resolve());
          setTimeout(() => resolve(), 3000); // timeout fallback
        });
      }));

      // Apply updates to all scenes in history-friendly way without pushing a massive initial state history
      if (updates.length > 0) {
        setScenesRaw(prev => prev.map(s => {
          const u = updates.find(up => up.id === s.id);
          // Only update if the new duration is significantly different (prevents infinite loop/jitter)
          return u && Math.abs(s.duration - u.duration) > 0.2 ? { ...s, duration: u.duration } : s;
        }));
      }
    };

    measureAndAdjust();
  }, [isInitialized, scenes]);

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
  const totalDuration = useMemo(() => {
    let max = 0;
    const trackMap: Record<string, EditorScene[]> = {};
    for (const s of scenes) {
      if (!trackMap[s.trackId]) trackMap[s.trackId] = [];
      trackMap[s.trackId].push(s);
    }
    for (const trackScenes of Object.values(trackMap)) {
      trackScenes.sort((a,b) => a.orderIndex - b.orderIndex);
      let t = 0;
      for (const s of trackScenes) {
        t += s.duration;
      }
      if (t > max) max = t;
    }
    return max;
  }, [scenes]);

  // Undo/Redo logic
  // eslint-disable-next-line react-hooks/refs
  const canUndo = historyRef.current.length > 0;
  // eslint-disable-next-line react-hooks/refs
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
  const reorderScene = useCallback((fromIndex: number, toIndex: number, targetTrackId?: string) => {
    console.log(`[EditorContext] reorderScene from ${fromIndex} to ${toIndex} on track ${targetTrackId}`);
    setScenesWithHistory(prev => {
      const scene = prev[fromIndex];
      if (!scene) return prev;
      if (scene.isLocked) return prev;
      const track = tracks.find(t => t.id === scene.trackId);
      if (track?.isLocked) return prev;
      
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      
      let updatedMoved = moved;
      // If moving to a different track, clone and update trackId
      if (targetTrackId && targetTrackId !== moved.trackId) {
        console.log(`[EditorContext] Moving scene ${moved.id} from ${moved.trackId} to ${targetTrackId}`);
        updatedMoved = { ...moved, trackId: targetTrackId };
      }
      
      arr.splice(toIndex, 0, updatedMoved);
      return arr;
    });
  }, [setScenesWithHistory, tracks]);

  const updateScene = useCallback((id: number, updates: Partial<EditorScene>) => {
    // Allow toggling lock itself
    if (Object.keys(updates).length === 1 && 'isLocked' in updates) {
      setScenesWithHistory(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return;
    }
    setScenesWithHistory(prev => {
      const scene = prev.find(s => s.id === id);
      if (!scene) return prev;
      if (scene.isLocked) return prev;
      const track = tracks.find(t => t.id === scene.trackId);
      if (track?.isLocked) return prev;
      return prev.map(s => s.id === id ? { ...s, ...updates } : s);
    });
  }, [setScenesWithHistory, tracks]);

  const deleteScene = useCallback((id: number) => {
    // Check lock before deleting
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;
    if (scene.isLocked) return;
    const track = tracks.find(t => t.id === scene.trackId);
    if (track?.isLocked) return;
    setScenesWithHistory(prev => prev.filter(s => s.id !== id));
    setSelectedSceneId(prev => prev === id ? null : prev);
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setScenesWithHistory, scenes, tracks]);

  const duplicateScene = useCallback((id: number) => {
    setScenesWithHistory(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const scene = prev[idx];
      if (scene.isLocked) return prev;
      const track = tracks.find(t => t.id === scene.trackId);
      if (track?.isLocked) return prev;
      const maxId = Math.max(...prev.map(s => s.id)) + 1;
      const dupe: EditorScene = {
        ...JSON.parse(JSON.stringify(scene)),
        id: maxId,
        overlays: scene.overlays.map(o => ({ ...o, id: `${o.id}-copy-${Date.now()}` })),
      };
      
      const nextArr = [...prev];
      nextArr.splice(idx + 1, 0, dupe);
      return nextArr;
    });
  }, [setScenesWithHistory, tracks]);

  // --- Auto-Captioning ---
  const autoCaptionProject = useCallback(() => {
    setScenesWithHistory(prev => {
      return prev.map(scene => {
        if (!scene.narration || scene.trackId !== "v1") return scene;

        // 1. Clear existing captions (ID starts with caption-)
        const newOverlays = scene.overlays.filter(o => !o.id.startsWith("caption-"));

        // 2. Split narration into chunks
        const words = scene.narration.trim().split(/\s+/);
        if (words.length === 0) return scene;

        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentCharCount = 0;

        for (const word of words) {
          // Limit to 25 characters for "Super-Sync" (no wrapping, high impact)
          if (currentCharCount + word.length > 25 && currentChunk.length > 0) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
            currentCharCount = 0;
          }
          currentChunk.push(word);
          currentCharCount += word.length + 1;
        }
        if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));

        // 3. Create overlays with timing
        const numChunks = chunks.length;
        // Add a tiny gap (0.1s) between segments for visual "pop"
        const gap = 0.1;
        const totalGap = gap * (numChunks - 1);
        const usableDuration = Math.max(0, scene.duration - Math.max(0, totalGap));
        const durPerChunk = numChunks > 0 ? usableDuration / numChunks : 0;

        chunks.forEach((text, i) => {
          newOverlays.push({
            id: `caption-${scene.id}-${i}-${Date.now()}`,
            text: text.toUpperCase(),
            ...globalCaptionStyle,
            startTime: i * (durPerChunk + gap),
            duration: durPerChunk,
          });
        });

        return { ...scene, overlays: newOverlays };
      });
    });
  }, [setScenesWithHistory, globalCaptionStyle]);

  const updateGlobalCaptionStyle = useCallback((updates: Partial<TextOverlay>) => {
    setGlobalCaptionStyle(prev => ({ ...prev, ...updates }));
    
    // Retroactively update all existing captions across all scenes
    setScenesWithHistory(prev => {
      return prev.map(scene => ({
        ...scene,
        overlays: scene.overlays.map(o => {
          if (o.id.startsWith("caption-")) {
            return { ...o, ...updates };
          }
          return o;
        })
      }));
    });
  }, [setScenesWithHistory]);

  const splitScene = useCallback((id: number, splitAt: number) => {
    setScenesWithHistory(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const scene = prev[idx];
      if (scene.isLocked) return prev;
      const track = tracks.find(t => t.id === scene.trackId);
      if (track?.isLocked) return prev;
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
  }, [setScenesWithHistory, tracks]);

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
        imageUrl: null,
        imageUrls: null,
        audioUrl: null,
        aiVideoUrl: null,
        overlays: [],
        transition: "none",
        transitionDuration: 0,
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

  const insertAssetAsScene = useCallback((url: string, type: "image" | "video" | "audio", trackId: string, atIndex?: number) => {
    setScenesWithHistory(prev => {
      const maxId = prev.length > 0 ? Math.max(...prev.map(s => s.id)) + 1 : 1;
      
      const newScene: EditorScene = {
        id: maxId,
        orderIndex: 0, // Not strictly used for rendering but good for state
        trackId: trackId,
        narration: `Imported ${type}`,
        visual_prompt: "",
        duration: type === "audio" ? 5 : 4,
        imageUrl: type === "image" ? url : null,
        imageUrls: type === "image" ? [url] : null,
        audioUrl: type === "audio" ? url : null,
        aiVideoUrl: type === "video" ? url : null,
        overlays: [],
        transition: "none",
        transitionDuration: 0,
        filter: "none",
        kenBurns: "zoom-in",
        playbackSpeed: 1,
        volume: type === "audio" ? 1 : 0,
        isMuted: false,
        isLocked: false,
        isHidden: false,
      };

      const arr = [...prev];
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= arr.length) {
        arr.splice(atIndex, 0, newScene);
      } else {
        arr.push(newScene);
      }
      return arr;
    });
  }, [setScenesWithHistory]);

  // Expose to window for drag and drop Timeline access
  useEffect(() => {
    (window as any)._insertAssetAsScene = insertAssetAsScene;
    (window as any)._duplicateScene = duplicateScene;
    return () => { 
      delete (window as any)._insertAssetAsScene; 
      delete (window as any)._duplicateScene; 
    };
  }, [insertAssetAsScene, duplicateScene]);

  const mergeScenes = useCallback((id1: number, id2: number) => {
    setScenesWithHistory(prev => {
      const s1 = prev.find(s => s.id === id1);
      const s2 = prev.find(s => s.id === id2);
      if (!s1 || !s2) return prev;
      // Check locks on both scenes
      if (s1.isLocked || s2.isLocked) return prev;
      const track1 = tracks.find(t => t.id === s1.trackId);
      const track2 = tracks.find(t => t.id === s2.trackId);
      if (track1?.isLocked || track2?.isLocked) return prev;
      const merged: EditorScene = {
        ...s1,
        duration: s1.duration + s2.duration,
        narration: [s1.narration, s2.narration].filter(Boolean).join(" "),
        overlays: [...s1.overlays, ...s2.overlays],
      };
      return prev.map(s => s.id === id1 ? merged : s).filter(s => s.id !== id2);
    });
  }, [setScenesWithHistory, tracks]);

  // Batch
  const applyToSelected = useCallback((updates: Partial<EditorScene>) => {
    setScenesWithHistory(prev =>
      prev.map(s => {
        if (!selectedSceneIds.has(s.id)) return s;
        if (s.isLocked) return s;
        const track = tracks.find(t => t.id === s.trackId);
        if (track?.isLocked) return s;
        return { ...s, ...updates };
      })
    );
  }, [setScenesWithHistory, selectedSceneIds, tracks]);

  const deleteSelected = useCallback(() => {
    setScenesWithHistory(prev => prev.filter(s => {
      if (!selectedSceneIds.has(s.id)) return true;
      if (s.isLocked) return true;
      const track = tracks.find(t => t.id === s.trackId);
      if (track?.isLocked) return true;
      return false;
    }));
    setSelectedSceneIds(new Set());
    setSelectedSceneId(null);
  }, [setScenesWithHistory, selectedSceneIds, tracks]);

  const generateCaptionsForAllScenes = useCallback(() => {
    setScenesWithHistory(prev => prev.map(s => {
      if (!s.narration || s.trackId !== "v1") return s;
      
      // Basic heuristic: if it already has an overlay with similar text, skip or replace
      // For simplicity here, we'll replace or add a fresh 'lower-third' caption
      const captionId = `caption-${s.id}`;
      const existingCaptionIndex = s.overlays.findIndex(o => o.id === captionId);
      
      const newOverlay: TextOverlay = {
        id: captionId,
        text: s.narration,
        position: "lower-third",
        x: 50,
        y: 85,
        fontSize: orientation === "16:9" ? 32 : 24,
        color: "#ffffff",
        fontFamily: "Inter",
        fontWeight: "bold",
        textAlign: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 4,
        padding: 8,
        shadowEnabled: true,
        animation: "fade-in"
      };

      const newOverlays = [...s.overlays];
      if (existingCaptionIndex >= 0) {
        newOverlays[existingCaptionIndex] = newOverlay;
      } else {
        newOverlays.push(newOverlay);
      }

      return { ...s, overlays: newOverlays };
    }));
    showStatus("Captions generated for all scenes", "success");
  }, [setScenesWithHistory, orientation, showStatus]);

  // Global transition controls
  const applyDefaultTransitions = useCallback((type: TransitionType = "fade", duration = 0.5) => {
    setScenesWithHistory(prev =>
      prev.map((s, i) => ({
        ...s,
        transition: "none",
        transitionDuration: 0,
      }))
    );
  }, [setScenesWithHistory]);

  const removeAllTransitions = useCallback(() => {
    setScenesWithHistory(prev =>
      prev.map(s => ({ ...s, transition: "none" as TransitionType, transitionDuration: 0 }))
    );
  }, [setScenesWithHistory]);

  const applyRandomSoftTransitions = useCallback(() => {
    const softTransitions: TransitionType[] = ["fade", "dissolve", "zoom-in", "zoom-out"];
    setScenesWithHistory(prev => prev.map(s => {
      if (s.trackId !== "v1") return s;
      const randomT = softTransitions[Math.floor(Math.random() * softTransitions.length)];
      return { ...s, transition: randomT, transitionDuration: 0.8 };
    }));
  }, [setScenesWithHistory]);

  const resetProject = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("link2video_state");
      sessionStorage.removeItem("link2video_state");
    }
    setScriptData(null);
    setScenesRaw([]);
    setTracks(DEFAULT_TRACKS);
    setSelectedSceneId(null);
    setSelectedSceneIds(new Set());
    setPlayheadPosition(0);
    setIsPlaying(false);
    setIsInitialized(false);
    
    // Create one initial blank scene
    const initialScene: EditorScene = {
      id: 1,
      orderIndex: 0,
      trackId: "v1",
      narration: "",
      visual_prompt: "",
      duration: 5,
      imageUrl: null,
      imageUrls: null,
      audioUrl: null,
      aiVideoUrl: null,
      overlays: [],
      transition: "none",
      transitionDuration: 0,
      filter: "none",
      kenBurns: "zoom-in",
      playbackSpeed: 1,
      volume: 1,
      isMuted: false,
      isLocked: false,
      isHidden: false,
    };
    setScenesRaw([initialScene]);
    setSelectedSceneId(1);
    setSelectedSceneIds(new Set([1]));
    setIsInitialized(true);
  }, [setScriptData]);

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
  const importMedia = useCallback(async (file: File, trackId?: string, atIndex?: number) => {
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
        imageUrl: isImage ? dataUrl : null,
        imageUrls: isImage ? [dataUrl] : null,
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
      const arr = [...scenes];
      arr.splice(atIndex !== undefined ? atIndex : arr.length, 0, newScene);
      setScenesWithHistory(arr);
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
        imageUrl: null,
        imageUrls: null,
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
      
      const arr = [...scenes];
      arr.splice(atIndex !== undefined ? atIndex : arr.length, 0, newScene);
      setScenesWithHistory(arr);
      setSelectedSceneId(maxId);
    }
  }, [scenes, tracks, addTrack, setScenesWithHistory]);

  const contextValue = useMemo(() => ({
    scenes, setScenes,
    selectedSceneId, setSelectedSceneId,
    selectedScene,
    playheadPosition, playheadRef, setPlayheadPosition,
    isPlaying, setIsPlaying,
    musicTrack, setMusicTrack,
    zoom, setZoom,
    exportProgress, setExportProgress,
    totalDuration,
    tracks, addTrack, removeTrack, updateTrack, getTrackScenes,
    selectedSceneIds, toggleSceneSelection, selectAllScenes, clearSelection,
    reorderScene, updateScene, deleteScene, duplicateScene, splitScene, insertScene, mergeScenes,
    generateCaptionsForAllScenes,
    importMedia,
    orientation, setOrientation,
    applyRandomSoftTransitions, removeAllTransitions,
    addOverlay, updateOverlay, removeOverlay,
    getSceneAtTime, getSceneStartTime,
    isInitialized,
    undo, redo, canUndo, canRedo,
    applyToSelected, deleteSelected,
    applyDefaultTransitions,
    snapEnabled, setSnapEnabled,
    showSafeZones, setShowSafeZones,
    previewScale, setPreviewScale,
    activeWorkspace, setActiveWorkspace,
    statusMessage, showStatus,
    autoCaptionProject,
    globalCaptionStyle, setGlobalCaptionStyle, updateGlobalCaptionStyle,
    resetProject,
  }), [
    scenes, selectedSceneId, selectedScene, playheadPosition, isPlaying,
    musicTrack, zoom, exportProgress, totalDuration, tracks, addTrack, removeTrack,
    updateTrack, getTrackScenes, selectedSceneIds, toggleSceneSelection,
    selectAllScenes, clearSelection, reorderScene, updateScene, deleteScene,
    duplicateScene, splitScene, insertScene, mergeScenes, importMedia,
    orientation, setOrientation, applyRandomSoftTransitions, removeAllTransitions,
    addOverlay, updateOverlay, removeOverlay, getSceneAtTime, getSceneStartTime,
    isInitialized, undo, redo, canUndo, canRedo, applyToSelected, deleteSelected,
    applyDefaultTransitions, snapEnabled, setSnapEnabled, showSafeZones,
    setShowSafeZones, previewScale, setPreviewScale, orientation, setOrientation,
    activeWorkspace, setActiveWorkspace, statusMessage, showStatus, resetProject,
    autoCaptionProject, globalCaptionStyle, setGlobalCaptionStyle, updateGlobalCaptionStyle,
  ]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}
