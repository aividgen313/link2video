"use client";
import Link from "next/link";
import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VIDEO_DIMENSIONS } from "@/context/AppContext";
import { getHistory, loadProjectState } from "@/lib/videoHistory";

type AssetType = "all" | "image" | "audio" | "video";

type Asset = {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  url: string;
  size?: string;
  date: string;
  project?: string;
  projectId?: string;
};

type ProjectGroup = {
  id: string;
  title: string;
  date: string;
  assets: Asset[];
};

export default function AssetLibrary() {
  const { storyboardImages, scriptData, sceneAudioUrls, sceneVideoUrls, finalVideoUrl, setScriptData, setStoryboardImages, setSceneAudioUrls, setSceneVideoUrls, setSceneDurations, setFinalVideoUrl, setQualityTier, setVideoDimension, setUrl, setAngle } = useAppContext();
  const router = useRouter();
  const [filter, setFilter] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [savedProjectAssets, setSavedProjectAssets] = useState<Asset[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["current"]));
  const [isOpening, setIsOpening] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // Load assets from all saved projects in IndexedDB
  useEffect(() => {
    const loadSavedAssets = async () => {
      try {
        const history = getHistory();
        const allAssets: Asset[] = [];

        // Load project states in parallel to avoid hanging the UI
        const statesList = await Promise.all(
          history.map(item => loadProjectState(item.id))
        );

        history.forEach((item, index) => {
          const state = statesList[index];
          if (!state) return;
          const projName = item.title || "Untitled";
          const date = new Date(item.createdAt).toLocaleDateString();

          // Storyboard images
          if (state.storyboardImages) {
            Object.entries(state.storyboardImages).forEach(([sceneId, url]) => {
              allAssets.push({
                id: `saved-img-${item.id}-${sceneId}`,
                name: `Scene ${sceneId} Image`,
                type: "image",
                url: url as string,
                date,
                project: projName,
                projectId: item.id,
              });
            });
          }

          // Audio
          if (state.sceneAudioUrls) {
            Object.entries(state.sceneAudioUrls).forEach(([sceneId, url]) => {
              allAssets.push({
                id: `saved-audio-${item.id}-${sceneId}`,
                name: `Scene ${sceneId} Narration`,
                type: "audio",
                url: url as string,
                date,
                project: projName,
                projectId: item.id,
              });
            });
          }

          // Videos
          if (state.sceneVideoUrls) {
            Object.entries(state.sceneVideoUrls).forEach(([sceneId, url]) => {
              allAssets.push({
                id: `saved-video-${item.id}-${sceneId}`,
                name: `Scene ${sceneId} Video Clip`,
                type: "video",
                url: url as string,
                date,
                project: projName,
                projectId: item.id,
              });
            });
          }
          // Final Video
          if (state.finalVideoUrl) {
            allAssets.push({
              id: `saved-final-${item.id}`,
              name: `Final Exported Video`,
              type: "video",
              url: state.finalVideoUrl,
              date,
              project: projName,
              projectId: item.id,
            });
          }
        });

        setSavedProjectAssets(allAssets);
      } catch (err) {
        console.error("Failed to load saved project assets:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadSavedAssets();
  }, []);

  // Compute all assets and group them
  const groupedProjects = useMemo(() => {
    const items: Asset[] = [];
    const seenUrls = new Set<string>();

    // 1. Current Session
    const currentProj = scriptData?.title || "Current Session";
    const currentDate = new Date().toLocaleDateString();

    Object.entries(storyboardImages).forEach(([id, url]) => {
      seenUrls.add(url);
      items.push({ id: `cur-img-${id}`, name: `Scene ${id} Image`, type: "image", url, date: currentDate, project: currentProj, projectId: "current" });
    });
    Object.entries(sceneAudioUrls).forEach(([id, url]) => {
      seenUrls.add(url);
      items.push({ id: `cur-audio-${id}`, name: `Scene ${id} Narration`, type: "audio", url, date: currentDate, project: currentProj, projectId: "current" });
    });
    Object.entries(sceneVideoUrls).forEach(([id, url]) => {
      seenUrls.add(url);
      items.push({ id: `cur-vid-${id}`, name: `Scene ${id} Video Clip`, type: "video", url, date: currentDate, project: currentProj, projectId: "current" });
    });
    if (finalVideoUrl) {
      seenUrls.add(finalVideoUrl);
      items.push({ id: `cur-final`, name: `Final Exported Video`, type: "video", url: finalVideoUrl, date: currentDate, project: currentProj, projectId: "current" });
    }

    // 2. Saved Projects
    savedProjectAssets.forEach(asset => {
      if (!seenUrls.has(asset.url)) {
        seenUrls.add(asset.url);
        items.push(asset);
      }
    });

    // 3. Uploads
    items.push(...uploadedAssets);

    // Apply Filters & Search
    const filtered = items.filter(a => {
      if (filter !== "all" && a.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.project?.toLowerCase().includes(q);
      }
      return true;
    });

    // Grouping
    const groups: Record<string, ProjectGroup> = {};
    filtered.forEach(asset => {
      const pId = asset.projectId || "uploads";
      const pTitle = pId === "uploads" ? "Custom Uploads" : (asset.project || "Other Project");
      if (!groups[pId]) {
        groups[pId] = { id: pId, title: pTitle, date: asset.date, assets: [] };
      }
      groups[pId].assets.push(asset);
    });

    // Convert to array, current first, then by date desc
    return Object.values(groups).sort((a, b) => {
      if (a.id === "current") return -1;
      if (b.id === "current") return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [storyboardImages, scriptData, sceneAudioUrls, sceneVideoUrls, finalVideoUrl, uploadedAssets, savedProjectAssets, filter, search]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      setUploadedAssets(prev => [...prev, {
        id: `upload-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type.startsWith("image") ? "image" : file.type.startsWith("audio") ? "audio" : "video",
        url,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        date: new Date().toLocaleDateString(),
        projectId: "uploads",
      }]);
    });
  };

  const handleDownload = (asset: Asset) => {
    const a = document.createElement("a");
    a.href = asset.url;
    a.download = asset.name;
    a.click();
  };

  const handleOpenProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpening(projectId);
    try {
      const state = await loadProjectState(projectId);
      if (state && state.scriptData) {
        setScriptData({ ...state.scriptData, editorScenes: state.editorScenes, editorTracks: state.editorTracks });
        setStoryboardImages(state.storyboardImages || {});
        setSceneAudioUrls(state.sceneAudioUrls || {});
        setSceneVideoUrls(state.sceneVideoUrls || {});
        setSceneDurations(state.sceneDurations || {});
        setFinalVideoUrl(state.finalVideoUrl || null);
        
        const history = getHistory();
        const item = history.find(h => h.id === projectId);
        if (item) {
          if (item.quality) setQualityTier(item.quality as any);
          if (item.dimensionId) {
            const dim = VIDEO_DIMENSIONS.find((d: any) => d.id === item.dimensionId);
            if (dim) setVideoDimension(dim);
          }
          if (item.topic) setUrl(item.topic);
          if (item.angle) setAngle(item.angle);
        }
        
        router.push("/editor");
      }
    } catch (err) {
      console.error("Failed to open project:", err);
      setIsOpening(null);
    }
  };

  const totalAssetsCount = groupedProjects.reduce((sum, p) => sum + p.assets.length, 0);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-2">
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={handleUpload} />

      {/* Breadcrumb — refined */}
      <div className="mb-6 flex items-center gap-3 glass-subtle px-4 py-2 rounded-2xl w-fit border border-outline-variant/10 shadow-sm animate-fade-in-up">
        <Link href="/" className="text-outline text-[10px] font-black uppercase tracking-[0.2em] hover:text-primary transition-colors flex items-center gap-1.5 group">
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Dashboard
        </Link>
        <span className="w-1 h-1 rounded-full bg-outline/30 shrink-0" />
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">folder_open</span>
          <span className="font-headline font-black text-xs text-on-surface uppercase tracking-wider">Asset Library</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-outline-variant/10">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
            <span className="font-black text-[11px] text-primary uppercase tracking-[0.3em]">Vault</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-headline font-black text-on-surface tracking-tight leading-tight">Your Media</h1>
          <p className="text-outline font-medium max-w-lg text-sm md:text-base leading-relaxed">
            Manage your generated clips, project files, and manual uploads in one central command center.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 bg-primary text-on-primary px-8 py-4 rounded-2xl font-headline font-black text-sm tracking-tight shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all btn-shimmer group"
        >
          <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">cloud_upload</span>
          Upload Media
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-0 z-20 py-4 bg-surface/80 backdrop-blur-xl border-y border-outline/10 px-1">
        <div className="flex gap-2 p-1 bg-surface-container-low rounded-xl">
          {(["all", "image", "video", "audio"] as AssetType[]).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                filter === t ? "bg-surface-container-highest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/60 text-lg">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            placeholder="Search projects or files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadingProjects ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-outline/60">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Scanning project history...</span>
        </div>
      ) : totalAssetsCount === 0 ? (
        <div className="py-20 text-center space-y-4">
          <span className="material-symbols-outlined text-6xl opacity-10">folder_open</span>
          <h3 className="text-xl font-bold">No assets found</h3>
          <p className="text-on-surface-variant text-sm">Try adjusting your filters or upload new media.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedProjects.map(project => {
            const isExpanded = expandedFolders.has(project.id);
            return (
              <div key={project.id} className="space-y-4">
                {/* Folder Header — clickable to toggle */}
                <div
                  onClick={() => toggleFolder(project.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleFolder(project.id); }}
                  className="w-full flex items-center justify-between border-b border-outline/5 pb-2 group/folder hover:border-primary/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${project.id === 'current' ? 'bg-primary/10 text-primary shadow-primary/5' : 'bg-surface-container-high text-outline group-hover/folder:bg-primary/10 group-hover/folder:text-primary group-hover/folder:shadow-md'}`}>
                      <span className="material-symbols-outlined text-[24px]">{project.id === 'current' ? 'auto_awesome' : !isExpanded ? 'folder' : 'folder_open'}</span>
                    </div>
                    <div className="text-left py-1">
                      <h2 className="text-xl font-headline font-black text-on-surface tracking-tight">{project.title}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-primary/80 uppercase font-black tracking-widest">{project.assets.length} items</span>
                        <span className="w-1 h-1 rounded-full bg-outline/30 shrink-0" />
                        <span className="text-[10px] text-outline font-bold uppercase tracking-wider">{project.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-outline/40 transition-transform duration-200 ${!isExpanded ? '' : 'rotate-180'}`}>
                      expand_more
                    </span>
                    {project.id !== 'current' && project.id !== 'uploads' && (
                      <button 
                        onClick={(e) => handleOpenProject(project.id, e)}
                        disabled={isOpening !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all ml-2"
                      >
                        {isOpening === project.id ? (
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                        )}
                        Open in Editor
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="space-y-8 animate-fade-in-up">
                    {["video", "image", "audio"].map(type => {
                      const typeAssets = project.assets.filter(a => a.type === type);
                      if (typeAssets.length === 0) return null;
                      return (
                        <div key={type} className="space-y-3">
                          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-outline/60 px-1">{type}s</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {typeAssets.map(asset => (
                              <div
                                key={asset.id}
                                className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-container-low border border-outline/5 hover:border-primary/30 transition-all cursor-pointer"
                                onClick={() => asset.type === "video" ? setPreviewAsset(asset) : null}
                              >
                                {asset.type === "image" ? (
                                  <img src={asset.url || undefined} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : asset.type === "video" ? (
                                  <div className="w-full h-full relative">
                                    <video src={asset.url} className="w-full h-full object-cover" muted />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                      <span className="material-symbols-outlined text-white/80 group-hover:scale-125 transition-transform">play_circle</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-primary/40 text-3xl">graphic_eq</span>
                                    <span className="text-[10px] px-2 text-center opacity-60 truncate w-full">{asset.name}</span>
                                  </div>
                                )}

                                {/* Floating Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDownload(asset); }}
                                    className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary"
                                  >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Video Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setPreviewAsset(null)}>
          <div className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewAsset(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <video src={previewAsset.url} className="w-full h-full" controls autoPlay />
            <div className="absolute bottom-6 left-6 right-24">
              <h3 className="text-white font-bold text-lg drop-shadow-md">{previewAsset.name}</h3>
              <p className="text-white/60 text-sm">{previewAsset.project}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
