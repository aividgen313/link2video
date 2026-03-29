"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, NotepadSource, NotepadSourceType, NotepadImage, QUALITY_TIERS, calculateTotalCost } from "@/context/AppContext";
import type { QualityTier } from "@/context/AppContext";

type ProjectIndexEntry = { slug: string; name: string; savedAt: number; sourceCount: number; hasSynthesis: boolean };

const VISUAL_STYLES: { value: string; label: string; icon: string; category: string }[] = [
  // Cinematic
  { value: "Cinematic Documentary", label: "Cinematic Documentary", icon: "movie", category: "Cinematic" },
  { value: "Photorealistic", label: "Photorealistic", icon: "photo_camera", category: "Cinematic" },
  { value: "Film Noir", label: "Film Noir", icon: "contrast", category: "Cinematic" },
  { value: "Golden Hour Cinema", label: "Golden Hour", icon: "wb_twilight", category: "Cinematic" },
  { value: "Neon Noir", label: "Neon Noir", icon: "nightlight", category: "Cinematic" },
  { value: "Christopher Nolan", label: "Nolan Epic", icon: "theaters", category: "Cinematic" },
  { value: "IMAX Documentary", label: "IMAX", icon: "panorama_wide_angle", category: "Cinematic" },
  { value: "Drone Footage", label: "Drone", icon: "flight", category: "Cinematic" },
  // Retro
  { value: "70s Retro Film", label: "70s Retro", icon: "filter_vintage", category: "Retro" },
  { value: "80s VHS Aesthetic", label: "80s VHS", icon: "video_library", category: "Retro" },
  { value: "90s Camcorder", label: "90s Camcorder", icon: "videocam", category: "Retro" },
  { value: "Polaroid Vintage", label: "Polaroid", icon: "photo", category: "Retro" },
  // Animation
  { value: "Animated Storytime", label: "Animated", icon: "animation", category: "Animation" },
  { value: "3D Render", label: "3D Pixar", icon: "view_in_ar", category: "Animation" },
  { value: "Anime", label: "Anime", icon: "face", category: "Animation" },
  // Art
  { value: "Oil Painting", label: "Oil Painting", icon: "brush", category: "Art" },
  { value: "Watercolor", label: "Watercolor", icon: "water_drop", category: "Art" },
  { value: "Pop Art", label: "Pop Art", icon: "palette", category: "Art" },
  // Photography
  { value: "Street Photography", label: "Street Photo", icon: "location_city", category: "Photography" },
  { value: "Portrait Photography", label: "Portrait", icon: "person", category: "Photography" },
  { value: "Black and White", label: "B&W", icon: "monochrome_photos", category: "Photography" },
  // Genre
  { value: "Dark Fantasy", label: "Dark Fantasy", icon: "castle", category: "Genre" },
  { value: "Blade Runner Cyberpunk", label: "Cyberpunk", icon: "electric_bolt", category: "Genre" },
  { value: "Wes Anderson", label: "Wes Anderson", icon: "grid_view", category: "Genre" },
];

type AddMode = NotepadSourceType | "search" | "images";

const SOURCE_ICONS: Record<AddMode, string> = {
  text: "description",
  url: "link",
  pdf: "picture_as_pdf",
  clipboard: "content_paste",
  search: "travel_explore",
  images: "image_search",
};

const SOURCE_LABELS: Record<AddMode, string> = {
  text: "Text",
  url: "URL",
  pdf: "PDF",
  clipboard: "Paste",
  search: "Search",
  images: "Images",
};

