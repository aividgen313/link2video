"use client";
import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VIDEO_DIMENSIONS } from "@/context/AppContext";
import { EditorProvider, useEditorContext, TextOverlay } from "@/context/EditorContext";
import { getHistory, loadProjectState, saveToHistory, saveProjectState, syncHistoryWithCloud, type VideoHistoryItem, type ProjectState } from "@/lib/videoHistory";
import PreviewPlayer from "@/components/editor/PreviewPlayer";
import Timeline from "@/components/editor/Timeline";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import ExportDialog from "@/components/editor/ExportDialog";
import TextOverlayEditor from "@/components/editor/TextOverlayEditor";
import ErrorBoundary from "@/components/ErrorBoundary";

// ── Theme system — reads from CSS variables (set in globals.css) ──
// This keeps the editor in sync with the global next-themes toggle.
const DARK = {
  bg: "var(--editor-bg)",
  panel: "var(--editor-panel)",
  panelDark: "var(--editor-panel-alt)",
  border: "var(--editor-border)",
  borderLight: "var(--editor-border)",
  headerBg: "var(--editor-panel-alt)",
  accent: "var(--editor-accent)",
  accentDim: "var(--editor-accent-dim)",
  accentBg: "var(--editor-hover)",
  text: "var(--editor-text)",
  textDim: "var(--editor-text-dim)",
  textMuted: "var(--editor-text-dim)",
  danger: "var(--editor-danger)",
  success: "var(--editor-success)",
  warn: "#E8930C",
};

// Light mode uses the same CSS vars — they auto-switch with .dark class
const LIGHT = DARK;

type EditorTheme = typeof DARK;
const EditorThemeContext = createContext<{ theme: EditorTheme; isDark: boolean; toggle: () => void }>({ theme: DARK, isDark: true, toggle: () => {} });
export function useEditorTheme() { return useContext(EditorThemeContext); }

// Current theme — used as default, will be overridden by context in the provider
// Delete the global 'C' variable - theme should always come from context


// ── Panel Header Tab ──
function PanelTab({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  const { theme: C } = useEditorTheme();
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-[12px] font-medium transition-all relative rounded-t-md"
      style={{
        color: active ? C.text : C.textDim,
        background: active ? C.panel : "transparent",
        opacity: active ? 1 : 0.7,
      }}
    >
      {label}
      {active && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: C.accent }} />}
    </button>
  );
}

// ── Toolbar Icon Button ──
function TBtn({ icon, label, onClick, active, disabled, danger, badge, filled }: {
  icon: string; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; danger?: boolean; badge?: string | number; filled?: boolean;
}) {
  const { theme: C } = useEditorTheme();
  const hoverBg = C.bg === DARK.bg ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-all"
      style={{
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        color: danger ? C.danger : active ? C.accent : C.textDim,
        background: active ? C.accentBg : "transparent",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = active ? C.accentBg : hoverBg; e.currentTarget.style.color = danger ? C.danger : C.accent; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? C.accentBg : "transparent"; e.currentTarget.style.color = danger ? C.danger : active ? C.accent : C.textDim; }}
    >
      <span className="material-symbols-outlined text-[18px]" style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{icon}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ background: C.accent }}>{badge}</span>
      )}
    </button>
  );
}

function TSep() {
  const { theme: C } = useEditorTheme();
  return <div className="w-px h-5 mx-1.5" style={{ background: C.border }} />;
}

