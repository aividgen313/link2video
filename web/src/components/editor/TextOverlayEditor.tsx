"use client";
import { useState } from "react";
import { TextOverlay, useEditorContext } from "@/context/EditorContext";

const FONTS = [
  "Inter", "Arial", "Helvetica", "Georgia", "Times New Roman",
  "Courier New", "Verdana", "Impact", "Comic Sans MS", "Trebuchet MS",
  "Palatino", "Garamond", "Bookman", "Tahoma", "Lucida Console",
  "Roboto", "Open Sans", "Montserrat", "Playfair Display", "Oswald",
  "Bebas Neue", "Raleway", "Poppins", "Lato", "Source Code Pro",
];

const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "300", label: "Light" },
  { value: "normal", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "bold", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
] as const;

const ANIMATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "typewriter", label: "Typewriter" },
  { value: "scale-in", label: "Scale In" },
  { value: "bounce", label: "Bounce" },
  { value: "glow", label: "Glow" },
] as const;

// Collapsible section
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: "var(--editor-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-[11px] uppercase tracking-wider font-semibold transition-colors"
        style={{ color: "var(--editor-text-dim)" }}
      >
        {title}
        <span className="material-symbols-outlined text-[11px]">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && <div className="px-1 pb-2 space-y-2">{children}</div>}
    </div>
  );
}

// Shared small label
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] block mb-0.5" style={{ color: "var(--editor-text-dim)" }}>{children}</span>;
}

// Small number input
function NumInput({ value, onChange, min, max, step = 1, suffix = "" }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        min={min} max={max} step={step}
        className="w-14 rounded px-1.5 py-0.5 text-[11px] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ background: "var(--editor-panel-alt)", color: "var(--editor-text)", border: "1px solid var(--editor-border)", outline: "none" }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--editor-border-active)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--editor-border)"; }}
      />
      {suffix && <span className="text-[11px]" style={{ color: "var(--editor-text-dim)" }}>{suffix}</span>}
    </div>
  );
}

