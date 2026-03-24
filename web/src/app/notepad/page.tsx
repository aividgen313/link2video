"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, NotepadSource, NotepadSourceType } from "@/context/AppContext";

const SOURCE_ICONS: Record<NotepadSourceType, string> = {
  text: "description",
  url: "link",
  pdf: "picture_as_pdf",
  clipboard: "content_paste",
};

const SOURCE_LABELS: Record<NotepadSourceType, string> = {
  text: "Text",
  url: "URL",
  pdf: "PDF",
  clipboard: "Paste",
};

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function NotepadPage() {
  const router = useRouter();
  const {
    notepadData, setNotepadData,
    setMode, setStoryText, setAngle, setGenerateRequested,
    targetDurationMinutes, setTargetDurationMinutes,
  } = useAppContext();

  const [showAddSource, setShowAddSource] = useState(false);
  const [addMode, setAddMode] = useState<NotepadSourceType>("text");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<{
    suggestedTitle: string;
    suggestedAngle: string;
    themes: string[];
    coreThesis: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sources = notepadData.sources;
  const synthesis = notepadData.synthesizedKnowledge;
  const allExtracted = sources.length > 0 && sources.every(s => s.extractedFacts !== null);
  const hasSourcesWithFacts = sources.some(s => s.extractedFacts && s.extractedFacts.length > 0);

  // ── Add source ──
  const addSource = useCallback((type: NotepadSourceType, title: string, rawContent: string) => {
    const newSource: NotepadSource = {
      id: generateId(),
      type,
      title: title || `${type} source`,
      rawContent,
      extractedFacts: null,
      addedAt: Date.now(),
      preview: rawContent.substring(0, 200).replace(/\s+/g, " "),
    };
    setNotepadData(prev => ({ ...prev, sources: [...prev.sources, newSource], synthesizedKnowledge: null, lastSynthesizedAt: null }));
    setError(null);
    setShowAddSource(false);
    setTextTitle("");
    setTextContent("");
    setUrlInput("");
  }, [setNotepadData]);

  const removeSource = useCallback((id: string) => {
    setNotepadData(prev => ({
      ...prev,
      sources: prev.sources.filter(s => s.id !== id),
      synthesizedKnowledge: null,
      lastSynthesizedAt: null,
    }));
  }, [setNotepadData]);

  const handleAddText = () => {
    if (!textContent.trim()) return;
    addSource("text", textTitle.trim() || "Text Note", textContent.trim());
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    setError(null);
    try {
      const res = await fetch("/api/notepad/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addSource("url", data.title || urlInput.trim(), data.content);
    } catch (e: any) {
      setError(e.message || "Failed to fetch URL");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (text.trim().length < 10) {
      setError("Could not extract text from PDF. Try pasting the content instead.");
      return;
    }
    addSource("pdf", file.name, text.trim());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setError("Clipboard is empty"); return; }
      addSource("clipboard", "Pasted Content", text.trim());
    } catch {
      setError("Could not read clipboard. Please use the Text tab to paste content instead.");
    }
  };

  const handleExtract = async () => {
    const unextracted = sources.filter(s => s.extractedFacts === null);
    if (unextracted.length === 0) return;
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/notepad/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: unextracted.map(s => ({ id: s.id, title: s.title, rawContent: s.rawContent })),
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.extractions) {
        setNotepadData(prev => ({
          ...prev,
          sources: prev.sources.map(s => {
            const extraction = data.extractions.find((e: any) => e.sourceId === s.id);
            return extraction ? { ...s, extractedFacts: extraction.facts } : s;
          }),
        }));
      }
    } catch (e: any) {
      setError(e.message || "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSynthesize = async () => {
    if (!hasSourcesWithFacts) return;
    setIsSynthesizing(true);
    setError(null);
    try {
      const sourcesWithFacts = sources
        .filter(s => s.extractedFacts && s.extractedFacts.length > 0)
        .map(s => ({ title: s.title, facts: s.extractedFacts! }));
      const res = await fetch("/api/notepad/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: sourcesWithFacts, targetDurationMinutes }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNotepadData(prev => ({
        ...prev,
        synthesizedKnowledge: data.synthesis,
        lastSynthesizedAt: Date.now(),
      }));
      setSynthesisResult({
        suggestedTitle: data.suggestedTitle || "",
        suggestedAngle: data.suggestedAngle || "",
        themes: data.themes || [],
        coreThesis: data.coreThesis || "",
      });
    } catch (e: any) {
      setError(e.message || "Synthesis failed");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleGenerateVideo = () => {
    if (!synthesis) return;
    setMode("notepad");
    setStoryText(synthesis);
    setAngle(synthesisResult?.suggestedAngle || "Documentary Overview");
    setGenerateRequested(true);
    router.push("/script");
  };

  const totalFacts = sources.reduce((acc, s) => acc + (s.extractedFacts?.length || 0), 0);

  // ── Step state for progress tracker ──
  const step = synthesis ? 4 : hasSourcesWithFacts ? 3 : allExtracted ? 3 : sources.length > 0 ? 2 : 1;

  return (
    <div className="notepad-page flex flex-col flex-1 min-h-0" style={{ color: "var(--np-text)" }}>
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-lg flex items-start gap-3" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
          <span className="material-symbols-outlined text-red-500 text-lg mt-0.5">error</span>
          <p className="flex-1 text-sm" style={{ color: "#991B1B" }}>{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 px-1">

        {/* ═══════════════════════════════════════════════════════
            LEFT PANEL — Sources  (NotebookLM source sidebar)
            ═══════════════════════════════════════════════════════ */}
        <div className="lg:w-[280px] xl:w-[300px] flex-shrink-0 flex flex-col">
          <div className="np-card flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--np-divider-light)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[15px]" style={{ color: "var(--np-text)" }}>Sources</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--np-input-bg)", color: "var(--np-text-secondary)" }}>
                  {sources.length}
                </span>
              </div>
              <button
                onClick={() => setShowAddSource(!showAddSource)}
                className="np-btn-secondary w-full py-2.5 text-[13px] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">{showAddSource ? "close" : "add"}</span>
                {showAddSource ? "Cancel" : "Add source"}
              </button>
            </div>

            {/* Add Source Form (collapsible) */}
            {showAddSource && (
              <div className="p-3 space-y-3" style={{ borderBottom: "1px solid var(--np-divider-light)", background: "var(--np-bg)" }}>
                {/* Source type selector — no truncation */}
                <div className="grid grid-cols-4 gap-1 p-1 rounded-lg" style={{ background: "var(--np-card)" }}>
                  {(["text", "url", "pdf", "clipboard"] as NotepadSourceType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setAddMode(type)}
                      className="py-2 rounded-md text-[13px] font-semibold flex flex-col items-center gap-1 transition-all"
                      style={{
                        background: addMode === type ? "var(--np-blue)" : "transparent",
                        color: addMode === type ? "#fff" : "var(--np-text-secondary)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">{SOURCE_ICONS[type]}</span>
                      <span className="text-[11px] leading-none">{SOURCE_LABELS[type]}</span>
                    </button>
                  ))}
                </div>

                {addMode === "text" && (
                  <>
                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={textTitle}
                      onChange={e => setTextTitle(e.target.value)}
                      className="np-input w-full px-3 py-2.5 text-[13px] rounded-lg"
                    />
                    <textarea
                      placeholder="Paste or type your notes, research, facts..."
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      rows={4}
                      className="np-input w-full px-3 py-2.5 text-[13px] rounded-lg resize-none"
                    />
                    <button onClick={handleAddText} disabled={!textContent.trim()} className="np-btn-primary w-full py-2.5 text-[13px]">
                      Add text
                    </button>
                  </>
                )}
                {addMode === "url" && (
                  <>
                    <input
                      type="url"
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddUrl()}
                      className="np-input w-full px-3 py-2.5 text-[13px] rounded-lg"
                    />
                    <button onClick={handleAddUrl} disabled={!urlInput.trim() || isFetchingUrl} className="np-btn-primary w-full py-2.5 text-[13px] flex items-center justify-center gap-2">
                      {isFetchingUrl ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Fetching...</> : "Fetch & add"}
                    </button>
                    <p className="text-[11px] text-center" style={{ color: "var(--np-text-tertiary)" }}>Articles, Wikipedia, blogs, news</p>
                  </>
                )}
                {addMode === "pdf" && (
                  <>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[var(--np-blue)] transition-colors"
                      style={{ borderColor: "var(--np-divider)" }}
                    >
                      <span className="material-symbols-outlined text-2xl" style={{ color: "var(--np-text-tertiary)" }}>upload_file</span>
                      <p className="text-[13px] font-medium" style={{ color: "var(--np-text-secondary)" }}>Upload PDF or text file</p>
                      <p className="text-[11px]" style={{ color: "var(--np-text-tertiary)" }}>.pdf, .txt, .md</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" onChange={handlePdfUpload} className="hidden" />
                  </>
                )}
                {addMode === "clipboard" && (
                  <button onClick={handlePasteClipboard} className="np-btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">content_paste</span>
                    Paste from clipboard
                  </button>
                )}
              </div>
            )}

            {/* Source list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <span className="material-symbols-outlined text-4xl mb-3" style={{ color: "var(--np-divider)" }}>note_stack</span>
                  <p className="text-[13px] font-medium" style={{ color: "var(--np-text-secondary)" }}>No sources yet</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--np-text-tertiary)" }}>Add text, URLs, or files to build your knowledge base</p>
                </div>
              ) : (
                sources.map(source => (
                  <div
                    key={source.id}
                    className="rounded-lg p-2.5 group cursor-default transition-colors"
                    style={{ ["--hover-bg" as any]: "var(--np-card-hover)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--np-card-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--np-blue-light)" }}
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--np-blue)" }}>{SOURCE_ICONS[source.type]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[13px] truncate leading-tight" style={{ color: "var(--np-text)" }}>{source.title}</h4>
                        <p className="text-[11px] line-clamp-1 mt-0.5" style={{ color: "var(--np-text-tertiary)" }}>{source.preview}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {source.extractedFacts === null ? (
                            <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--np-text-tertiary)" }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--np-divider)" }} />Pending
                            </span>
                          ) : source.extractedFacts.length > 0 ? (
                            <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--np-green)" }}>
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>{source.extractedFacts.length} facts
                            </span>
                          ) : (
                            <span className="text-[10px]" style={{ color: "var(--np-text-tertiary)" }}>No facts</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeSource(source.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center transition-opacity"
                        style={{ color: "var(--np-text-tertiary)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#E41E3F")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--np-text-tertiary)")}
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Extract button at bottom */}
            {sources.length > 0 && (
              <div className="p-3" style={{ borderTop: "1px solid var(--np-divider-light)" }}>
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || allExtracted}
                  className={`w-full py-2.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors ${
                    allExtracted ? "" : "np-btn-secondary"
                  }`}
                  style={allExtracted ? { background: "var(--np-green-bg)", color: "var(--np-green)" } : undefined}
                >
                  {isExtracting ? (
                    <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" style={{ borderTopColor: "var(--np-blue)" }} />Extracting...</>
                  ) : allExtracted ? (
                    <><span className="material-symbols-outlined text-[16px]">check_circle</span>All extracted</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">psychology</span>Extract knowledge</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CENTER — Notes / Knowledge  (main content area)
            ═══════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="np-card flex-1 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--np-divider-light)" }}>
              <div>
                <h2 className="font-bold text-[17px]" style={{ color: "var(--np-text)" }}>
                  {synthesis ? (synthesisResult?.suggestedTitle || "Synthesis Complete") : "Notes"}
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--np-text-tertiary)" }}>
                  {sources.length === 0 ? "Add sources to get started" : synthesis ? "Knowledge synthesized — ready to generate" : hasSourcesWithFacts ? "Sources extracted — ready to synthesize" : `${sources.length} source${sources.length !== 1 ? "s" : ""} added`}
                </p>
              </div>
              {sources.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--np-text)" }}>{sources.length}</p>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--np-text-tertiary)" }}>Sources</p>
                  </div>
                  <div className="w-px h-7" style={{ background: "var(--np-divider-light)" }} />
                  <div className="text-center">
                    <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--np-blue)" }}>{totalFacts}</p>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--np-text-tertiary)" }}>Facts</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {sources.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "var(--np-blue-light)" }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: "var(--np-blue)" }}>auto_stories</span>
                  </div>
                  <h3 className="font-bold text-xl mb-2" style={{ color: "var(--np-text)" }}>Build Your Knowledge Base</h3>
                  <p className="text-[14px] leading-relaxed mb-8" style={{ color: "var(--np-text-secondary)" }}>
                    Add sources from text, URLs, PDFs, or your clipboard. The AI will extract key facts, synthesize them into unified knowledge, and generate a documentary video.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                    {([
                      { type: "text" as const, icon: "description", label: "Add Text", desc: "Notes, research, facts" },
                      { type: "url" as const, icon: "link", label: "Add URL", desc: "Articles, wikis, blogs" },
                      { type: "pdf" as const, icon: "picture_as_pdf", label: "Upload File", desc: "PDF, TXT, Markdown" },
                      { type: "clipboard" as const, icon: "content_paste", label: "Paste", desc: "From clipboard" },
                    ]).map(item => (
                      <button
                        key={item.type}
                        onClick={() => { setShowAddSource(true); setAddMode(item.type); }}
                        className="p-4 rounded-lg text-left transition-all"
                        style={{ border: "1px solid var(--np-divider-light)" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--np-blue)"; e.currentTarget.style.background = "var(--np-blue-light)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--np-divider-light)"; e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="material-symbols-outlined text-xl mb-2 block" style={{ color: "var(--np-blue)" }}>{item.icon}</span>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--np-text)" }}>{item.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--np-text-tertiary)" }}>{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !synthesis ? (
                /* Sources added but not yet synthesized */
                <div className="space-y-4">
                  {hasSourcesWithFacts && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--np-blue)" }}>checklist</span>
                      <h3 className="font-semibold text-[14px]" style={{ color: "var(--np-text)" }}>Extracted Knowledge</h3>
                      <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>{totalFacts} facts from {sources.filter(s => s.extractedFacts && s.extractedFacts.length > 0).length} sources</span>
                    </div>
                  )}
                  {sources.map(source => (
                    source.extractedFacts && source.extractedFacts.length > 0 ? (
                      <div key={source.id} className="rounded-lg p-4" style={{ border: "1px solid var(--np-divider-light)" }}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "var(--np-blue-light)" }}>
                            <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-blue)" }}>{SOURCE_ICONS[source.type]}</span>
                          </div>
                          <h4 className="font-semibold text-[13px]" style={{ color: "var(--np-text)" }}>{source.title}</h4>
                          <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>{source.extractedFacts.length} facts</span>
                        </div>
                        <ul className="space-y-1.5">
                          {source.extractedFacts.map((fact, i) => (
                            <li key={i} className="text-[13px] leading-relaxed pl-4 relative" style={{ color: "var(--np-text-secondary)" }}>
                              <span className="absolute left-0 top-[8px] w-2 h-2 rounded-full" style={{ background: "var(--np-blue)", opacity: 0.3 }} />
                              {fact}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : source.extractedFacts === null ? (
                      <div key={source.id} className="rounded-lg p-4 opacity-50" style={{ border: "1px solid var(--np-divider-light)" }}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-text-tertiary)" }}>{SOURCE_ICONS[source.type]}</span>
                          <h4 className="font-semibold text-[13px]" style={{ color: "var(--np-text-secondary)" }}>{source.title}</h4>
                          <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>Pending extraction</span>
                        </div>
                      </div>
                    ) : null
                  ))}
                  {!allExtracted && sources.length > 0 && (
                    <div className="text-center py-6">
                      <p className="text-[13px]" style={{ color: "var(--np-text-secondary)" }}>Click <strong>Extract knowledge</strong> in the sources panel to analyze your sources.</p>
                    </div>
                  )}
                  {hasSourcesWithFacts && !synthesis && (
                    <div className="text-center py-6 mt-4" style={{ borderTop: "1px solid var(--np-divider-light)" }}>
                      <p className="text-[13px]" style={{ color: "var(--np-text-secondary)" }}>Ready to synthesize. Click <strong>Synthesize</strong> in the Studio panel.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Synthesis complete */
                <div className="space-y-5">
                  {synthesisResult?.coreThesis && (
                    <div className="rounded-lg p-4" style={{ background: "var(--np-blue-light)", border: "1px solid var(--np-blue)", borderColor: "color-mix(in srgb, var(--np-blue) 20%, transparent)" }}>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--np-blue)" }}>Core Thesis</span>
                      <p className="text-[14px] leading-relaxed" style={{ color: "var(--np-text)" }}>{synthesisResult.coreThesis}</p>
                    </div>
                  )}
                  {synthesisResult && synthesisResult.themes.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: "var(--np-text-tertiary)" }}>Themes</span>
                      <div className="flex flex-wrap gap-2">
                        {synthesisResult.themes.map((t, i) => (
                          <span
                            key={i}
                            className="text-[12px] px-3 py-1.5 rounded-full font-medium"
                            style={{ background: "var(--np-blue-light)", color: "var(--np-blue)" }}
                          >{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: "var(--np-text-tertiary)" }}>Knowledge Synthesis</span>
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--np-text-secondary)" }}>{synthesis}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT PANEL — Studio  (NotebookLM studio panel)
            ═══════════════════════════════════════════════════════ */}
        <div className="lg:w-[260px] xl:w-[280px] flex-shrink-0">
          <div className="np-card p-4 space-y-4">
            {/* Studio header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--np-blue-light)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--np-blue)", fontVariationSettings: "'FILL' 1" }}>movie</span>
              </div>
              <h3 className="font-bold text-[15px]" style={{ color: "var(--np-text)" }}>Studio</h3>
            </div>

            {/* Duration selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--np-text-tertiary)" }}>Video Length</label>
              <div className="flex gap-1.5">
                {[1, 3, 5, 10, 15].map(min => (
                  <button
                    key={min}
                    onClick={() => setTargetDurationMinutes(min)}
                    className="flex-1 py-2 rounded-md text-[13px] font-semibold transition-all"
                    style={{
                      background: targetDurationMinutes === min ? "var(--np-blue)" : "var(--np-input-bg)",
                      color: targetDurationMinutes === min ? "#fff" : "var(--np-text-secondary)",
                    }}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px" style={{ background: "var(--np-divider-light)" }} />

            {/* Progress steps */}
            <div className="space-y-1">
              {[
                { n: 1, label: "Add Sources", sub: sources.length > 0 ? `${sources.length} added` : "Text, URLs, files", done: sources.length > 0 },
                { n: 2, label: "Extract Knowledge", sub: allExtracted ? `${totalFacts} facts` : "AI analyzes sources", done: allExtracted },
                { n: 3, label: "Synthesize", sub: synthesis ? "Complete" : "Combine all knowledge", done: !!synthesis },
                { n: 4, label: "Generate Video", sub: "Create script & media", done: false },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-3 py-1.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{
                      background: s.done ? "var(--np-green)" : step >= s.n ? "var(--np-blue)" : "var(--np-input-bg)",
                      color: s.done || step >= s.n ? "#fff" : "var(--np-text-tertiary)",
                    }}
                  >
                    {s.done ? <span className="material-symbols-outlined text-[16px]">check</span> : s.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--np-text)" }}>{s.label}</p>
                    <p className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--np-text-tertiary)" }}>{s.sub}</p>
                  </div>
                  {i < 3 && s.done && (
                    <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-green)" }}>check_circle</span>
                  )}
                </div>
              ))}
            </div>

            <div className="w-full h-px" style={{ background: "var(--np-divider-light)" }} />

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing || !hasSourcesWithFacts}
                className="np-btn-secondary w-full py-2.5 text-[13px] flex items-center justify-center gap-2"
              >
                {isSynthesizing ? (
                  <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />Synthesizing...</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">merge</span>Synthesize</>
                )}
              </button>
              <button
                onClick={handleGenerateVideo}
                disabled={!synthesis}
                className="np-btn-primary w-full py-3 text-[14px] flex items-center justify-center gap-2 shadow-lg"
                style={{ boxShadow: synthesis ? "0 4px 14px rgba(24, 119, 242, 0.3)" : "none" }}
              >
                <span className="material-symbols-outlined text-[20px]">movie</span>
                Generate Video
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