// ── Source Monitor (Scene Browser + Media Browser) ──
function SourceMonitor() {
  const { theme: C, isDark } = useEditorTheme();
  const {
    scenes, selectedSceneId, setSelectedSceneId, setPlayheadPosition,
    getSceneStartTime, reorderScene, importMedia,
  } = useEditorContext();
  const { storyboardImages, sceneAudioUrls, sceneVideoUrls } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"scenes" | "media">("scenes");

  const handleDragStart = (index: number) => setDragFrom(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOver(index); };
  const handleDrop = (index: number) => {
    if (dragFrom !== null && dragFrom !== index) reorderScene(dragFrom, index);
    setDragFrom(null); setDragOver(null);
  };
  const handleDragEnd = () => { setDragFrom(null); setDragOver(null); };

  // Collect all project media assets for the Media tab
  const mediaAssets = useMemo(() => {
    const assets: { id: string; type: "image" | "audio" | "video"; url: string; label: string }[] = [];
    Object.entries(storyboardImages).forEach(([id, url]) => {
      assets.push({ id: `img-${id}`, type: "image", url, label: `Scene ${Number(id) + 1} Image` });
    });
    Object.entries(sceneAudioUrls).forEach(([id, url]) => {
      assets.push({ id: `aud-${id}`, type: "audio", url, label: `Scene ${Number(id) + 1} Audio` });
    });
    Object.entries(sceneVideoUrls).forEach(([id, url]) => {
      assets.push({ id: `vid-${id}`, type: "video", url, label: `Scene ${Number(id) + 1} Video` });
    });
    return assets;
  }, [storyboardImages, sceneAudioUrls, sceneVideoUrls]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        await importMedia(file);
      }
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (!scrollRef.current || selectedSceneId === null) return;
    const idx = scenes.findIndex(s => s.id === selectedSceneId);
    if (idx < 0) return;
    const child = scrollRef.current.children[idx] as HTMLElement;
    if (child) child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedSceneId, scenes]);

  return (
    <div className="flex flex-col h-full" style={{ background: C.panel, borderRight: `1px solid ${C.border}` }}>
      <input ref={mediaInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleMediaUpload} className="hidden" />
      {/* Panel header with tabs */}
      <div className="flex items-center justify-between px-2 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 34 }}>
        <div className="flex">
          <PanelTab label="Scenes" active={activeTab === "scenes"} onClick={() => setActiveTab("scenes")} />
          <PanelTab label="Media" active={activeTab === "media"} onClick={() => setActiveTab("media")} />
        </div>
        <span className="text-[11px] font-mono pr-2" style={{ color: C.textMuted }}>
          {activeTab === "scenes" ? `${scenes.length} clips` : `${mediaAssets.length} files`}
        </span>
      </div>

      {activeTab === "media" ? (
        /* ── Media Browser ── */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Upload button */}
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.01]"
            style={{ background: `${C.accent}15`, color: C.accent, border: `1px dashed ${C.accent}40` }}
          >
            <span className="material-symbols-outlined text-sm">upload</span>
            Upload Media
          </button>

          {/* Asset grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8 }}>
            {mediaAssets.map(asset => (
              <div
                key={asset.id}
                className="rounded-lg overflow-hidden cursor-grab group/asset"
                style={{ background: C.panelDark, border: `1px solid ${C.border}` }}
                draggable
                title={asset.label}
              >
                <div className="relative" style={{ background: "rgba(255,255,255,0.02)", aspectRatio: "1 / 1" }}>
                  {asset.type === "image" ? (
                    <img src={asset.url} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : asset.type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg" style={{ color: C.accent, opacity: 0.5 }}>videocam</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg" style={{ color: C.success, opacity: 0.5 }}>graphic_eq</span>
                    </div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-0.5 left-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase text-white" style={{ background: "rgba(0,0,0,0.7)" }}>
                    {asset.type === "image" ? "IMG" : asset.type === "audio" ? "AUD" : "VID"}
                  </div>
                </div>
                <div className="px-1.5 py-1">
                  <p className="text-[9px] truncate" style={{ color: C.textDim }}>{asset.label}</p>
                </div>
              </div>
            ))}
          </div>

          {mediaAssets.length === 0 && (
            <div className="text-center py-8" style={{ color: C.textMuted }}>
              <span className="material-symbols-outlined text-3xl mb-2 block" style={{ opacity: 0.2 }}>perm_media</span>
              <p className="text-[11px]">No media assets yet</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Scene Grid (original) ── */
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 gap-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "max-content", alignContent: "start" }}>
        {scenes.filter(s => s.trackId === "v1").map((scene, index) => {
          const isSelected = selectedSceneId === scene.id;
          const isDragTarget = dragOver === index && dragFrom !== index;
          return (
            <div
              key={scene.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                setSelectedSceneId(scene.id);
                setPlayheadPosition(getSceneStartTime(scene.id));
              }}
              className="cursor-pointer rounded-xl overflow-hidden shadow-sm group/card border-2 flex flex-col relative w-full"
              style={{
                borderColor: isSelected ? C.accent : isDragTarget ? C.warn : "transparent",
                opacity: scene.isHidden ? 0.3 : dragFrom === index ? 0.4 : 1,
                background: C.panelDark,
                aspectRatio: "1 / 1.1",
              }}
            >
              <div className="relative w-full overflow-hidden" style={{ paddingBottom: "100%", height: 0, background: "rgba(255,255,255,0.02)" }}>
                <div className="absolute inset-0">
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt="" className="w-full h-full object-cover block" draggable={false} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 opacity-30">
                      <span className="material-symbols-outlined text-lg">image</span>
                      <span className="text-[7px] font-bold">SCENE {index + 1}</span>
                    </div>
                  )}
                </div>
                
                {/* Overlay Badges */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white shadow-sm" style={{ background: C.accent }}>
                  {scene.orderIndex + 1}
                </div>
                <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded-md text-[8px] font-mono text-white/90 font-bold" style={{ background: "rgba(0,0,0,0.6)" }}>
                  {Math.round(scene.duration * 10) / 10}s
                </div>
              </div>

              <div className="px-1.5 py-1 flex-1 overflow-hidden" style={{ background: isSelected ? C.accentBg : "transparent" }}>
                <p className="text-[9px] truncate" style={{ color: isSelected ? C.accent : C.textDim }}>
                  {scene.narration}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ── Trim Panel ──
function TrimPanel() {
  const { theme: C } = useEditorTheme();
  const { selectedScene, updateScene } = useEditorContext();
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  useEffect(() => {
    if (selectedScene) { setTrimStart(0); setTrimEnd(selectedScene.duration); }
  }, [selectedScene?.id, selectedScene?.duration]);

  if (!selectedScene) return null;
  const maxDuration = Math.max(selectedScene.duration, 30);

  return (
    <div className="p-3 space-y-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textMuted }}>Trim</span>
        <span className="text-[10px] font-mono" style={{ color: C.textDim }}>{trimEnd - trimStart}s / {selectedScene.duration}s</span>
      </div>
      <div className="relative h-9 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {selectedScene.imageUrl && <img src={selectedScene.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-25" alt="" />}
        <div className="absolute top-0 bottom-0" style={{
          left: `${(trimStart / maxDuration) * 100}%`,
          width: `${((trimEnd - trimStart) / maxDuration) * 100}%`,
          background: `${C.accent}20`, borderLeft: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}`,
        }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] block mb-1" style={{ color: C.textMuted }}>In: {trimStart}s</span>
          <input type="range" min={0} max={Math.max(0, trimEnd - 2)} value={trimStart} onChange={e => setTrimStart(Number(e.target.value))} className="w-full h-1" style={{ accentColor: C.accent }} />
        </div>
        <div>
          <span className="text-[10px] block mb-1" style={{ color: C.textMuted }}>Out: {trimEnd}s</span>
          <input type="range" min={trimStart + 2} max={maxDuration} value={trimEnd} onChange={e => setTrimEnd(Number(e.target.value))} className="w-full h-1" style={{ accentColor: C.accent }} />
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {[4, 6, 8, 10, 12, 15, 20].map(d => (
          <button key={d} onClick={() => { setTrimStart(0); setTrimEnd(d); }}
            className="text-[10px] px-2 py-1 rounded-md transition-colors"
            style={{
              background: trimEnd - trimStart === d ? C.accentBg : "rgba(255,255,255,0.04)",
              color: trimEnd - trimStart === d ? C.accent : C.textDim,
            }}
          >{d}s</button>
        ))}
      </div>
      <button
        onClick={() => updateScene(selectedScene.id, { duration: Math.max(2, trimEnd - trimStart) })}
        disabled={trimEnd - trimStart === selectedScene.duration && trimStart === 0}
        className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30"
        style={{ background: C.accentBg, color: C.accent }}
      >
        Apply ({trimEnd - trimStart}s)
      </button>
    </div>
  );
}

// ── Text Tool Panel ──
function TextToolPanel({ onClose }: { onClose: () => void }) {
  const { theme: C } = useEditorTheme();
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[320px] overflow-y-auto" style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[12px] font-semibold" style={{ color: C.text }}>Text Overlays</span>
        <button onClick={onClose} className="p-0.5 rounded transition-colors" style={{ color: C.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      <div className="p-2">
        <TextOverlayEditor />
      </div>
    </div>
  );
}

function EditorInner() {
  const router = useRouter();
  const {
    scriptData, pollenUsed, qualityTier,
    url, angle, storyboardImages, videoDimension,
    sceneAudioUrls, sceneVideoUrls, sceneDurations, finalVideoUrl,
    setScriptData, setStoryboardImages, setSceneAudioUrls, captionsEnabled, setCaptionsEnabled,
    setSceneVideoUrls, setSceneDurations, setFinalVideoUrl,
    setQualityTier, setVideoDimension, setUrl, setAngle,
  } = useAppContext();
  const {
    scenes, tracks, isInitialized, selectedScene, selectedSceneId, setSelectedSceneId,
    undo, redo, canUndo, canRedo,
    insertScene, splitScene, duplicateScene, deleteScene, deleteSelected,
    selectAllScenes, clearSelection, selectedSceneIds,
    snapEnabled, setSnapEnabled,
    showSafeZones, setShowSafeZones,
    isPlaying, setIsPlaying,
    playheadPosition, setPlayheadPosition, totalDuration,
    getSceneStartTime,
    addOverlay, importMedia,
    activeWorkspace, setActiveWorkspace,
    applyDefaultTransitions, removeAllTransitions,
  } = useEditorContext();
  const { theme: C, isDark, toggle: toggleTheme } = useEditorTheme();
  const [showExport, setShowExport] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [showTextTool, setShowTextTool] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<"properties" | "text">("properties");
  const [isDragOverEditor, setIsDragOverEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [recentProjects, setRecentProjects] = useState<VideoHistoryItem[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!scriptData?.scenes?.length) {
      // Sync cloud history on mount
      syncHistoryWithCloud().then(synced => {
        setRecentProjects(synced.slice(0, 8));
      });
    }
  }, [scriptData]);

  const handleSaveProject = async () => {
    if (!scriptData || scenes.length === 0) return;
    setIsSaving(true);
    try {
      const projectId = scriptData.id || `proj_${Date.now()}`;
      
      const historyItem: VideoHistoryItem = {
        id: projectId,
        title: scriptData.title || "Untitled",
        topic: url || "",
        angle: angle || "",
        thumbnailUrl: storyboardImages[scenes[0]?.id/10] || "",
        quality: qualityTier,
        dimensionId: videoDimension.id,
        dimensionLabel: videoDimension.label,
        totalSeconds: totalDuration,
        createdAt: new Date().toISOString(),
      };

      const state: ProjectState = {
        id: projectId,
        scriptData: { ...scriptData, id: projectId, editorScenes: scenes, editorTracks: tracks },
        storyboardImages,
        sceneAudioUrls,
        sceneVideoUrls,
        sceneDurations,
        musicUrl: null,
        finalVideoUrl,
        editorScenes: scenes,
        editorTracks: tracks,
      };

      await saveProjectState(state);
      await saveToHistory(historyItem);
      console.log("Project saved successfully.");
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (!scriptData || scenes.length === 0) return;
    
    const timeout = setTimeout(() => {
      if (!isSaving) {
        handleSaveProject();
      }
    }, 4000); // Auto-save 4 seconds after the last change is made
    
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, tracks, storyboardImages, sceneAudioUrls, sceneVideoUrls, qualityTier, videoDimension]);

  const handleLoadProject = async (item: VideoHistoryItem) => {
    setLoadingProjectId(item.id);
    setErrorMsg(null);
    try {
      const state = await loadProjectState(item.id);
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
        if (item.quality) setQualityTier(item.quality);
        if (item.dimensionId) {
          const dim = VIDEO_DIMENSIONS.find(d => d.id === item.dimensionId);
          if (dim) setVideoDimension(dim);
        }
        if (item.topic) setUrl(item.topic);
        if (item.angle) setAngle(item.angle);
      } else {
        setErrorMsg("Failed to load project state. It might be missing from cloud storage.");
      }
    } catch (e) {
      console.error("Failed to load project:", e);
      setErrorMsg("An unexpected error occurred while loading the project.");
    } finally {
      setLoadingProjectId(null);
    }
  };

  // ── Resizable panel widths and timeline height ──
  const DEFAULT_SOURCE_W = 250;
  const DEFAULT_PROPS_W = 360;
  const DEFAULT_TIMELINE_H = 220;
  const [sourceWidth, setSourceWidth] = useState(DEFAULT_SOURCE_W);
  const [propsWidth, setPropsWidth] = useState(DEFAULT_PROPS_W);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_H);

  // Generic resize handler for panels
  const panelResizeRef = useRef<{ startX: number; startW: number; setter: (w: number) => void; min: number; max: number; direction: 1 | -1 } | null>(null);

  const startPanelResize = useCallback((e: React.MouseEvent, setter: (w: number) => void, startW: number, min: number, max: number, direction: 1 | -1 = 1) => {
    e.preventDefault();
    panelResizeRef.current = { startX: e.clientX, startW: startW, setter, min, max, direction };
    const handleMove = (ev: MouseEvent) => {
      if (!panelResizeRef.current) return;
      const { startX, startW: sw, setter: set, min: mn, max: mx, direction: dir } = panelResizeRef.current;
      const delta = (ev.clientX - startX) * dir;
      set(Math.max(mn, Math.min(mx, sw + delta)));
    };
    const handleUp = () => {
      panelResizeRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, []);

  const resetLayout = useCallback(() => {
    setSourceWidth(DEFAULT_SOURCE_W);
    setPropsWidth(DEFAULT_PROPS_W);
    setTimelineHeight(DEFAULT_TIMELINE_H);
    setShowSource(true);
    setShowProperties(true);
  }, []);

  // Drag and drop files into editor
  const handleEditorDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverEditor(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        await importMedia(file);
      }
    }
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await importMedia(file);
    }
    e.target.value = "";
  };

  // Keyboard shortcuts — skip when user is interacting with any form element
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    const isFormElement = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    const meta = e.metaKey || e.ctrlKey;

    // Always allow undo/redo globally
    if (meta && e.key === "s") { e.preventDefault(); handleSaveProject(); return; }
    if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (meta && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }
    if (meta && e.key === "y") { e.preventDefault(); redo(); return; }
    if (meta && e.key === "e") { e.preventDefault(); setShowExport(true); return; }

    // Skip ALL other shortcuts when user is in a form element
    // This prevents backspace/delete from deleting scenes while editing text
    if (isFormElement) return;

    if (meta && e.key === "a") { e.preventDefault(); selectAllScenes(); }
    if (e.key === "Escape") { clearSelection(); setShowTrim(false); setShowTextTool(false); }
    if (e.key === " " && !meta) { e.preventDefault(); setIsPlaying(!isPlaying); }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(); // prevent browser back navigation
      if (selectedSceneIds.size > 1) deleteSelected();
      else if (selectedScene && scenes.length > 1) deleteScene(selectedScene.id);
    }
    if (meta && e.key === "d" && selectedScene) { e.preventDefault(); duplicateScene(selectedScene.id); }
    if (meta && e.key === "t") { e.preventDefault(); setShowTextTool(v => !v); setActiveRightTab("text"); }
    if (e.key === "?") { setShowShortcuts(v => !v); }
    if (e.key === "s" && !meta && selectedScene) {
      e.preventDefault();
      // Split at playhead position relative to scene start
      const sceneStart = getSceneStartTime(selectedScene.id);
      const splitAt = playheadPosition - sceneStart;
      if (splitAt > 0.5 && splitAt < selectedScene.duration - 0.5) {
        splitScene(selectedScene.id, Math.round(splitAt * 10) / 10);
      }
    }
    if (e.key === "n" || e.key === "N") { setSnapEnabled(!snapEnabled); }
    if (e.key === "t" && !meta) { setShowTrim(prev => !prev); }
    if (e.key === "Home") { e.preventDefault(); setPlayheadPosition(0); }
    if (e.key === "End") { e.preventDefault(); setPlayheadPosition(totalDuration); }
  }, [undo, redo, selectAllScenes, clearSelection, isPlaying, setIsPlaying, selectedScene, selectedSceneIds, deleteSelected, deleteScene, duplicateScene, scenes.length, snapEnabled, setSnapEnabled, setPlayheadPosition, totalDuration, handleSaveProject]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const fr = Math.floor((s % 1) * 30);
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}:${fr.toString().padStart(2, "0")}`;
  };

  const fmtShort = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleAddText = () => {
    if (!selectedScene) return;
    const overlay: TextOverlay = {
      id: `overlay-${Date.now()}`,
      text: "Title Text",
      position: "center",
      x: 50, y: 50,
      fontSize: 32,
      color: "#ffffff",
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
      backgroundColor: "",
      opacity: 1,
      animation: "none",
    };
    addOverlay(selectedScene.id, overlay);
    setShowTextTool(true);
    setActiveRightTab("text");
  };

  const isNoProject = !scriptData?.scenes?.length;
  const isLoading = !isInitialized || scenes.length === 0;

  return (
    <div
      className="editor-container fixed inset-0 z-[100] m-0 p-0 flex flex-col overflow-hidden text-[13px] bg-background"
      style={{ background: C.bg, color: C.text, fontFamily: "Inter, 'SF Pro Display', -apple-system, system-ui, sans-serif" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOverEditor(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragOverEditor(false); }}
      onDrop={handleEditorDrop}
    >
      {/* ── Conditional Loading/Empty Views (inside main return to fix hook issues) ── */}
      {isNoProject ? (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center p-8 overflow-y-auto" style={{ background: C.bg }}>
          <div className="w-full max-w-3xl space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
              <span className="material-symbols-outlined text-5xl" style={{ color: C.accent, opacity: 0.7 }}>movie_edit</span>
              <h2 className="text-2xl font-bold" style={{ color: C.text }}>Video Editor</h2>
              <p className="text-sm" style={{ color: C.textDim }}>Select a recent project to start editing, or create a new one from the dashboard.</p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 rounded-xl flex items-center gap-3 animate-fade-in" style={{ background: `${C.danger}15`, border: `1px solid ${C.danger}30`, color: C.danger }}>
                <span className="material-symbols-outlined text-xl">error</span>
                <p className="text-sm font-medium">{errorMsg}</p>
                <button onClick={() => setErrorMsg(null)} className="ml-auto p-1 hover:bg-black/5 rounded-lg">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* Recent Projects Grid */}
            {recentProjects.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Recent Projects</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleLoadProject(p)}
                      disabled={!!loadingProjectId}
                      className="group relative text-left rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{ background: C.panel, border: `1px solid ${C.border}` }}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video w-full overflow-hidden" style={{ background: C.panelDark }}>
                        {p.thumbnailUrl ? (
                          <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl" style={{ color: C.textMuted, opacity: 0.2 }}>movie</span>
                          </div>
                        )}
                        {/* Loading overlay */}
                        {loadingProjectId === p.id && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                          <span className="material-symbols-outlined text-white text-3xl">play_circle</span>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3 space-y-1">
                        <h4 className="text-sm font-bold truncate" style={{ color: C.text }}>{p.title || "Untitled"}</h4>
                        <div className="flex items-center gap-2 text-[10px]" style={{ color: C.textDim }}>
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{Math.floor(p.totalSeconds / 60)}:{String(Math.round(p.totalSeconds % 60)).padStart(2, "0")}</span>
                          <span>•</span>
                          <span className="uppercase">{p.quality}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: C.textDim }}>
                <span className="material-symbols-outlined text-4xl mb-2 block" style={{ opacity: 0.2 }}>folder_open</span>
                <p className="text-sm">No projects yet. Generate a video first!</p>
              </div>
            )}

            {/* Create New button */}
            <div className="text-center">
              <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02]" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})` }}>
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Create New Video
              </a>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: C.bg }}>
          <div className="flex items-center gap-3" style={{ color: C.textDim }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading editor...</span>
          </div>
        </div>
      ) : null}
      {/* Hidden file input for import */}
      <input ref={importFileRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={handleImportFiles} className="hidden" />

      {/* Drag overlay */}
      {isDragOverEditor && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none" style={{ background: "rgba(74, 158, 237, 0.08)", border: `3px dashed ${C.accent}` }}>
          <div className="flex flex-col items-center gap-2 px-8 py-6 rounded-xl" style={{ background: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)", color: C.accent }}>
            <span className="material-symbols-outlined text-4xl">upload_file</span>
            <span className="text-sm font-semibold">Drop media files to import</span>
            <span className="text-xs" style={{ color: C.textDim }}>Images, videos, and audio files</span>
          </div>
        </div>
      )}

      {/* ═══ Menu Bar ═══ */}
      <div className="flex items-center gap-0 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 40 }}>
        {/* App logo + back */}
        <button onClick={() => router.push("/script")} className="flex items-center gap-2 px-4 h-full transition-colors"
          style={{ color: C.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span className="text-[13px] font-semibold tracking-tight">Link2Video</span>
        </button>
        <div style={{ width: 1, height: 18, background: C.border }} />

        {/* Menu items with dropdowns */}
        {[
          { label: "File", items: [
            { label: "Save Project", icon: "save", action: handleSaveProject, shortcut: "Ctrl+S" },
            { label: "Open Project...", icon: "folder_open", action: () => { setScriptData(null); }, shortcut: "Ctrl+O" },
            { label: "Import Media...", icon: "upload", action: () => importFileRef.current?.click() },
            { divider: true },
            { label: "Export Video", icon: "movie", action: () => setShowExport(true), shortcut: "Ctrl+E" },
            { divider: true },
            { label: "Back to Dashboard", icon: "home", action: () => router.push("/") },
          ]},
          { label: "Edit", items: [
            { label: "Undo", icon: "undo", action: undo, disabled: !canUndo, shortcut: "Ctrl+Z" },
            { label: "Redo", icon: "redo", action: redo, disabled: !canRedo, shortcut: "Ctrl+Shift+Z" },
            { divider: true },
            { label: "Select All", icon: "select_all", action: selectAllScenes, shortcut: "Ctrl+A" },
            { label: "Deselect", icon: "deselect", action: clearSelection, shortcut: "Esc" },
            { divider: true },
            { label: "Preferences", icon: "settings", action: () => setShowShortcuts(true) },
          ]},
          { label: "Clip", items: [
            { label: "Insert Scene", icon: "add", action: () => insertScene(selectedScene?.id || null) },
            { label: "Duplicate", icon: "content_copy", action: () => selectedScene && duplicateScene(selectedScene.id), disabled: !selectedScene, shortcut: "Ctrl+D" },
            { label: "Split at Playhead", icon: "content_cut", action: () => {
              if (!selectedScene) return;
              const start = getSceneStartTime(selectedScene.id);
              const splitAt = playheadPosition - start;
              if (splitAt > 0.5 && splitAt < selectedScene.duration - 0.5) {
                splitScene(selectedScene.id, Math.round(splitAt * 10) / 10);
              } else {
                splitScene(selectedScene.id, Math.floor(selectedScene.duration / 2));
              }
            }, disabled: !selectedScene || (selectedScene?.duration ?? 0) < 2, shortcut: "S" },
            { divider: true },
            { label: "Add Text Overlay", icon: "title", action: handleAddText, disabled: !selectedScene, shortcut: "Ctrl+T" },
            { divider: true },
            { label: "Delete", icon: "delete_outline", action: () => selectedScene && scenes.length > 1 && deleteScene(selectedScene.id), disabled: !selectedScene || scenes.length <= 1, danger: true, shortcut: "Del" },
          ]},
          { label: "View", items: [
            { label: showSource ? "Hide Source Panel" : "Show Source Panel", icon: "view_sidebar", action: () => setShowSource(!showSource) },
            { label: showProperties ? "Hide Properties" : "Show Properties", icon: "tune", action: () => setShowProperties(!showProperties) },
            { divider: true },
            { label: "Safe Zones", icon: "grid_on", action: () => setShowSafeZones(!showSafeZones), active: showSafeZones },
            { label: "Snap to Grid", icon: "straighten", action: () => setSnapEnabled(!snapEnabled), active: snapEnabled },
            { divider: true },
            { label: "Keyboard Shortcuts", icon: "keyboard", action: () => setShowShortcuts(true), shortcut: "?" },
            { divider: true },
            { label: "Reset Layout", icon: "fit_screen", action: resetLayout },
          ]},
        ].map(menu => (
          <div key={menu.label} className="relative">
            <button
              className="px-3 h-full text-[12px] transition-colors"
              style={{ color: openMenu === menu.label ? C.text : C.textDim, background: openMenu === menu.label ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
                e.currentTarget.style.color = C.text;
                if (openMenu) setOpenMenu(menu.label);
              }}
              onMouseLeave={(e) => {
                if (openMenu !== menu.label) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textDim; }
              }}
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            >{menu.label}</button>
            {openMenu === menu.label && (
              <>
                <div className="fixed inset-0 z-[49]" onClick={() => setOpenMenu(null)} />
                <div className="absolute top-full left-0 z-[50] py-1 rounded-lg shadow-2xl min-w-[200px]"
                  style={{ background: isDark ? "#252528" : "#fff", border: `1px solid ${C.border}` }}
                >
                  {menu.items.map((item: any, i: number) =>
                    item.divider ? (
                      <div key={i} className="my-1 mx-2 h-px" style={{ background: C.border }} />
                    ) : (
                      <button
                        key={i}
                        disabled={item.disabled}
                        onClick={() => { if (!item.disabled) { item.action?.(); setOpenMenu(null); } }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
                        style={{
                          color: item.danger ? C.danger : item.disabled ? C.textMuted : C.text,
                          opacity: item.disabled ? 0.4 : 1,
                        }}
                        onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="material-symbols-outlined text-[15px]" style={{ color: item.active ? C.accent : "inherit" }}>{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {item.active && <span className="material-symbols-outlined text-[13px]" style={{ color: C.accent }}>check</span>}
                        {item.shortcut && <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>{item.shortcut}</span>}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        <div className="flex-1" />

        {/* Center: Project info */}
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold" style={{ color: C.text }}>{scriptData?.title || "Untitled Sequence"}</span>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full" style={{ background: C.accentBg, color: C.accent }}>
            {scenes.length} clips
          </span>
        </div>

        {/* Workspace switcher */}
        <div className="flex items-center gap-0.5 mx-3 px-1 py-0.5 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
          {([
            { id: "editing" as const, icon: "movie_edit", label: "Editing" },
            { id: "review" as const, icon: "preview", label: "Review" },
            { id: "library" as const, icon: "video_library", label: "Library" },
          ]).map(ws => (
            <button
              key={ws.id}
              onClick={() => {
                setActiveWorkspace(ws.id);
                if (ws.id === "editing") { setShowSource(true); setShowProperties(true); }
                else if (ws.id === "review") { setShowSource(false); setShowProperties(false); }
                else if (ws.id === "library") { setShowSource(true); setShowProperties(false); }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: activeWorkspace === ws.id ? C.accentBg : "transparent",
                color: activeWorkspace === ws.id ? C.accent : C.textMuted,
              }}
              title={ws.label}
            >
              <span className="material-symbols-outlined text-[13px]">{ws.icon}</span>
              <span className="hidden xl:inline">{ws.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right: credits + workspace controls */}
        <div className="flex items-center gap-2 pr-3">
          {/* Credits indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${C.border}` }}
            title={`Quality: ${qualityTier.charAt(0).toUpperCase() + qualityTier.slice(1)} · Est. Pollen: ${pollenUsed.toFixed(4)}`}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ color: pollenUsed > 0 ? C.warn : C.success, fontVariationSettings: "'FILL' 1" }}>
              {pollenUsed > 0 ? "eco" : "stars"}
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: C.textMuted }}>Est. Pollen</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: pollenUsed > 0 ? C.text : C.success }}>
                {pollenUsed > 0 ? `${pollenUsed.toFixed(2)} ⚘` : "Free"}
              </span>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{
              background: qualityTier === "pro" ? "rgba(168,85,247,0.15)" : qualityTier === "medium" ? C.accentBg : "rgba(74,222,128,0.12)",
              color: qualityTier === "pro" ? "#a855f7" : qualityTier === "medium" ? C.accent : C.success,
            }}>
              {qualityTier}
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: C.border }} />

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-1 rounded-lg transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <span className="material-symbols-outlined text-[14px]">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          <button onClick={() => setShowShortcuts(true)} className="p-1 rounded-lg transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
            title="Keyboard Shortcuts (?)"
          >
            <span className="material-symbols-outlined text-[14px]">keyboard</span>
          </button>
          <button onClick={() => setShowExport(true)} className="flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all shadow-sm"
            style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})` }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
            Export
          </button>
        </div>
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center px-3 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 44 }}>
        <div className="flex items-center gap-0.5">
          <TBtn icon="save" label="Save Project (Ctrl+S)" onClick={handleSaveProject} active={isSaving} />
          <TSep />
          <TBtn icon="undo" label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
          <TBtn icon="redo" label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
          <TSep />
          <TBtn icon="add" label="Insert Scene" onClick={() => insertScene(selectedScene?.id || null)} />
          <TBtn icon="content_cut" label="Split at Playhead (S)" onClick={() => {
            if (!selectedScene) return;
            const start = getSceneStartTime(selectedScene.id);
            const splitAt = playheadPosition - start;
            if (splitAt > 0.5 && splitAt < selectedScene.duration - 0.5) {
              splitScene(selectedScene.id, Math.round(splitAt * 10) / 10);
            } else {
              splitScene(selectedScene.id, Math.floor(selectedScene.duration / 2));
            }
          }} disabled={!selectedScene || selectedScene.duration < 2} />
          <TBtn icon="content_copy" label="Duplicate (Ctrl+D)" onClick={() => selectedScene && duplicateScene(selectedScene.id)} disabled={!selectedScene} />
          <TBtn icon="delete_outline" label="Delete (Del)" onClick={() => selectedScene && scenes.length > 1 && deleteScene(selectedScene.id)} disabled={!selectedScene || scenes.length <= 1} danger />
          <TSep />
          <TBtn icon="crop" label="Trim (T)" onClick={() => setShowTrim(!showTrim)} active={showTrim} />
          <TBtn icon="title" label="Text (Ctrl+T)" onClick={handleAddText} disabled={!selectedScene} badge={selectedScene?.overlays.length || undefined} />
          <TBtn icon="closed_caption" label="Auto Captions" onClick={() => setCaptionsEnabled(!captionsEnabled)} active={captionsEnabled} />
          <TSep />
          <TBtn icon="upload" label="Import Media" onClick={() => importFileRef.current?.click()} />
          <TSep />
          <TBtn icon="grid_on" label="Safe Zones" onClick={() => setShowSafeZones(!showSafeZones)} active={showSafeZones} />
          <TBtn icon="straighten" label="Snap (N)" onClick={() => setSnapEnabled(!snapEnabled)} active={snapEnabled} />
          <TSep />
          <TBtn icon="auto_awesome" label="Add Transitions" onClick={() => applyDefaultTransitions("fade", 0.5)} />
          <TBtn icon="block" label="Remove Transitions" onClick={() => removeAllTransitions()} />
        </div>

        <div className="flex-1" />

        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <TBtn icon="skip_previous" label="Go to Start" onClick={() => { setPlayheadPosition(0); if (scenes.length > 0) setSelectedSceneId(scenes[0].id); }} />
          <TBtn icon="fast_rewind" label="Step Back" onClick={() => {
            const idx = scenes.findIndex(s => s.id === selectedSceneId);
            if (idx > 0) { setSelectedSceneId(scenes[idx - 1].id); setPlayheadPosition(getSceneStartTime(scenes[idx - 1].id)); }
          }} />
          <button
            onClick={() => {
              if (!isPlaying && playheadPosition >= totalDuration) {
                setPlayheadPosition(0);
                if (scenes.length > 0) setSelectedSceneId(scenes[0].id);
              }
              setIsPlaying(!isPlaying);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-sm"
            style={{ background: isPlaying ? C.danger : C.accent, color: "#fff" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "stop" : "play_arrow"}
            </span>
          </button>
          <TBtn icon="fast_forward" label="Step Forward" onClick={() => {
            const idx = scenes.findIndex(s => s.id === selectedSceneId);
            if (idx < scenes.length - 1) { setSelectedSceneId(scenes[idx + 1].id); setPlayheadPosition(getSceneStartTime(scenes[idx + 1].id)); }
          }} />
          <TBtn icon="skip_next" label="Go to End" onClick={() => { if (scenes.length > 0) { const last = scenes[scenes.length - 1]; setSelectedSceneId(last.id); setPlayheadPosition(getSceneStartTime(last.id)); } }} />
        </div>

        <div className="flex-1" />

        {/* Timecode display */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-md font-mono text-[13px] tabular-nums font-semibold" style={{ background: isDark ? "rgba(0,0,0,0.5)" : "#e8e8e8", color: C.accent, letterSpacing: "0.5px" }}>
            {fmt(playheadPosition)}
          </div>
          <span className="text-[11px]" style={{ color: C.textMuted }}>/ {fmtShort(totalDuration)}</span>
        </div>

        {/* Panel toggles + reset */}
        <div className="flex items-center gap-1 ml-3">
          <TBtn icon="view_sidebar" label="Source" onClick={() => setShowSource(!showSource)} active={showSource} />
          <TBtn icon="tune" label="Properties" onClick={() => setShowProperties(!showProperties)} active={showProperties} />
          <TBtn icon="fit_screen" label="Reset Layout" onClick={resetLayout} />
        </div>
      </div>

      {/* ═══ Main Content: 3-panel layout with resizable borders ═══ */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Source Monitor */}
        {showSource && (
          <>
            <div className="flex-shrink-0 min-w-[140px] max-w-[400px]" style={{ width: sourceWidth }}>
              <SourceMonitor />
            </div>
            {/* Resize handle: source ↔ preview */}
            <div
              className="flex-shrink-0 w-[5px] cursor-col-resize hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center group"
              style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              onMouseDown={(e) => startPanelResize(e, setSourceWidth, sourceWidth, 140, 400, 1)}
            >
              <div className="w-[2px] h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: C.accent }} />
            </div>
          </>
        )}

        {/* Center: Program Monitor (Preview) */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ background: C.panel }}>
          {/* Program monitor header */}
          <div className="flex items-center px-2 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 34 }}>
            <PanelTab label="Program" active />
            <div className="flex-1" />
            <span className="text-[11px] font-mono pr-2" style={{ color: C.textMuted }}>
              {selectedScene ? `Scene ${selectedScene.orderIndex + 1}` : "No selection"}
            </span>
          </div>
          {/* Preview area */}
          <div className="flex-1 relative min-h-0 p-2" style={{ background: "#0a0a0c" }}>
            <div className="absolute inset-2 flex flex-col min-h-0">
              <PreviewPlayer />
            </div>
            {showTextTool && <TextToolPanel onClose={() => setShowTextTool(false)} />}
          </div>
        </div>

        {/* Right: Properties / Effects */}
        {showProperties && (
          <>
            {/* Resize handle: preview ↔ properties */}
            <div
              className="flex-shrink-0 w-[5px] cursor-col-resize hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center group"
              style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              onMouseDown={(e) => startPanelResize(e, setPropsWidth, propsWidth, 240, 500, -1)}
            >
              <div className="w-[2px] h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: C.accent }} />
            </div>
            <div className="flex-shrink-0 flex flex-col min-w-[240px] max-w-[500px]" style={{ width: propsWidth, background: C.panel }}>
              {/* Tabs */}
              <div className="flex items-center px-2 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 34 }}>
                <PanelTab label="Properties" active={activeRightTab === "properties"} onClick={() => setActiveRightTab("properties")} />
                <PanelTab label="Text" active={activeRightTab === "text"} onClick={() => setActiveRightTab("text")} />
              </div>
              {/* Trim panel (collapsible) */}
              {showTrim && <TrimPanel />}
              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {activeRightTab === "properties" ? (
                  <PropertiesPanel />
                ) : (
                  <div className="p-2 overflow-y-auto h-full">
                    <TextOverlayEditor />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Timeline (resizable height) ═══ */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Timeline height={timelineHeight} onHeightChange={setTimelineHeight} />
      </div>

      {/* ═══ Status Bar ═══ */}
      <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ background: C.headerBg, borderTop: `1px solid ${C.border}`, height: 30 }}>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: C.textDim }}>
            {selectedSceneIds.size > 1 ? `${selectedSceneIds.size} selected` : selectedScene ? `Scene ${selectedScene.orderIndex + 1} — ${selectedScene.duration}s` : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-mono" style={{ color: C.textMuted }}>{scenes.length} scenes</span>
          <span className="text-[11px] font-mono" style={{ color: C.textMuted }}>{fmtShort(totalDuration)} total</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: isPlaying ? C.danger : C.success }} />
            <span className="text-[11px]" style={{ color: C.textDim }}>{isPlaying ? "Playing" : "Ready"}</span>
          </span>
        </div>
      </div>

      {/* ═══ Export Dialog ═══ */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {/* ═══ Keyboard Shortcuts Modal ═══ */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowShortcuts(false)}>
          <div className="rounded-xl p-6 w-full max-w-sm shadow-2xl" style={{ background: isDark ? "#252528" : "#fff", border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: C.text }}>Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1 rounded-lg transition-colors" style={{ color: C.textDim }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="space-y-0.5">
              {[
                ["Space", "Play / Pause"],
                ["Ctrl + Z", "Undo"],
                ["Ctrl + Shift + Z", "Redo"],
                ["Ctrl + D", "Duplicate scene"],
                ["Ctrl + T", "Add text overlay"],
                ["Ctrl + A", "Select all"],
                ["Ctrl + E", "Export"],
                ["S", "Split at playhead"],
                ["Delete", "Remove clip"],
                ["Escape", "Deselect / close"],
                ["N", "Toggle Snap"],
                ["T", "Toggle Trim Panel"],
                ["Home", "Go to Start"],
                ["End", "Go to End"],
                ["?", "Shortcuts"],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded-xl transition-all"
                  onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span className="text-[12px]" style={{ color: C.textDim }}>{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-md text-[10px] font-mono" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: C.text, border: `1px solid ${C.border}` }}>{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorThemeProvider({ children }: { children: React.ReactNode }) {
  // Sync with next-themes: check for .dark class on <html>
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains("dark"));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const theme = isDark ? DARK : LIGHT;

  const toggle = () => {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.classList.remove(isDark ? "dark" : "light");
    document.documentElement.classList.add(nextTheme);
    setIsDark(!isDark);
  };

  return (
    <EditorThemeContext.Provider value={{ theme, isDark, toggle }}>
      {children}
    </EditorThemeContext.Provider>
  );
}

export default function EditorPage() {
  return (
    <ErrorBoundary>
      <EditorThemeProvider>
        <EditorProvider>
          <EditorInner />
        </EditorProvider>
      </EditorThemeProvider>
    </ErrorBoundary>
  );
}