type SearchResult = { title: string; url: string; snippet: string; type?: string };
type ImageResult = { title: string; url: string; thumbnail: string; source: string; width: number; height: number };

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function NotepadPage() {
  const router = useRouter();
  const {
    notepadData, setNotepadData,
    setMode, setStoryText, setAngle, setGenerateRequested,
    targetDurationMinutes, setTargetDurationMinutes,
    setScriptData, setSceneAudioUrls, setSceneVideoUrls,
    setStoryboardImages, setSceneDurations, setFinalVideoUrl,
    setReferenceImages, setYoutubeStyleSuffix, setCharacterProfiles,
    setSettingText, setActiveStyle, setUrl,
    qualityTier, setQualityTier,
    globalVisualStyle, setGlobalVisualStyle,
    extractProgress,
    synthesizeProgress,
    startCombinedExtractionAndSynthesis,
  } = useAppContext();

  const [showAddSource, setShowAddSource] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("text");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  // isExtracting and isSynthesizing are derived from global context running state
  const isExtracting = extractProgress.state === "running";
  // isSynthesizing is derived from global context state
  const isSynthesizing = synthesizeProgress.state === "running";
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingResultUrl, setAddingResultUrl] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [isAddingSelected, setIsAddingSelected] = useState(false);
  const [addingProgress, setAddingProgress] = useState({ done: 0, total: 0 });
  const [isConfirmingAnalysis, setIsConfirmingAnalysis] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Image search state
  const [imageQuery, setImageQuery] = useState("");
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [imagePage, setImagePage] = useState(1);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const [isLoadingMoreImages, setIsLoadingMoreImages] = useState(false);
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Projects list state
  const [showProjectsList, setShowProjectsList] = useState(true);
  const [projectsIndex, setProjectsIndex] = useState<ProjectIndexEntry[]>([]);

  // Load projects index on mount — also scan for legacy notepad_* keys not in the index
  useEffect(() => {
    try {
      let index: ProjectIndexEntry[] = [];
      const raw = localStorage.getItem("notepad_projects_index");
      if (raw) index = JSON.parse(raw);

      // Scan localStorage for any notepad_* keys not already in index
      const indexSlugs = new Set(index.map(p => p.slug));
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("notepad_") && key !== "notepad_projects_index") {
          const slug = key.replace("notepad_", "");
          if (!indexSlugs.has(slug)) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || "{}");
              index.push({
                slug,
                name: data.projectName || slug.replace(/-/g, " "),
                savedAt: data.savedAt || data.lastSynthesizedAt || Date.now(),
                sourceCount: data.sources?.length || 0,
                hasSynthesis: !!data.synthesizedKnowledge,
              });
            } catch { /* skip corrupted entries */ }
          }
        }
      }

      // Also check the current notepadData from context (loaded from link2video_state)
      // This handles the case where a project is in AppContext but never explicitly saved
      if (notepadData.projectName && notepadData.sources.length > 0) {
        const contextSlug = notepadData.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
        if (!index.some(p => p.slug === contextSlug)) {
          index.push({
            slug: contextSlug,
            name: notepadData.projectName,
            savedAt: notepadData.lastSynthesizedAt || Date.now(),
            sourceCount: notepadData.sources.length,
            hasSynthesis: !!notepadData.synthesizedKnowledge,
          });
          // Save it to localStorage so it persists
          try {
            localStorage.setItem(`notepad_${contextSlug}`, JSON.stringify({
              ...notepadData,
              sources: notepadData.sources.map(s => ({ ...s, rawContent: s.rawContent.substring(0, 10000) })),
              savedAt: Date.now(),
            }));
          } catch { /* quota */ }
        }
      }

      // Sort by most recent first
      index.sort((a, b) => b.savedAt - a.savedAt);
      setProjectsIndex(index);
      localStorage.setItem("notepad_projects_index", JSON.stringify(index));
    } catch { /* ignore */ }
  }, []);

  const handleLoadProject = (entry: ProjectIndexEntry) => {
    try {
      const raw = localStorage.getItem(`notepad_${entry.slug}`);
      if (raw) {
        const data = JSON.parse(raw);
        setNotepadData(data);
        // Restore synthesisResult if it was saved, otherwise null
        if (data.synthesizedKnowledge) {
          // Metadata is now part of notepadData, no separate state needed
        } else {
          // No synthesis
        }
        setShowProjectsList(false);
      }
    } catch { /* ignore */ }
  };

  const handleNewProject = () => {
    setNotepadData({ projectName: "", sources: [], images: [], synthesizedKnowledge: null, lastSynthesizedAt: null });
    setShowProjectsList(false);
  };

  const handleDeleteProject = (slug: string) => {
    try {
      localStorage.removeItem(`notepad_${slug}`);
      const updated = projectsIndex.filter(p => p.slug !== slug);
      setProjectsIndex(updated);
      localStorage.setItem("notepad_projects_index", JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  const sources = notepadData.sources;
  const synthesis = notepadData.synthesizedKnowledge;
  const allExtracted = sources.length > 0 && sources.every(s => s.extractedFacts !== null);
  const hasSourcesWithFacts = sources.some(s => s.extractedFacts && s.extractedFacts.length > 0);

  // ── Add source ──
  const addSource = useCallback((type: NotepadSourceType, title: string, rawContent: string, sourceUrl?: string) => {
    const newSource: NotepadSource = {
      id: generateId(),
      type,
      title: title || `${type} source`,
      rawContent,
      extractedFacts: null,
      addedAt: Date.now(),
      preview: rawContent.substring(0, 200).replace(/\s+/g, " "),
      sourceUrl,
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
      addSource("url", data.title || urlInput.trim(), data.content, urlInput.trim());
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

  const handleSearch = async (newSearch = true) => {
    if (!searchQuery.trim() || isSearching) return;
    const page = newSearch ? 1 : searchPage + 1;
    if (newSearch) {
      setIsSearching(true);
      setSearchResults([]);
      setSelectedResults(new Set());
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/notepad/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), page }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newResults = data.results || [];
      setSearchResults(prev => newSearch ? newResults : [...prev, ...newResults]);
      setSearchPage(page);
      setHasMoreResults(data.hasMore || false);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  const toggleResultSelected = (url: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedResults.size === searchResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(searchResults.map(r => r.url)));
    }
  };

  const handleAddSearchResult = async (result: SearchResult) => {
    setAddingResultUrl(result.url);
    setError(null);
    try {
      const res = await fetch("/api/notepad/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addSource("url", data.title || result.title, data.content, result.url);
      setSearchResults(prev => prev.filter(r => r.url !== result.url));
      setSelectedResults(prev => { const next = new Set(prev); next.delete(result.url); return next; });
    } catch (e: any) {
      setError(e.message || "Failed to fetch page content");
    } finally {
      setAddingResultUrl(null);
    }
  };

  const handleAddSelected = async () => {
    const toAdd = searchResults.filter(r => selectedResults.has(r.url));
    if (toAdd.length === 0) return;
    setIsAddingSelected(true);
    setAddingProgress({ done: 0, total: toAdd.length });
    setError(null);
    const added: string[] = [];
    for (const result of toAdd) {
      setAddingResultUrl(result.url);
      try {
        const res = await fetch("/api/notepad/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.url }),
        });
        const data = await res.json();
        if (!data.error) {
          addSource("url", data.title || result.title, data.content, result.url);
          added.push(result.url);
        }
      } catch { /* skip failed ones */ }
      setAddingProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    setSearchResults(prev => prev.filter(r => !added.includes(r.url)));
    setSelectedResults(new Set());
    setAddingResultUrl(null);
    setIsAddingSelected(false);
  };

  // ── Image search ──
  const handleImageSearch = async (newSearch = true) => {
    if (!imageQuery.trim() || isImageSearching) return;
    const page = newSearch ? 1 : imagePage + 1;
    if (newSearch) {
      setIsImageSearching(true);
      setImageResults([]);
      setSelectedImages(new Set());
    } else {
      setIsLoadingMoreImages(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/notepad/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: imageQuery.trim(), page }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImageResults(prev => newSearch ? (data.results || []) : [...prev, ...(data.results || [])]);
      setImagePage(page);
      setHasMoreImages(data.hasMore || false);
    } catch (e: any) {
      setError(e.message || "Image search failed");
    } finally {
      setIsImageSearching(false);
      setIsLoadingMoreImages(false);
    }
  };

  const toggleImageSelected = (url: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const handleAddSelectedImages = () => {
    const toAdd = imageResults.filter(r => selectedImages.has(r.url));
    if (toAdd.length === 0) return;
    const newImages: NotepadImage[] = toAdd.map(img => ({
      id: generateId(),
      url: img.url,
      thumbnail: img.thumbnail,
      title: img.title || "Image",
      source: img.source,
      width: img.width,
      height: img.height,
      addedAt: Date.now(),
    }));
    setNotepadData(prev => ({ ...prev, images: [...(prev.images || []), ...newImages] }));
    setImageResults(prev => prev.filter(r => !selectedImages.has(r.url)));
    setSelectedImages(new Set());
  };

  const removeImage = (id: string) => {
    setNotepadData(prev => ({ ...prev, images: (prev.images || []).filter(img => img.id !== id) }));
  };

  // ── Save notepad to cloud (organized folders) ──
  const handleSaveNotepad = async () => {
    const name = notepadData.projectName.trim() || "Untitled Project";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
    const basePath = `notepads/${slug}`;
    setIsSaving(true);
    setSaveStatus("idle");
    setSaveProgress(5);
    try {
      // Organize sources by type
      const links: { title: string; url: string; snippet: string }[] = [];
      const textNotes: { title: string; content: string }[] = [];
      const pdfs: { title: string; content: string }[] = [];

      for (const s of notepadData.sources) {
        if (s.type === "url") {
          links.push({ title: s.title, url: s.rawContent.split("\n")[0] || s.title, snippet: s.preview });
        } else if (s.type === "pdf") {
          pdfs.push({ title: s.title, content: s.rawContent.substring(0, 10000) });
        } else {
          textNotes.push({ title: s.title, content: s.rawContent.substring(0, 10000) });
        }
      }

      // Helper to upload JSON to cloud (falls back to localStorage)
      let cloudAvailable = true;
      const uploadJson = async (json: any, path: string) => {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json, path }),
        });
        const data = await res.json();
        if (data.local || !data.success) cloudAvailable = false;
        return data;
      };

      // Save project manifest
      const manifest = {
        name,
        slug,
        createdAt: Date.now(),
        sourceCount: notepadData.sources.length,
        imageCount: notepadData.images.length,
        hasSynthesis: !!notepadData.synthesizedKnowledge,
        folders: ["links", "images", "notes", "pdfs"],
      };
      await uploadJson(manifest, `${basePath}/project.json`);
      setSaveProgress(30);

      // Save organized assets in parallel
      const uploads: Promise<any>[] = [];
      if (links.length > 0) uploads.push(uploadJson(links, `${basePath}/links/links.json`));
      if (notepadData.images.length > 0) uploads.push(uploadJson(notepadData.images, `${basePath}/images/images.json`));
      if (textNotes.length > 0) uploads.push(uploadJson(textNotes, `${basePath}/notes/notes.json`));
      if (pdfs.length > 0) uploads.push(uploadJson(pdfs, `${basePath}/pdfs/pdfs.json`));
      if (notepadData.synthesizedKnowledge) {
        uploads.push(uploadJson(
          { synthesis: notepadData.synthesizedKnowledge, generatedAt: notepadData.lastSynthesizedAt },
          `${basePath}/synthesis.json`,
        ));
      }
      // Full state for restore
      uploads.push(uploadJson(
        {
          ...notepadData,
          sources: notepadData.sources.map(s => ({ ...s, rawContent: s.rawContent.substring(0, 10000) })),
          savedAt: Date.now(),
        },
        `${basePath}/state.json`,
      ));
      await Promise.all(uploads);
      setSaveProgress(80);

      // Always save to localStorage as backup
      const savedAt = Date.now();
      try {
        localStorage.setItem(`notepad_${slug}`, JSON.stringify({
          ...notepadData,
          sources: notepadData.sources.map(s => ({ ...s, rawContent: s.rawContent.substring(0, 10000) })),
          savedAt,
        }));
      } catch { /* quota exceeded — cloud is primary */ }

      // Maintain projects index in localStorage
      try {
        const indexEntry: ProjectIndexEntry = {
          slug,
          name,
          savedAt,
          sourceCount: notepadData.sources.length,
          hasSynthesis: !!notepadData.synthesizedKnowledge,
        };
        let index: ProjectIndexEntry[] = [];
        try {
          const raw = localStorage.getItem("notepad_projects_index");
          if (raw) index = JSON.parse(raw);
        } catch { /* ignore */ }
        index = index.filter(p => p.slug !== slug);
        index.unshift(indexEntry);
        localStorage.setItem("notepad_projects_index", JSON.stringify(index));
        setProjectsIndex(index);
      } catch { /* ignore */ }

      setSaveProgress(100);
      setSaveStatus("saved");
      setTimeout(() => { setSaveStatus("idle"); setSaveProgress(0); }, 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => { setSaveStatus("idle"); setSaveProgress(0); }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Progress state for all operations
  const [saveProgress, setSaveProgress] = useState(0); // 0-100

  // ── Combined action: delegate to global background task in AppContext ─────────
  const handleCombinedAction = useCallback(async () => {
    if (isExtracting || isSynthesizing) return;
    
    // If not already synthesized, and not yet confirming, show confirmation
    if (!notepadData.synthesizedKnowledge && !isConfirmingAnalysis) {
      setIsConfirmingAnalysis(true);
      return;
    }

    setIsConfirmingAnalysis(false);
    await startCombinedExtractionAndSynthesis(targetDurationMinutes);
  }, [isExtracting, isSynthesizing, isConfirmingAnalysis, notepadData.synthesizedKnowledge, startCombinedExtractionAndSynthesis, targetDurationMinutes]);

  const handleGenerateVideo = useCallback(async () => {
    if (!synthesis) return;

    // Clear all previous project state to avoid "opening old project" issues
    setScriptData(null);
    setSceneAudioUrls({});
    setSceneVideoUrls({});
    setStoryboardImages({});
    setSceneDurations({});
    setFinalVideoUrl(null);
    setReferenceImages({});
    setYoutubeStyleSuffix("");
    setCharacterProfiles([]);
    setSettingText("");
    setActiveStyle(null);
    setUrl(""); // Clear stale URL/topic from previous projects

    setMode("notepad");
    setStoryText(synthesis);
    setAngle(notepadData.suggestedTitle || notepadData.suggestedAngle || "Documentary Overview");
    setGenerateRequested(true);
    router.push("/script");
  }, [synthesis, notepadData.suggestedTitle, notepadData.suggestedAngle, setMode, setStoryText, setAngle, setGenerateRequested, setScriptData, setSceneAudioUrls, setSceneVideoUrls, setStoryboardImages, setSceneDurations, setFinalVideoUrl, setReferenceImages, setYoutubeStyleSuffix, setCharacterProfiles, setSettingText, setActiveStyle, setUrl, router]);

  const totalFacts = sources.reduce((acc, s) => acc + (s.extractedFacts?.length || 0), 0);

  // ── Step state for progress tracker ──
  const step = synthesis ? 4 : hasSourcesWithFacts ? 3 : allExtracted ? 3 : sources.length > 0 ? 2 : 1;

  const images = notepadData.images || [];

  // ── Projects list view ──
  if (showProjectsList) {
    return (
      <div className="notepad-page flex flex-col flex-1 min-h-0 p-6" style={{ color: "var(--np-text)" }}>
        <div className="max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: "var(--np-text)" }}>Notepad Projects</h2>
            <button
              onClick={handleNewProject}
              className="np-btn-primary px-5 py-2.5 text-[13px] font-semibold rounded-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Project
            </button>
          </div>
          {projectsIndex.length === 0 ? (
            <div className="np-card p-10 text-center border-dashed border-2 border-outline-variant/30 bg-surface-container-low/20">
              <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-6 shadow-inner animate-fade-in-up">
                <span className="material-symbols-outlined text-[40px] text-outline/40" style={{ fontVariationSettings: "'FILL' 1" }}>note_stack</span>
              </div>
              <h3 className="text-lg font-bold mb-2 text-on-surface">No Research Projects Yet</h3>
              <p className="text-[14px] mb-6 text-outline font-medium max-w-sm mx-auto leading-relaxed">
                Notepad projects are specifically for deep research and synthesis. Looking for your video generation history? Check the <strong>Home</strong> sidebar.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={handleNewProject} className="np-btn-primary px-8 py-3 text-[14px] font-bold rounded-2xl inline-flex items-center gap-2 shadow-lg hover:translate-y-[-2px] transition-all">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Start New Research
                </button>
                <button onClick={() => router.push("/")} className="np-btn-secondary px-8 py-3 text-[14px] font-bold rounded-2xl inline-flex items-center gap-2 shadow-sm border border-outline-variant/10">
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {projectsIndex.map(entry => (
                <div
                  key={entry.slug}
                  className="np-card p-4 flex items-center gap-4 cursor-pointer hover:ring-1 transition-all"
                  style={{ ["--tw-ring-color" as string]: "var(--np-blue)" }}
                  onClick={() => handleLoadProject(entry)}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: entry.hasSynthesis
                        ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                        : "linear-gradient(135deg, #6b7280, #9ca3af)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ color: "#fff" }}>
                      {entry.hasSynthesis ? "auto_stories" : "note_stack"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold truncate" style={{ color: "var(--np-text)" }}>{entry.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: "var(--np-text-tertiary)" }}>
                        {entry.sourceCount} source{entry.sourceCount !== 1 ? "s" : ""}
                      </span>
                      {entry.hasSynthesis && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
                          Ready to Generate
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--np-text-tertiary)" }}>
                        {new Date(entry.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(entry.slug); }}
                    className="p-1.5 rounded-md hover:bg-red-50 transition-colors flex-shrink-0"
                    title="Delete project"
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--np-text-tertiary)" }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const estimatedScenes = Math.ceil(targetDurationMinutes * 60 / 5);

  return (
    <div className="notepad-page flex flex-col flex-1 h-[calc(100vh-140px)] min-h-0 overflow-hidden" style={{ color: "var(--np-text)" }}>
      {/* Project name + Save bar */}
      <div className="px-4 pt-3 pb-2 flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3">
        <button
          onClick={() => setShowProjectsList(true)}
          className="np-btn-secondary px-3 py-2.5 text-[13px] rounded-lg flex items-center gap-1.5 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Projects
        </button>
        <input
          type="text"
          placeholder="Name your project..."
          value={notepadData.projectName || ""}
          onChange={e => setNotepadData(prev => ({ ...prev, projectName: e.target.value }))}
          className="np-input flex-1 px-4 py-2.5 text-[15px] font-semibold rounded-lg"
          style={{ maxWidth: 400 }}
        />
        <div className="flex items-center gap-2">
          {isSaving && saveProgress > 0 && (
            <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "var(--np-input-bg)" }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${saveProgress}%`, background: "#fff" }}
              />
            </div>
          )}
          <button
            onClick={handleSaveNotepad}
            disabled={isSaving}
            className="np-btn-primary px-5 py-2.5 text-[13px] font-semibold rounded-lg flex items-center gap-2"
          >
            {isSaving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving {saveProgress}%</>
            ) : saveStatus === "saved" ? (
              <><span className="material-symbols-outlined text-[18px]">check_circle</span>Saved</>
            ) : saveStatus === "error" ? (
              <><span className="material-symbols-outlined text-[18px]">error</span>Failed</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">save</span>Save Project</>
            )}
          </button>
        </div>
        {images.length > 0 && (
          <span className="text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--np-blue-light)", color: "var(--np-blue)" }}>
            {images.length} image{images.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

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
                {/* Source type selector — 3x2 grid for breathing room */}
                <div className="grid grid-cols-3 gap-1 p-1.5 rounded-lg" style={{ background: "var(--np-card)" }}>
                  {(["search", "images", "text", "url", "pdf", "clipboard"] as AddMode[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setAddMode(type)}
                      className="py-2 px-1 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: addMode === type ? "var(--np-blue)" : "transparent",
                        color: addMode === type ? "#fff" : "var(--np-text-secondary)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">{SOURCE_ICONS[type]}</span>
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
                {addMode === "search" && (
                  <>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Search the web..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearch(true)}
                        className="np-input flex-1 px-3 py-2.5 text-[13px] rounded-lg"
                      />
                      <button onClick={() => handleSearch(true)} disabled={!searchQuery.trim() || isSearching} className="np-btn-primary px-3 py-2.5 rounded-lg flex items-center justify-center">
                        {isSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">search</span>}
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <>
                        {/* Select all + Add selected bar */}
                        <div className="flex items-center justify-between">
                          <button onClick={toggleSelectAll} className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--np-blue)" }}>
                            <span className="material-symbols-outlined text-[16px]">{selectedResults.size === searchResults.length ? "check_box" : selectedResults.size > 0 ? "indeterminate_check_box" : "check_box_outline_blank"}</span>
                            {selectedResults.size === searchResults.length ? "Deselect all" : "Select all"}
                          </button>
                          {selectedResults.size > 0 && (
                            <div className="flex items-center gap-1.5">
                              {isAddingSelected && addingProgress.total > 0 && (
                                <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--np-input-bg)" }}>
                                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(addingProgress.done / addingProgress.total) * 100}%`, background: "var(--np-blue)" }} />
                                </div>
                              )}
                              <button
                                onClick={handleAddSelected}
                                disabled={isAddingSelected}
                                className="np-btn-primary px-2.5 py-1 text-[11px] rounded-md flex items-center gap-1"
                              >
                                {isAddingSelected ? (
                                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{addingProgress.done}/{addingProgress.total}</>
                                ) : (
                                  <><span className="material-symbols-outlined text-[14px]">add</span>Add {selectedResults.size}</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 max-h-[350px] overflow-y-auto custom-scrollbar">
                          {searchResults.map((r, i) => {
                            const isSelected = selectedResults.has(r.url);
                            const typeIcon = r.type === "youtube" ? "smart_display" : r.type === "pdf" ? "picture_as_pdf" : r.type === "image" ? "image" : "language";
                            return (
                              <div
                                key={i}
                                onClick={() => toggleResultSelected(r.url)}
                                className="rounded-lg p-2.5 transition-colors group cursor-pointer"
                                style={{ border: isSelected ? "1.5px solid var(--np-blue)" : "1px solid var(--np-divider-light)", background: isSelected ? "var(--np-blue-light)" : "transparent" }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0" style={{ color: isSelected ? "var(--np-blue)" : "var(--np-text-tertiary)" }}>
                                    {isSelected ? "check_box" : "check_box_outline_blank"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[12px]" style={{ color: r.type === "youtube" ? "#FF0000" : r.type === "pdf" ? "#E53935" : "var(--np-blue)" }}>{typeIcon}</span>
                                      <h4 className="text-[12px] font-semibold leading-tight line-clamp-1 flex-1" style={{ color: "var(--np-text)" }}>{r.title}</h4>
                                    </div>
                                    <p className="text-[11px] line-clamp-2 mt-1 leading-relaxed" style={{ color: "var(--np-text-tertiary)" }}>{r.snippet}</p>
                                    <div className="flex items-center justify-between mt-1.5">
                                      <span className="text-[10px] truncate max-w-[120px]" style={{ color: "var(--np-blue)" }}>{(() => { try { return new URL(r.url).hostname; } catch { return r.url; } })()}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAddSearchResult(r); }}
                                        disabled={addingResultUrl === r.url || isAddingSelected}
                                        className="np-btn-primary px-2 py-0.5 text-[10px] rounded flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        {addingResultUrl === r.url ? (
                                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                          <span className="material-symbols-outlined text-[12px]">add</span>
                                        )}
                                        Add
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Load more / pagination */}
                        {hasMoreResults && (
                          <button
                            onClick={() => handleSearch(false)}
                            disabled={isLoadingMore}
                            className="np-btn-secondary w-full py-2 text-[12px] flex items-center justify-center gap-1.5"
                          >
                            {isLoadingMore ? (
                              <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />Loading...</>
                            ) : (
                              <><span className="material-symbols-outlined text-[16px]">expand_more</span>Load more results</>
                            )}
                          </button>
                        )}
                      </>
                    )}
                    {!isSearching && searchResults.length === 0 && searchQuery && (
                      <p className="text-[11px] text-center" style={{ color: "var(--np-text-tertiary)" }}>Press Enter or click search to find results</p>
                    )}
                  </>
                )}
                {addMode === "images" && (
                  <>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Search for images..."
                        value={imageQuery}
                        onChange={e => setImageQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleImageSearch(true)}
                        className="np-input flex-1 px-3 py-2.5 text-[13px] rounded-lg"
                      />
                      <button onClick={() => handleImageSearch(true)} disabled={!imageQuery.trim() || isImageSearching} className="np-btn-primary px-3 py-2.5 rounded-lg flex items-center justify-center">
                        {isImageSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">search</span>}
                      </button>
                    </div>
                    {imageResults.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              if (selectedImages.size === imageResults.length) setSelectedImages(new Set());
                              else setSelectedImages(new Set(imageResults.map(r => r.url)));
                            }}
                            className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--np-blue)" }}
                          >
                            <span className="material-symbols-outlined text-[16px]">{selectedImages.size === imageResults.length ? "check_box" : selectedImages.size > 0 ? "indeterminate_check_box" : "check_box_outline_blank"}</span>
                            {selectedImages.size === imageResults.length ? "Deselect all" : "Select all"}
                          </button>
                          {selectedImages.size > 0 && (
                            <button onClick={handleAddSelectedImages} className="np-btn-primary px-2.5 py-1 text-[11px] rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>Add {selectedImages.size}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 max-h-[350px] overflow-y-auto custom-scrollbar">
                          {imageResults.map((img, i) => {
                            const isSelected = selectedImages.has(img.url);
                            return (
                              <div
                                key={i}
                                onClick={() => toggleImageSelected(img.url)}
                                className="rounded-lg overflow-hidden cursor-pointer relative group"
                                style={{ border: isSelected ? "2px solid var(--np-blue)" : "1px solid var(--np-divider-light)" }}
                              >
                                {img.thumbnail ? (
                                  <img
                                    src={img.thumbnail}
                                    alt={img.title}
                                    className="w-full h-20 object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-20 flex items-center justify-center" style={{ background: "var(--np-input-bg)" }}>
                                    <span className="material-symbols-outlined text-lg" style={{ color: "var(--np-text-tertiary)" }}>image</span>
                                  </div>
                                )}
                                <div className="absolute top-1 left-1">
                                  <span className="material-symbols-outlined text-[18px] drop-shadow-md" style={{ color: isSelected ? "var(--np-blue)" : "rgba(255,255,255,0.8)" }}>
                                    {isSelected ? "check_circle" : "radio_button_unchecked"}
                                  </span>
                                </div>
                                <p className="text-[10px] p-1 truncate" style={{ color: "var(--np-text-secondary)" }}>{img.title}</p>
                              </div>
                            );
                          })}
                        </div>
                        {hasMoreImages && (
                          <button
                            onClick={() => handleImageSearch(false)}
                            disabled={isLoadingMoreImages}
                            className="np-btn-secondary w-full py-2 text-[12px] flex items-center justify-center gap-1.5"
                          >
                            {isLoadingMoreImages ? (
                              <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />Loading...</>
                            ) : (
                              <><span className="material-symbols-outlined text-[16px]">expand_more</span>Load more images</>
                            )}
                          </button>
                        )}
                      </>
                    )}
                    {!isImageSearching && imageResults.length === 0 && imageQuery && (
                      <p className="text-[11px] text-center" style={{ color: "var(--np-text-tertiary)" }}>Press Enter or click search to find images</p>
                    )}
                  </>
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
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {source.sourceUrl ? (
                          <a
                            href={source.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[13px] truncate leading-tight block hover:underline"
                            style={{ color: "var(--np-blue)" }}
                            onClick={e => e.stopPropagation()}
                          >{source.title}</a>
                        ) : (
                          <h4 className="font-semibold text-[13px] truncate leading-tight" style={{ color: "var(--np-text)" }}>{source.title}</h4>
                        )}
                        <p className="text-[11px] line-clamp-1 mt-0.5 break-all" style={{ color: "var(--np-text-tertiary)" }}>{source.preview}</p>
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

                {/* Redundant button removed as per user request — moved to Studio panel */}
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
                  {synthesis ? (notepadData.suggestedTitle || "Synthesis Complete") : "Notes"}
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--np-text-tertiary)" }}>
                  {sources.length === 0 ? "Add sources to get started" : synthesis ? "Knowledge synthesized — ready to generate" : hasSourcesWithFacts ? "Sources extracted — ready to synthesize" : `${sources.length} source${sources.length !== 1 ? "s" : ""} added`}
                </p>
              </div>
              {(sources.length > 0 || images.length > 0) && (
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
                  {images.length > 0 && (
                    <>
                      <div className="w-px h-7" style={{ background: "var(--np-divider-light)" }} />
                      <div className="text-center">
                        <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--np-blue)" }}>{images.length}</p>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--np-text-tertiary)" }}>Images</p>
                      </div>
                    </>
                  )}
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
                  <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                    {([
                      { type: "search" as const, icon: "travel_explore", label: "Web Search", desc: "Search & add results" },
                      { type: "images" as const, icon: "image_search", label: "Image Search", desc: "Find & add images" },
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
                  {sources.map(source => {
                    const hasFacts = source.extractedFacts && source.extractedFacts.length > 0;
                    const isPending = source.extractedFacts === null;
                    
                    if (hasFacts) {
                      return (
                        <div key={source.id} className="rounded-lg p-5 overflow-hidden" style={{ border: "1px solid var(--np-divider-light)" }}>
                          <div className="flex items-center gap-2 mb-3 min-w-0">
                            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "var(--np-blue-light)" }}>
                              <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-blue)" }}>{SOURCE_ICONS[source.type]}</span>
                            </div>
                            {source.sourceUrl ? (
                              <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[13px] hover:underline truncate" style={{ color: "var(--np-blue)" }}>{source.title}</a>
                            ) : (
                              <h4 className="font-semibold text-[13px] truncate" style={{ color: "var(--np-text)" }}>{source.title}</h4>
                            )}
                            <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: "var(--np-text-tertiary)" }}>{source.extractedFacts!.length} facts</span>
                          </div>
                          <ul className="space-y-2.5">
                            {source.extractedFacts!.map((fact, i) => (
                              <li key={i} className="text-[13px] leading-relaxed pl-4 relative break-words" style={{ color: "var(--np-text-secondary)" }}>
                                <span className="absolute left-0 top-[8px] w-2 h-2 rounded-full" style={{ background: "var(--np-blue)", opacity: 0.3 }} />
                                {fact}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    } else if (isPending) {
                      return (
                        <div key={source.id} className="rounded-lg p-4 opacity-50" style={{ border: "1px solid var(--np-divider-light)" }}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-text-tertiary)" }}>{SOURCE_ICONS[source.type]}</span>
                            <h4 className="font-semibold text-[13px]" style={{ color: "var(--np-text-secondary)" }}>{source.title}</h4>
                            <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>Pending extraction</span>
                          </div>
                        </div>
                      );
                    } else {
                      // Extracted but zero facts
                      return (
                        <div key={source.id} className="rounded-lg p-4" style={{ border: "1px solid var(--np-divider-light)", background: "var(--np-input-bg)" }}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-text-tertiary)" }}>{SOURCE_ICONS[source.type]}</span>
                            <h4 className="font-semibold text-[13px]" style={{ color: "var(--np-text-secondary)" }}>{source.title}</h4>
                            <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>No facts extracted</span>
                          </div>
                        </div>
                      );
                    }
                  })}
                  {!allExtracted && sources.length > 0 && (
                    <div className="text-center py-6">
                      <p className="text-[13px]" style={{ color: "var(--np-text-secondary)" }}>Click <strong>Extract Knowledge</strong> in the Studio panel to analyze your sources.</p>
                    </div>
                  )}
                  {/* Images gallery */}
                  {images.length > 0 && (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--np-divider-light)" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--np-blue)" }}>photo_library</span>
                        <h3 className="font-semibold text-[14px]" style={{ color: "var(--np-text)" }}>Images</h3>
                        <span className="text-[11px] ml-auto" style={{ color: "var(--np-text-tertiary)" }}>{images.length} image{images.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {images.map(img => (
                          <div key={img.id} className="relative group rounded-lg overflow-hidden" style={{ border: "1px solid var(--np-divider-light)" }}>
                          {(img.thumbnail || img.url) && (
                            <img src={img.thumbnail || img.url || undefined} alt={img.title} className="w-full h-20 object-cover" loading="lazy" />
                          )}
                            <button
                              onClick={() => removeImage(img.id)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ background: "rgba(0,0,0,0.6)" }}
                            >
                              <span className="material-symbols-outlined text-[14px] text-white">close</span>
                            </button>
                            <p className="text-[10px] px-1.5 py-1 truncate" style={{ color: "var(--np-text-secondary)" }}>{img.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasSourcesWithFacts && !synthesis && (
                    <div className="text-center py-6 mt-4" style={{ borderTop: "1px solid var(--np-divider-light)" }}>
                      <p className="text-[13px]" style={{ color: "var(--np-text-secondary)" }}>Ready to synthesize. Click <strong>Extract Knowledge</strong> in the Studio panel.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Synthesis complete */
                <div className="space-y-5">
                  {notepadData.coreThesis && (
                    <div className="rounded-lg p-4" style={{ background: "var(--np-blue-light)", border: "1px solid var(--np-blue)", borderColor: "color-mix(in srgb, var(--np-blue) 20%, transparent)" }}>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "var(--np-blue)" }}>Core Thesis</span>
                      <p className="text-[14px] leading-relaxed" style={{ color: "var(--np-text)" }}>{notepadData.coreThesis}</p>
                    </div>
                  )}
                  {notepadData.themes && notepadData.themes.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: "var(--np-text-tertiary)" }}>Themes</span>
                      <div className="flex flex-wrap gap-2">
                        {notepadData.themes.map((t, i) => (
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
          <div className="np-card p-4 space-y-4 overflow-y-auto custom-scrollbar h-full">
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
                {
                  n: 1, label: "Add Sources",
                  sub: sources.length > 0 ? `${sources.length} added` : "Text, URLs, files",
                  done: sources.length > 0,
                  active: false,
                  progress: 0,
                },
                {
                  n: 2, label: "Extract Knowledge",
                  sub: isExtracting ? `${extractProgress.done}/${extractProgress.total}` : allExtracted ? `${totalFacts} facts` : "AI analyzes sources",
                  done: allExtracted,
                  active: isExtracting,
                  progress: extractProgress.total > 0 ? (extractProgress.done / extractProgress.total) * 100 : 0,
                },
                {
                  n: 3, label: "Synthesize",
                  sub: isSynthesizing ? `${Math.round(synthesizeProgress.percent)}%` : synthesis ? "Complete" : "Combine all knowledge",
                  done: !!synthesis,
                  active: isSynthesizing,
                  progress: synthesizeProgress.percent,
                },
                {
                  n: 4, label: "Generate Video", sub: "Create script & media", done: false,
                  active: false, progress: 0,
                },
              ].map((s, i) => (
                <div key={s.n}>
                  <div className="flex items-center gap-3 py-1.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${s.active ? "animate-pulse" : ""}`}
                      style={{
                        background: s.done ? "var(--np-green)" : s.active ? "var(--np-blue)" : step >= s.n ? "var(--np-blue)" : "var(--np-input-bg)",
                        color: s.done || step >= s.n || s.active ? "#fff" : "var(--np-text-tertiary)",
                      }}
                    >
                      {s.done ? <span className="material-symbols-outlined text-[16px]">check</span> : s.active ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : s.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--np-text)" }}>{s.label}</p>
                      <p className="text-[11px] leading-tight mt-0.5" style={{ color: s.active ? "var(--np-blue)" : "var(--np-text-tertiary)" }}>{s.sub}</p>
                    </div>
                    {i < 3 && s.done && (
                      <span className="material-symbols-outlined text-[14px]" style={{ color: "var(--np-green)" }}>check_circle</span>
                    )}
                  </div>
                  {s.active && s.progress > 0 && (
                    <div className="ml-10 mr-2 mb-1">
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--np-input-bg)" }}>
                        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${s.progress}%`, background: "var(--np-blue)" }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="w-full h-px" style={{ background: "var(--np-divider-light)" }} />

            {/* Action buttons */}
            <div className="space-y-2.5">
              <div>
                {/* Combined Progress State */}
                {(isExtracting || isSynthesizing) && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "var(--np-text-secondary)" }}>
                        {isExtracting ? `Extracting ${extractProgress.done}/${extractProgress.total}...` : synthesis ? "Done!" : "Synthesizing..."}
                      </span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--np-blue)" }}>
                        {isExtracting ? Math.round((extractProgress.done / (extractProgress.total || 1)) * 100) : Math.round(synthesizeProgress.percent)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--np-input-bg)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ 
                          width: `${isExtracting ? (extractProgress.done / (extractProgress.total || 1)) * 100 : synthesizeProgress.percent}%`, 
                          background: "var(--np-blue)" 
                        }}
                      />
                    </div>
                  </div>
                )}

                {isConfirmingAnalysis ? (
                  <div className="space-y-2 p-3 rounded-lg animate-in fade-in slide-in-from-top-2" style={{ background: "var(--np-blue-light)", border: "1px solid var(--np-blue)" }}>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--np-blue)" }}>Confirm Analysis</p>
                    <p className="text-[11px] leading-tight" style={{ color: "var(--np-text-secondary)" }}>
                      AI will analyze {sources.length} sources to create a {targetDurationMinutes}m video.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold" style={{ color: "var(--np-text)" }}>
                        {qualityTier === "basic" ? "Free Analysis" : `Est. Video Cost: ~$${calculateTotalCost(qualityTier, estimatedScenes).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button 
                        onClick={() => setIsConfirmingAnalysis(false)} 
                        className="flex-1 py-1.5 rounded text-[11px] font-medium" 
                        style={{ background: "var(--np-divider-light)", color: "var(--np-text-secondary)" }}
                      >Cancel</button>
                      <button 
                        onClick={handleCombinedAction} 
                        className="flex-[2] py-1.5 rounded text-[11px] font-bold text-white bg-[var(--np-blue)]"
                      >Confirm & Analyze</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCombinedAction}
                    disabled={isExtracting || isSynthesizing || sources.length === 0}
                    className={`w-full py-2.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all ${
                      synthesis ? "np-btn-secondary" : "np-btn-primary shadow-lg shadow-blue-500/20"
                    }`}
                  >
                    {isExtracting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Extracting...</>
                    ) : isSynthesizing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Synthesizing...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">{synthesis ? "refresh" : "psychology"}</span>{synthesis ? "Re-Extract Knowledge" : "Extract Knowledge"}</>
                    )}
                  </button>
                )}
              </div>
              {/* Visual Style Selector */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--np-text-tertiary)" }}>Visual Style</p>
                <div className="grid grid-cols-3 gap-1.5" style={{ maxHeight: 200, overflowY: "auto", paddingRight: 2 }}>
                  {VISUAL_STYLES.map(style => {
                    const isActive = globalVisualStyle === style.value;
                    return (
                      <button
                        key={style.value}
                        onClick={() => setGlobalVisualStyle(style.value)}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all text-center"
                        style={{
                          background: isActive ? "var(--np-blue)" : "var(--np-input-bg)",
                          color: isActive ? "#fff" : "var(--np-text-secondary)",
                          border: isActive ? "1px solid var(--np-blue)" : "1px solid transparent",
                        }}
                        title={style.value}
                      >
                        <span className="material-symbols-outlined text-[16px]">{style.icon}</span>
                        <span className="text-[9px] font-medium leading-tight">{style.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quality Tier Selector */}
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--np-divider-light)" }}>
                <div className="flex">
                  {(["basic", "medium", "pro"] as QualityTier[]).map((tier) => {
                    const t = QUALITY_TIERS[tier];
                    const isActive = qualityTier === tier;
                    return (
                      <button
                        key={tier}
                        onClick={() => setQualityTier(tier)}
                        className="flex-1 py-2 px-1 text-center transition-all"
                        style={{
                          background: isActive ? "var(--np-blue)" : "var(--np-input-bg)",
                          color: isActive ? "#fff" : "var(--np-text-secondary)",
                          borderRight: tier !== "pro" ? "1px solid var(--np-divider-light)" : "none",
                        }}
                      >
                        <p className="text-[12px] font-bold">{t.label}</p>
                        <p className="text-[9px] mt-0.5 opacity-80">
                          {tier === "basic" ? "Free" : tier === "medium" ? "AI Video Mix" : "Full AI Video"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Cost estimate */}
              <div className="p-3 rounded-lg text-center" style={{ background: "var(--np-input-bg)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--np-text-secondary)" }}>
                  Est. ~{estimatedScenes} scenes · {QUALITY_TIERS[qualityTier].label}
                </p>
                <p className="text-[11px] mt-0.5 font-semibold" style={{ color: qualityTier === "basic" ? "var(--np-green, #22c55e)" : "var(--np-blue)" }}>
                  {qualityTier === "basic" ? "Free (Pollinations API)" : `~$${calculateTotalCost(qualityTier, estimatedScenes).toFixed(2)} est. pollen`}
                </p>
                <p className="text-[10px] mt-1 leading-tight" style={{ color: "var(--np-text-tertiary)" }}>
                  {QUALITY_TIERS[qualityTier].description}
                </p>
              </div>
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