export default function TextOverlayEditor() {
  const { selectedScene, addOverlay, updateOverlay, removeOverlay } = useEditorContext();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!selectedScene) return null;

  const handleAdd = () => {
    const id = `overlay-${Date.now()}`;
    const overlay: TextOverlay = {
      id,
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
      letterSpacing: 0,
      lineHeight: 1.2,
      borderWidth: 0,
      borderColor: "#ffffff",
      borderStyle: "solid",
      borderRadius: 0,
      padding: 8,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowEnabled: false,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowX: 2,
      shadowY: 2,
      shadowBlur: 4,
      animation: "none",
    };
    addOverlay(selectedScene.id, overlay);
    setEditingId(id);
  };

  const u = (overlayId: string, updates: Partial<TextOverlay>) => {
    updateOverlay(selectedScene.id, overlayId, updates);
  };

  const presetPositions = {
    center: { x: 50, y: 50 },
    "lower-third": { x: 50, y: 85 },
    top: { x: 50, y: 12 },
  };

  const presetStyles = [
    { label: "Title", fontFamily: "Inter", fontSize: 36, fontWeight: "bold" as const, color: "#ffffff", backgroundColor: "", strokeWidth: 0, shadowEnabled: false },
    { label: "Subtitle", fontFamily: "Inter", fontSize: 20, fontWeight: "normal" as const, color: "#ffffff", backgroundColor: "rgba(0,0,0,0.5)", strokeWidth: 0, shadowEnabled: false },
    { label: "Caption", fontFamily: "Inter", fontSize: 16, fontWeight: "normal" as const, color: "#ffffff", backgroundColor: "rgba(0,0,0,0.7)", strokeWidth: 0, shadowEnabled: false },
    { label: "Neon", fontFamily: "Impact", fontSize: 42, fontWeight: "bold" as const, color: "#00ff88", backgroundColor: "", strokeWidth: 0, shadowEnabled: true, shadowColor: "#00ff88", shadowBlur: 20 },
    { label: "Outline", fontFamily: "Impact", fontSize: 36, fontWeight: "bold" as const, color: "#ffffff", backgroundColor: "", strokeWidth: 2, strokeColor: "#000000", shadowEnabled: false },
    { label: "Cinema", fontFamily: "Georgia", fontSize: 28, fontWeight: "normal" as const, color: "#f5e6c8", backgroundColor: "", strokeWidth: 0, shadowEnabled: true, shadowColor: "rgba(0,0,0,0.8)", shadowBlur: 6 },
    { label: "Bold Box", fontFamily: "Impact", fontSize: 32, fontWeight: "900" as const, color: "#ffffff", backgroundColor: "rgba(234,67,53,0.9)", strokeWidth: 0, shadowEnabled: false },
  ];

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--editor-text-dim)" }}>Text Overlays</span>
        <button
          onClick={handleAdd}
          className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-colors"
          style={{ color: "var(--editor-accent)" }}
        >
          <span className="material-symbols-outlined text-xs">add</span> Add Text
        </button>
      </div>

      {selectedScene.overlays.length === 0 && (
        <p className="text-[11px] italic text-center py-3" style={{ color: "var(--editor-text-dim)" }}>No text overlays — click Add Text to start</p>
      )}

      {selectedScene.overlays.map(overlay => (
        <div key={overlay.id} className="rounded-lg overflow-hidden" style={{ background: "var(--editor-panel-alt)", border: "1px solid var(--editor-border)" }}>
          {editingId === overlay.id ? (
            <div className="space-y-0">
              {/* ── Text Input ── */}
              <div className="p-2" style={{ borderBottom: "1px solid var(--editor-border)" }}>
                <textarea
                  value={overlay.text}
                  onChange={e => u(overlay.id, { text: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none resize-none"
                  style={{ background: "var(--editor-panel)", color: "var(--editor-text)", border: "1px solid var(--editor-border)" }}
                  placeholder="Enter text..."
                  autoFocus
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>

              {/* ── Quick Presets ── */}
              <Section title="Quick Styles" defaultOpen>
                <div className="flex flex-wrap gap-1">
                  {presetStyles.map(ps => (
                    <button
                      key={ps.label}
                      onClick={() => u(overlay.id, {
                        fontFamily: ps.fontFamily,
                        fontSize: ps.fontSize,
                        fontWeight: ps.fontWeight,
                        color: ps.color,
                        backgroundColor: ps.backgroundColor,
                        strokeWidth: ps.strokeWidth,
                        strokeColor: (ps as any).strokeColor,
                        shadowEnabled: ps.shadowEnabled,
                        shadowColor: (ps as any).shadowColor,
                        shadowBlur: (ps as any).shadowBlur,
                      })}
                      className="text-[11px] px-2 py-1 rounded transition-colors"
                      style={{ background: "var(--editor-surface-hover)", color: "var(--editor-text-dim)" }}
                    >
                      {ps.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Font ── */}
              <Section title="Font" defaultOpen>
                <div className="space-y-1.5">
                  {/* Font family */}
                  <div>
                    <Label>Family</Label>
                    <select
                      value={overlay.fontFamily || "Inter"}
                      onChange={e => u(overlay.id, { fontFamily: e.target.value })}
                      className="w-full editor-input rounded px-1.5 py-1 text-[11px] focus:outline-none"
                      style={{ fontFamily: overlay.fontFamily || "Inter" }}
                    >
                      {FONTS.map(f => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Weight + Size row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Weight</Label>
                      <select
                        value={overlay.fontWeight}
                        onChange={e => u(overlay.id, { fontWeight: e.target.value as any })}
                        className="w-full editor-input rounded px-1.5 py-1 text-[11px] focus:outline-none"
                      >
                        {FONT_WEIGHTS.map(w => (
                          <option key={w.value} value={w.value}>{w.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Size</Label>
                      <NumInput value={overlay.fontSize} onChange={v => u(overlay.id, { fontSize: v })} min={8} max={120} suffix="px" />
                    </div>
                  </div>

                  {/* Format buttons row */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Color */}
                    <input
                      type="color"
                      value={overlay.color}
                      onChange={e => u(overlay.id, { color: e.target.value })}
                      className="w-6 h-6 rounded border-0 cursor-pointer"
                      title="Text color"
                    />
                    {/* Italic */}
                    <button
                      onClick={() => u(overlay.id, { fontStyle: overlay.fontStyle === "italic" ? "normal" : "italic" })}
                      className={`text-[11px] w-6 h-6 rounded flex items-center justify-center italic transition-colors ${
                        overlay.fontStyle === "italic" ? "editor-btn-active" : "editor-btn-inactive"
                      }`}
                    >I</button>
                    {/* Underline */}
                    <button
                      onClick={() => u(overlay.id, { textDecoration: overlay.textDecoration === "underline" ? "none" : "underline" })}
                      className={`text-[11px] w-6 h-6 rounded flex items-center justify-center underline transition-colors ${
                        overlay.textDecoration === "underline" ? "editor-btn-active" : "editor-btn-inactive"
                      }`}
                    >U</button>
                    {/* Strikethrough */}
                    <button
                      onClick={() => u(overlay.id, { textDecoration: overlay.textDecoration === "line-through" ? "none" : "line-through" })}
                      className={`text-[11px] w-6 h-6 rounded flex items-center justify-center line-through transition-colors ${
                        overlay.textDecoration === "line-through" ? "editor-btn-active" : "editor-btn-inactive"
                      }`}
                    >S</button>
                    <div className="w-px h-4 mx-0.5" style={{ background: "var(--editor-border)" }} />
                    {/* Alignment */}
                    {(["left", "center", "right"] as const).map(align => (
                      <button
                        key={align}
                        onClick={() => u(overlay.id, { textAlign: align })}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          (overlay.textAlign || "center") === align ? "editor-btn-active" : "editor-btn-inactive"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {align === "left" ? "format_align_left" : align === "right" ? "format_align_right" : "format_align_center"}
                        </span>
                      </button>
                    ))}
                    <div className="w-px h-4 mx-0.5" style={{ background: "var(--editor-border)" }} />
                    {/* Transform */}
                    {([
                      { v: "uppercase" as const, l: "AA" },
                      { v: "capitalize" as const, l: "Aa" },
                      { v: "lowercase" as const, l: "aa" },
                    ]).map(t => (
                      <button
                        key={t.v}
                        onClick={() => u(overlay.id, { textTransform: overlay.textTransform === t.v ? "none" : t.v })}
                        className={`text-[11px] px-1 h-6 rounded flex items-center justify-center transition-colors ${
                          overlay.textTransform === t.v ? "editor-btn-active" : "editor-btn-inactive"
                        }`}
                      >{t.l}</button>
                    ))}
                  </div>

                  {/* Letter spacing + Line height */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Letter Spacing</Label>
                      <NumInput value={overlay.letterSpacing ?? 0} onChange={v => u(overlay.id, { letterSpacing: v })} min={-5} max={20} step={0.5} suffix="px" />
                    </div>
                    <div>
                      <Label>Line Height</Label>
                      <NumInput value={overlay.lineHeight ?? 1.2} onChange={v => u(overlay.id, { lineHeight: v })} min={0.5} max={3} step={0.1} suffix="x" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* ── Position ── */}
              <Section title="Position">
                <div className="flex gap-1 mb-2">
                  {(["center", "lower-third", "top"] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => u(overlay.id, { position: pos, ...presetPositions[pos] })}
                      className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                        overlay.position === pos ? "editor-btn-active" : "editor-btn-inactive hover:editor-btn-inactive"
                      }`}
                    >{pos}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X Position</Label>
                    <input type="range" min={0} max={100} value={overlay.x} onChange={e => u(overlay.id, { x: Number(e.target.value), position: "custom" })} className="w-full h-0.5" style={{ accentColor: "#4a9eed" }} />
                  </div>
                  <div>
                    <Label>Y Position</Label>
                    <input type="range" min={0} max={100} value={overlay.y} onChange={e => u(overlay.id, { y: Number(e.target.value), position: "custom" })} className="w-full h-0.5" style={{ accentColor: "#4a9eed" }} />
                  </div>
                </div>
                <div>
                  <Label>Opacity: {Math.round((overlay.opacity ?? 1) * 100)}%</Label>
                  <input type="range" min={5} max={100} value={Math.round((overlay.opacity ?? 1) * 100)} onChange={e => u(overlay.id, { opacity: Number(e.target.value) / 100 })} className="w-full h-0.5" style={{ accentColor: "#4a9eed" }} />
                </div>
              </Section>

              {/* ── Background ── */}
              <Section title="Background">
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => u(overlay.id, { backgroundColor: "" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${!overlay.backgroundColor ? "editor-btn-active" : "editor-btn-inactive"}`}>None</button>
                  <button onClick={() => u(overlay.id, { backgroundColor: "rgba(0,0,0,0.5)" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${overlay.backgroundColor === "rgba(0,0,0,0.5)" ? "editor-btn-active" : "editor-btn-inactive"}`}>50% Black</button>
                  <button onClick={() => u(overlay.id, { backgroundColor: "rgba(0,0,0,0.8)" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${overlay.backgroundColor === "rgba(0,0,0,0.8)" ? "editor-btn-active" : "editor-btn-inactive"}`}>80% Black</button>
                  <button onClick={() => u(overlay.id, { backgroundColor: "rgba(255,255,255,0.9)" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${overlay.backgroundColor === "rgba(255,255,255,0.9)" ? "editor-btn-active" : "editor-btn-inactive"}`}>White</button>
                  <button onClick={() => u(overlay.id, { backgroundColor: "rgba(234,67,53,0.85)" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${overlay.backgroundColor?.includes("234,67") ? "editor-btn-active" : "editor-btn-inactive"}`}>Red</button>
                  <button onClick={() => u(overlay.id, { backgroundColor: "rgba(74,158,237,0.85)" })} className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${overlay.backgroundColor?.includes("74,158") ? "editor-btn-active" : "editor-btn-inactive"}`}>Blue</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Label>Padding</Label>
                    <NumInput value={overlay.padding ?? 8} onChange={v => u(overlay.id, { padding: v })} min={0} max={40} suffix="px" />
                  </div>
                  <div>
                    <Label>Corner Radius</Label>
                    <NumInput value={overlay.borderRadius ?? 0} onChange={v => u(overlay.id, { borderRadius: v })} min={0} max={30} suffix="px" />
                  </div>
                </div>
              </Section>

              {/* ── Border ── */}
              <Section title="Border">
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Width</Label>
                      <NumInput value={overlay.borderWidth ?? 0} onChange={v => u(overlay.id, { borderWidth: v })} min={0} max={10} suffix="px" />
                    </div>
                    <div>
                      <Label>Style</Label>
                      <select
                        value={overlay.borderStyle ?? "solid"}
                        onChange={e => u(overlay.id, { borderStyle: e.target.value as any })}
                        className="w-full editor-input rounded px-1 py-0.5 text-[11px] focus:outline-none"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </div>
                    <div>
                      <Label>Color</Label>
                      <input type="color" value={overlay.borderColor ?? "#ffffff"} onChange={e => u(overlay.id, { borderColor: e.target.value })} className="w-full h-6 rounded border-0 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* ── Text Stroke / Outline ── */}
              <Section title="Text Outline">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Stroke Width</Label>
                    <NumInput value={overlay.strokeWidth ?? 0} onChange={v => u(overlay.id, { strokeWidth: v })} min={0} max={10} step={0.5} suffix="px" />
                  </div>
                  <div>
                    <Label>Stroke Color</Label>
                    <input type="color" value={overlay.strokeColor ?? "#000000"} onChange={e => u(overlay.id, { strokeColor: e.target.value })} className="w-full h-6 rounded border-0 cursor-pointer" />
                  </div>
                </div>
              </Section>

              {/* ── Shadow ── */}
              <Section title="Shadow">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlay.shadowEnabled ?? false}
                      onChange={e => u(overlay.id, { shadowEnabled: e.target.checked })}
                      className="rounded accent-primary"
                    />
                    <span className="text-[11px]" style={{ color: "var(--editor-text)" }}>Enable Shadow</span>
                  </label>
                  {overlay.shadowEnabled && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>X Offset</Label>
                          <NumInput value={overlay.shadowX ?? 2} onChange={v => u(overlay.id, { shadowX: v })} min={-20} max={20} suffix="px" />
                        </div>
                        <div>
                          <Label>Y Offset</Label>
                          <NumInput value={overlay.shadowY ?? 2} onChange={v => u(overlay.id, { shadowY: v })} min={-20} max={20} suffix="px" />
                        </div>
                        <div>
                          <Label>Blur</Label>
                          <NumInput value={overlay.shadowBlur ?? 4} onChange={v => u(overlay.id, { shadowBlur: v })} min={0} max={50} suffix="px" />
                        </div>
                      </div>
                      <div>
                        <Label>Shadow Color</Label>
                        <input type="color" value={overlay.shadowColor ?? "#000000"} onChange={e => u(overlay.id, { shadowColor: e.target.value })} className="w-8 h-6 rounded border-0 cursor-pointer" />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* ── Animation ── */}
              <Section title="Animation">
                <div className="flex flex-wrap gap-1">
                  {ANIMATION_OPTIONS.map(a => (
                    <button
                      key={a.value}
                      onClick={() => u(overlay.id, { animation: a.value })}
                      className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                        (overlay.animation || "none") === a.value ? "editor-btn-active" : "editor-btn-inactive"
                      }`}
                    >{a.label}</button>
                  ))}
                </div>
              </Section>

              {/* ── Preview + Done ── */}
              <div className="p-2" style={{ borderTop: "1px solid var(--editor-border)" }}>
                {/* Live preview */}
                <div className="mb-2 rounded-lg overflow-hidden relative" style={{ background: "#000", height: 60 }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      style={{
                        fontFamily: overlay.fontFamily || "Inter",
                        fontSize: Math.min(overlay.fontSize, 24),
                        fontWeight: overlay.fontWeight,
                        fontStyle: overlay.fontStyle,
                        color: overlay.color,
                        textDecoration: overlay.textDecoration || "none",
                        textTransform: (overlay.textTransform || "none") as any,
                        letterSpacing: overlay.letterSpacing ?? 0,
                        backgroundColor: overlay.backgroundColor || "transparent",
                        padding: `${Math.min(overlay.padding ?? 8, 6)}px`,
                        borderRadius: overlay.borderRadius ?? 0,
                        border: (overlay.borderWidth ?? 0) > 0 ? `${overlay.borderWidth}px ${overlay.borderStyle ?? "solid"} ${overlay.borderColor ?? "#fff"}` : "none",
                        WebkitTextStroke: (overlay.strokeWidth ?? 0) > 0 ? `${overlay.strokeWidth}px ${overlay.strokeColor ?? "#000"}` : undefined,
                        textShadow: overlay.shadowEnabled ? `${overlay.shadowX ?? 2}px ${overlay.shadowY ?? 2}px ${overlay.shadowBlur ?? 4}px ${overlay.shadowColor ?? "rgba(0,0,0,0.5)"}` : "none",
                        opacity: overlay.opacity ?? 1,
                      }}
                    >
                      {overlay.text || "Preview"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setEditingId(null)} className="text-[11px] text-primary hover:underline">Done</button>
                  <button onClick={() => { removeOverlay(selectedScene.id, overlay.id); setEditingId(null); }} className="text-[11px] text-red-400 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed view */
            <div className="flex items-center justify-between p-2">
              <button onClick={() => setEditingId(overlay.id)} className="text-[11px] truncate flex-1 text-left hover:text-primary flex items-center gap-1.5 transition-colors" style={{ color: "var(--editor-text)" }}>
                <span className="material-symbols-outlined text-[12px] text-on-surface-variant">text_fields</span>
                <span style={{ fontFamily: overlay.fontFamily || "Inter" }}>{overlay.text}</span>
                <span className="text-[11px] text-on-surface-variant ml-1">{overlay.fontFamily}</span>
              </button>
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={() => {
                  // Duplicate overlay
                  const dupe: TextOverlay = { ...overlay, id: `overlay-${Date.now()}` };
                  addOverlay(selectedScene.id, dupe);
                }} className="text-on-surface-variant hover:text-primary transition-colors" title="Duplicate">
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                </button>
                <button onClick={() => setEditingId(overlay.id)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-xs">edit</span>
                </button>
                <button onClick={() => removeOverlay(selectedScene.id, overlay.id)} className="text-on-surface-variant hover:text-red-400 transition-colors">
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
