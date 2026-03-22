"use client";
import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import { EditorProvider, useEditorContext, TextOverlay } from "@/context/EditorContext";
import PreviewPlayer from "@/components/editor/PreviewPlayer";
import Timeline from "@/components/editor/Timeline";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import ExportDialog from "@/components/editor/ExportDialog";
import TextOverlayEditor from "@/components/editor/TextOverlayEditor";

// ── Theme system ──
const DARK = {
  bg: "#1e1e1e",
  panel: "#232323",
  panelDark: "#1a1a1a",
  border: "#3a3a3a",
  borderLight: "#4a4a4a",
  headerBg: "#2d2d2d",
  accent: "#4a9eed",
  accentDim: "#2a6aad",
  accentBg: "rgba(74, 158, 237, 0.12)",
  text: "#d4d4d4",
  textDim: "#808080",
  textMuted: "#5a5a5a",
  danger: "#e5534b",
  success: "#3fb950",
  warn: "#d29922",
};

const LIGHT = {
  bg: "#f5f5f5",
  panel: "#ffffff",
  panelDark: "#f0f0f0",
  border: "#e0e0e0",
  borderLight: "#d0d0d0",
  headerBg: "#fafafa",
  accent: "#2979ff",
  accentDim: "#1565c0",
  accentBg: "rgba(41, 121, 255, 0.08)",
  text: "#1a1a1a",
  textDim: "#666666",
  textMuted: "#999999",
  danger: "#d32f2f",
  success: "#2e7d32",
  warn: "#f57f17",
};

type EditorTheme = typeof DARK;
const EditorThemeContext = createContext<{ theme: EditorTheme; isDark: boolean; toggle: () => void }>({ theme: DARK, isDark: true, toggle: () => {} });
export function useEditorTheme() { return useContext(EditorThemeContext); }

// Current theme — used as default, will be overridden by context in the provider
let C = DARK;

// ── Panel Header Tab ──
function PanelTab({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-[11px] font-medium transition-colors relative"
      style={{
        color: active ? C.text : C.textDim,
        background: active ? C.panel : "transparent",
      }}
    >
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: C.accent }} />}
    </button>
  );
}

// ── Toolbar Icon Button ──
function TBtn({ icon, label, onClick, active, disabled, danger, badge, filled }: {
  icon: string; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; danger?: boolean; badge?: string | number; filled?: boolean;
}) {
  const hoverBg = C.bg === DARK.bg ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="relative flex items-center justify-center w-7 h-7 rounded transition-all"
      style={{
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        color: danger ? C.danger : active ? C.accent : C.textDim,
        background: active ? C.accentBg : "transparent",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = active ? C.accentBg : hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? C.accentBg : "transparent"; }}
    >
      <span className="material-symbols-outlined text-[16px]" style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{icon}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 text-white text-[7px] w-3 h-3 rounded-full flex items-center justify-center font-bold" style={{ background: C.accent }}>{badge}</span>
      )}
    </button>
  );
}

function TSep() {
  return <div className="w-px h-5 mx-1" style={{ background: C.border }} />;
}

// ── Source Monitor (Scene Browser) ──
function SourceMonitor() {
  const {
    scenes, selectedSceneId, setSelectedSceneId, setPlayheadPosition,
    getSceneStartTime, reorderScene,
  } = useEditorContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDragFrom(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOver(index); };
  const handleDrop = (index: number) => {
    if (dragFrom !== null && dragFrom !== index) reorderScene(dragFrom, index);
    setDragFrom(null); setDragOver(null);
  };
  const handleDragEnd = () => { setDragFrom(null); setDragOver(null); };

  useEffect(() => {
    if (!scrollRef.current || selectedSceneId === null) return;
    const idx = scenes.findIndex(s => s.id === selectedSceneId);
    if (idx < 0) return;
    const child = scrollRef.current.children[idx] as HTMLElement;
    if (child) child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedSceneId, scenes]);

  return (
    <div className="flex flex-col h-full" style={{ background: C.panel, borderRight: `1px solid ${C.border}` }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-1 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 24 }}>
        <div className="flex">
          <PanelTab label="Source" active />
          <PanelTab label="Media" />
        </div>
        <span className="text-[9px] font-mono pr-2" style={{ color: C.textMuted }}>{scenes.length} clips</span>
      </div>
      {/* Scene grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-1.5 gap-1.5" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", alignContent: "start" }}>
        {scenes.map((scene, index) => {
          const isSelected = selectedSceneId === scene.id;
          const isDragTarget = dragOver === index && dragFrom !== index;
          return (
            <div
              key={scene.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                setSelectedSceneId(scene.id);
                setPlayheadPosition(getSceneStartTime(scene.id));
              }}
              className="cursor-pointer rounded overflow-hidden transition-all"
              style={{
                border: `2px solid ${isSelected ? C.accent : isDragTarget ? C.warn : "transparent"}`,
                opacity: scene.isHidden ? 0.3 : dragFrom === index ? 0.4 : 1,
                background: C.panelDark,
              }}
            >
              <div className="aspect-video relative" style={{ background: "rgba(255,255,255,0.03)" }}>
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm" style={{ color: C.textMuted }}>image</span>
                  </div>
                )}
                <div className="absolute top-0.5 left-0.5 px-1 rounded text-[8px] font-bold text-white" style={{ background: "rgba(0,0,0,0.7)" }}>
                  {scene.orderIndex + 1}
                </div>
                <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-mono text-white" style={{ background: "rgba(0,0,0,0.7)" }}>
                  {scene.duration}s
                </div>
                {(scene.overlays.length > 0 || scene.filter !== "none") && (
                  <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                    {scene.overlays.length > 0 && <span className="w-2.5 h-2.5 rounded-sm flex items-center justify-center text-white text-[6px] font-bold" style={{ background: C.accent }}>T</span>}
                    {scene.filter !== "none" && <span className="w-2.5 h-2.5 rounded-sm flex items-center justify-center text-white text-[6px] font-bold" style={{ background: C.warn }}>F</span>}
                  </div>
                )}
              </div>
              <div className="px-1 py-0.5" style={{ background: isSelected ? C.accentBg : "transparent" }}>
                <p className="text-[8px] truncate" style={{ color: C.textDim }}>{scene.narration.slice(0, 35)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Trim Panel ──
function TrimPanel() {
  const { selectedScene, updateScene } = useEditorContext();
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  useEffect(() => {
    if (selectedScene) { setTrimStart(0); setTrimEnd(selectedScene.duration); }
  }, [selectedScene?.id, selectedScene?.duration]);

  if (!selectedScene) return null;
  const maxDuration = Math.max(selectedScene.duration, 30);

  return (
    <div className="p-2.5 space-y-2" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.textMuted }}>Trim</span>
        <span className="text-[9px] font-mono" style={{ color: C.textDim }}>{trimEnd - trimStart}s / {selectedScene.duration}s</span>
      </div>
      <div className="relative h-8 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {selectedScene.imageUrl && <img src={selectedScene.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-25" alt="" />}
        <div className="absolute top-0 bottom-0" style={{
          left: `${(trimStart / maxDuration) * 100}%`,
          width: `${((trimEnd - trimStart) / maxDuration) * 100}%`,
          background: `${C.accent}20`, borderLeft: `2px solid ${C.accent}`, borderRight: `2px solid ${C.accent}`,
        }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[8px] block mb-0.5" style={{ color: C.textMuted }}>In: {trimStart}s</span>
          <input type="range" min={0} max={Math.max(0, trimEnd - 2)} value={trimStart} onChange={e => setTrimStart(Number(e.target.value))} className="w-full h-0.5" style={{ accentColor: C.accent }} />
        </div>
        <div>
          <span className="text-[8px] block mb-0.5" style={{ color: C.textMuted }}>Out: {trimEnd}s</span>
          <input type="range" min={trimStart + 2} max={maxDuration} value={trimEnd} onChange={e => setTrimEnd(Number(e.target.value))} className="w-full h-0.5" style={{ accentColor: C.accent }} />
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {[4, 6, 8, 10, 12, 15, 20].map(d => (
          <button key={d} onClick={() => { setTrimStart(0); setTrimEnd(d); }}
            className="text-[8px] px-1.5 py-0.5 rounded transition-colors"
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
        className="w-full py-1 rounded text-[9px] font-bold transition-all disabled:opacity-30"
        style={{ background: C.accentBg, color: C.accent }}
      >
        Apply ({trimEnd - trimStart}s)
      </button>
    </div>
  );
}

// ── Text Tool Panel ──
function TextToolPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[280px] overflow-y-auto" style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-3 py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[10px] font-semibold" style={{ color: C.text }}>Text Overlays</span>
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
  const { scriptData } = useAppContext();
  const {
    scenes, isInitialized, selectedScene, selectedSceneId,
    undo, redo, canUndo, canRedo,
    insertScene, splitScene, duplicateScene, deleteScene, deleteSelected,
    selectAllScenes, clearSelection, selectedSceneIds,
    snapEnabled, setSnapEnabled,
    showSafeZones, setShowSafeZones,
    isPlaying, setIsPlaying,
    playheadPosition, totalDuration,
    addOverlay, importMedia,
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
  const importFileRef = useRef<HTMLInputElement>(null);

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
  }, [undo, redo, selectAllScenes, clearSelection, isPlaying, setIsPlaying, selectedScene, selectedSceneIds, deleteSelected, deleteScene, duplicateScene, scenes.length]);

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

  if (!scriptData?.scenes?.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-5xl" style={{ color: C.textMuted }}>movie_edit</span>
          <h2 className="text-lg font-semibold" style={{ color: C.text }}>No project loaded</h2>
          <p className="text-sm max-w-xs" style={{ color: C.textDim }}>Create a video first — enter a topic, generate a script, and approve your storyboard.</p>
          <button onClick={() => router.push("/")} className="mt-2 px-6 py-2 rounded text-sm font-semibold text-white" style={{ background: C.accent }}>Go to Home</button>
        </div>
      </div>
    );
  }

  if (!isInitialized || scenes.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-sm" style={{ color: C.textDim }}>Loading editor...</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOverEditor(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragOverEditor(false); }}
      onDrop={handleEditorDrop}
    >
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
      <div className="flex items-center gap-0 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 32 }}>
        {/* App logo + back */}
        <button onClick={() => router.push("/storyboard")} className="flex items-center gap-1.5 px-3 h-full transition-colors"
          style={{ color: C.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; }}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          <span className="text-[11px] font-medium">Link2Video</span>
        </button>
        <div style={{ width: 1, height: 16, background: C.border }} />

        {/* Menu items */}
        {["File", "Edit", "Clip", "Sequence"].map(m => (
          <button key={m} className="px-3 h-full text-[11px] transition-colors"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textDim; }}
            onClick={() => {
              if (m === "File") setShowExport(true);
              if (m === "Edit") {} // future
            }}
          >{m}</button>
        ))}

        <div className="flex-1" />

        {/* Center: Project info */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium" style={{ color: C.text }}>{scriptData?.title || "Untitled Sequence"}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: C.textDim }}>
            {scenes.length} clips
          </span>
        </div>

        <div className="flex-1" />

        {/* Right: workspace controls */}
        <div className="flex items-center gap-1 pr-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-1 rounded transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <span className="material-symbols-outlined text-[14px]">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          <button onClick={() => setShowShortcuts(true)} className="p-1 rounded transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = "transparent"; }}
            title="Keyboard Shortcuts (?)"
          >
            <span className="material-symbols-outlined text-[14px]">keyboard</span>
          </button>
          <button onClick={() => setShowExport(true)} className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-semibold text-white transition-all"
            style={{ background: C.accent }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
            Export
          </button>
        </div>
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center px-2 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 34 }}>
        {/* Edit tools */}
        <div className="flex items-center gap-0.5">
          <TBtn icon="undo" label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
          <TBtn icon="redo" label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
          <TSep />
          <TBtn icon="add" label="Insert Scene" onClick={() => insertScene(selectedScene?.id || null)} />
          <TBtn icon="content_cut" label="Split (S)" onClick={() => selectedScene && splitScene(selectedScene.id, Math.floor(selectedScene.duration / 2))} disabled={!selectedScene || selectedScene.duration < 4} />
          <TBtn icon="content_copy" label="Duplicate (Ctrl+D)" onClick={() => selectedScene && duplicateScene(selectedScene.id)} disabled={!selectedScene} />
          <TBtn icon="delete_outline" label="Delete (Del)" onClick={() => selectedScene && scenes.length > 1 && deleteScene(selectedScene.id)} disabled={!selectedScene || scenes.length <= 1} danger />
          <TSep />
          <TBtn icon="crop" label="Trim (T)" onClick={() => setShowTrim(!showTrim)} active={showTrim} />
          <TBtn icon="title" label="Text (Ctrl+T)" onClick={handleAddText} disabled={!selectedScene} badge={selectedScene?.overlays.length || undefined} />
          <TSep />
          <TBtn icon="upload" label="Import Media" onClick={() => importFileRef.current?.click()} />
          <TSep />
          <TBtn icon="grid_on" label="Safe Zones" onClick={() => setShowSafeZones(!showSafeZones)} active={showSafeZones} />
          <TBtn icon="straighten" label="Snap (N)" onClick={() => setSnapEnabled(!snapEnabled)} active={snapEnabled} />
        </div>

        <div className="flex-1" />

        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <TBtn icon="skip_previous" label="Go to Start" onClick={() => {}} />
          <TBtn icon="fast_rewind" label="Step Back" onClick={() => {}} />
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-8 h-8 rounded transition-all"
            style={{ background: isPlaying ? C.danger : C.accent, color: "#fff" }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "stop" : "play_arrow"}
            </span>
          </button>
          <TBtn icon="fast_forward" label="Step Forward" onClick={() => {}} />
          <TBtn icon="skip_next" label="Go to End" onClick={() => {}} />
        </div>

        <div className="flex-1" />

        {/* Timecode display */}
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded font-mono text-[11px] tabular-nums" style={{ background: isDark ? "#000" : "#e8e8e8", color: C.accent, letterSpacing: "0.5px" }}>
            {fmt(playheadPosition)}
          </div>
          <span className="text-[9px]" style={{ color: C.textMuted }}>/ {fmtShort(totalDuration)}</span>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-0.5 ml-3">
          <TBtn icon="view_sidebar" label="Source" onClick={() => setShowSource(!showSource)} active={showSource} />
          <TBtn icon="tune" label="Properties" onClick={() => setShowProperties(!showProperties)} active={showProperties} />
        </div>
      </div>

      {/* ═══ Main Content: 3-panel layout ═══ */}
      <div className="flex-1 flex min-h-0" style={{ gap: 2 }}>
        {/* Left: Source Monitor */}
        {showSource && (
          <div className="w-[220px] min-w-[180px] flex-shrink-0">
            <SourceMonitor />
          </div>
        )}

        {/* Center: Program Monitor (Preview) */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ background: C.panel }}>
          {/* Program monitor header */}
          <div className="flex items-center px-1 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 24 }}>
            <PanelTab label="Program" active />
            <PanelTab label="Reference" />
            <div className="flex-1" />
            <span className="text-[9px] font-mono pr-2" style={{ color: C.textMuted }}>
              {selectedScene ? `Scene ${selectedScene.orderIndex + 1}` : "No selection"}
            </span>
          </div>
          {/* Preview area */}
          <div className="flex-1 relative min-h-0 p-1" style={{ background: "#000" }}>
            <PreviewPlayer />
            {showTextTool && <TextToolPanel onClose={() => setShowTextTool(false)} />}
          </div>
        </div>

        {/* Right: Properties / Effects */}
        {showProperties && (
          <div className="w-[340px] min-w-[280px] flex-shrink-0 flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.border}` }}>
            {/* Tabs */}
            <div className="flex items-center px-1 flex-shrink-0" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}`, height: 24 }}>
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
        )}
      </div>

      {/* ═══ Timeline ═══ */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <Timeline />
      </div>

      {/* ═══ Status Bar ═══ */}
      <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ background: C.headerBg, borderTop: `1px solid ${C.border}`, height: 22 }}>
        <div className="flex items-center gap-3">
          <span className="text-[9px]" style={{ color: C.textMuted }}>
            {selectedSceneIds.size > 1 ? `${selectedSceneIds.size} selected` : selectedScene ? `Scene ${selectedScene.orderIndex + 1} — ${selectedScene.duration}s` : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono" style={{ color: C.textMuted }}>{scenes.length} scenes</span>
          <span className="text-[9px] font-mono" style={{ color: C.textMuted }}>{fmtShort(totalDuration)} total</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.success }} />
            <span className="text-[9px]" style={{ color: C.textMuted }}>Ready</span>
          </span>
        </div>
      </div>

      {/* ═══ Export Dialog ═══ */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {/* ═══ Keyboard Shortcuts Modal ═══ */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowShortcuts(false)}>
          <div className="rounded-lg p-5 w-full max-w-sm shadow-2xl" style={{ background: C.panel, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: C.text }}>Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} style={{ color: C.textDim }}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                ["Space", "Play / Stop"],
                ["Ctrl + Z", "Undo"],
                ["Ctrl + Shift + Z", "Redo"],
                ["Ctrl + D", "Duplicate scene"],
                ["Ctrl + T", "Add text overlay"],
                ["Ctrl + A", "Select all"],
                ["Ctrl + E", "Export"],
                ["Delete", "Remove clip"],
                ["Escape", "Deselect / close"],
                ["?", "Shortcuts"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textDim }}>{desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.06)", color: C.text }}>{key}</kbd>
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
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("editor-theme") !== "light";
    }
    return true;
  });
  const theme = isDark ? DARK : LIGHT;
  // Update the module-level C for components that read it outside context
  C = theme;
  const toggle = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("editor-theme", next ? "dark" : "light");
      return next;
    });
  };
  return (
    <EditorThemeContext.Provider value={{ theme, isDark, toggle }}>
      {children}
    </EditorThemeContext.Provider>
  );
}

export default function EditorPage() {
  return (
    <EditorThemeProvider>
      <EditorProvider>
        <EditorInner />
      </EditorProvider>
    </EditorThemeProvider>
  );
}
