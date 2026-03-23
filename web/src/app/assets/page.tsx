"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { getHistory, loadProjectState, type VideoHistoryItem } from "@/lib/videoHistory";

type AssetType = "all" | "image" | "audio" | "video";

type Asset = {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  url: string;
  size?: string;
  date: string;
  project?: string; // project title this asset belongs to
};

export default function AssetLibrary() {
  const { storyboardImages, scriptData, sceneAudioUrls, sceneVideoUrls } = useAppContext();
  const [filter, setFilter] = useState<AssetType>("all");
  const [search, setSearch] = useState("");
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [savedProjectAssets, setSavedProjectAssets] = useState<Asset[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load assets from all saved projects in IndexedDB
  useEffect(() => {
    const loadSavedAssets = async () => {
      try {
        const history = getHistory();
        const allAssets: Asset[] = [];

        for (const item of history) {
          const state = await loadProjectState(item.id);
          if (!state) continue;
          const projName = item.title || "Untitled";
          const date = new Date(item.createdAt).toLocaleDateString();

          // Storyboard images
          if (state.storyboardImages) {
            Object.entries(state.storyboardImages).forEach(([sceneId, url]) => {
              const scene = state.scriptData?.scenes?.find((s: any) => s.id === Number(sceneId));
              allAssets.push({
                id: `saved-img-${item.id}-${sceneId}`,
                name: `${projName}_Scene_${sceneId}_${scene?.visual_prompt?.slice(0, 20).replace(/\s+/g, "_") || "image"}.jpg`,
                type: "image",
                url: url as string,
                date,
                project: projName,
              });
            });
          }

          // Audio
          if (state.sceneAudioUrls) {
            Object.entries(state.sceneAudioUrls).forEach(([sceneId, url]) => {
              allAssets.push({
                id: `saved-audio-${item.id}-${sceneId}`,
                name: `${projName}_Scene_${sceneId}_narration.mp3`,
                type: "audio",
                url: url as string,
                date,
                project: projName,
              });
            });
          }

          // Videos
          if (state.sceneVideoUrls) {
            Object.entries(state.sceneVideoUrls).forEach(([sceneId, url]) => {
              allAssets.push({
                id: `saved-video-${item.id}-${sceneId}`,
                name: `${projName}_Scene_${sceneId}_video.mp4`,
                type: "video",
                url: url as string,
                date,
                project: projName,
              });
            });
          }
        }

        setSavedProjectAssets(allAssets);
      } catch (err) {
        console.error("Failed to load saved project assets:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadSavedAssets();
  }, []);

  // Build assets from current session app state + saved projects + uploads
  const assets = useMemo(() => {
    const items: Asset[] = [];
    // Track IDs to avoid duplicates between current session and saved projects
    const seenUrls = new Set<string>();

    // Add storyboard images from current session
    Object.entries(storyboardImages).forEach(([sceneId, url]) => {
      seenUrls.add(url);
      const scene = scriptData?.scenes.find(s => s.id === Number(sceneId));
      items.push({
        id: `img-${sceneId}`,
        name: `Scene_${sceneId}_${scene?.visual_prompt?.slice(0, 20).replace(/\s+/g, "_") || "image"}.jpg`,
        type: "image",
        url,
        date: new Date().toLocaleDateString(),
        project: scriptData?.title || "Current Session",
      });
    });

    // Add scene audio from current session
    Object.entries(sceneAudioUrls).forEach(([sceneId, url]) => {
      seenUrls.add(url);
      const scene = scriptData?.scenes.find(s => s.id === Number(sceneId));
      items.push({
        id: `audio-${sceneId}`,
        name: `Scene_${sceneId}_narration${scene ? `_${scene.narration?.slice(0, 20).replace(/\s+/g, "_")}` : ""}.mp3`,
        type: "audio",
        url,
        date: new Date().toLocaleDateString(),
        project: scriptData?.title || "Current Session",
      });
    });

    // Add scene videos from current session
    Object.entries(sceneVideoUrls).forEach(([sceneId, url]) => {
      seenUrls.add(url);
      const scene = scriptData?.scenes.find(s => s.id === Number(sceneId));
      items.push({
        id: `video-${sceneId}`,
        name: `Scene_${sceneId}_video${scene ? `_${scene.visual_prompt?.slice(0, 20).replace(/\s+/g, "_")}` : ""}.mp4`,
        type: "video",
        url,
        date: new Date().toLocaleDateString(),
        project: scriptData?.title || "Current Session",
      });
    });

    // Add assets from saved projects (deduplicated)
    for (const asset of savedProjectAssets) {
      if (!seenUrls.has(asset.url)) {
        seenUrls.add(asset.url);
        items.push(asset);
      }
    }

    // Add uploaded assets
    items.push(...uploadedAssets);

    return items;
  }, [storyboardImages, scriptData, sceneAudioUrls, sceneVideoUrls, uploadedAssets, savedProjectAssets]);

  const filtered = assets.filter(a => {
    if (filter !== "all" && a.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.project?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const type: Asset["type"] = file.type.startsWith("image") ? "image"
        : file.type.startsWith("audio") ? "audio"
        : "video";
      setUploadedAssets(prev => [...prev, {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type,
        url,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        date: new Date().toLocaleDateString(),
      }]);
    });
    e.target.value = "";
  };

  const handleDelete = (id: string) => {
    setUploadedAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleDownload = (asset: Asset) => {
    const a = document.createElement("a");
    a.href = asset.url;
    a.download = asset.name;
    a.click();
  };

  const filterTabs: { label: string; value: AssetType }[] = [
    { label: "All", value: "all" },
    { label: "Images", value: "image" },
    { label: "Videos", value: "video" },
    { label: "Audio", value: "audio" },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xl">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            className="w-full bg-surface-container-low border-none rounded-xl py-2.5 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary/40 placeholder:text-outline/60 font-body"
            placeholder="Search assets, tags, or projects..."
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <h1 className="font-headline font-bold text-lg text-on-surface whitespace-nowrap">Asset Library</h1>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <section className="flex flex-col gap-10 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-on-surface font-headline font-extrabold text-5xl mb-4 tracking-tight">Media Assets</h2>
              <p className="text-on-surface-variant font-body max-w-md">
                {assets.length} asset{assets.length !== 1 ? "s" : ""} from your projects. Upload or manage your media files.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="primary-gradient text-white px-8 py-4 rounded-xl font-headline font-bold flex items-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
              Upload New Asset
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 p-1.5 bg-surface-container-low rounded-2xl w-fit">
              {filterTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    filter === tab.value
                      ? "bg-surface-container-highest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1.5 text-xs opacity-60">
                      ({assets.filter(a => a.type === tab.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="text-sm font-label text-on-surface-variant">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Asset Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map(asset => (
                <div key={asset.id} className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
                  <div className="aspect-video relative overflow-hidden">
                    {asset.type === "image" ? (
                      <img
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        src={asset.url}
                        alt={asset.name}
                      />
                    ) : asset.type === "audio" ? (
                      <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                        <span className="material-symbols-outlined text-outline text-4xl opacity-40">music_note</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                        <span className="material-symbols-outlined text-outline text-4xl opacity-40">movie</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all" />

                    {/* Type badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold font-headline uppercase tracking-wider ${
                        asset.type === "image" ? "bg-primary/80 text-white"
                        : asset.type === "audio" ? "bg-tertiary text-on-tertiary"
                        : "bg-emerald-500/80 text-white"
                      }`}>
                        {asset.type}
                      </span>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => handleDownload(asset)}
                        className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
                        title="Download"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                      </button>
                      {asset.id.startsWith("upload-") && (
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="w-8 h-8 rounded-full bg-red-500/20 backdrop-blur-md text-red-300 flex items-center justify-center hover:bg-red-500/40"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-headline font-bold text-on-surface mb-1 truncate">{asset.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">{asset.size || asset.project || "AI Generated"}</span>
                      <span className="text-[11px] font-body text-outline">{asset.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-primary/10 rounded-3xl glass">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-6">
                <span className="material-symbols-outlined text-3xl">
                  {search ? "search_off" : "add_photo_alternate"}
                </span>
              </div>
              <h4 className="font-headline font-bold text-xl text-on-surface mb-2">
                {search ? "No matching assets" : "No assets yet"}
              </h4>
              <p className="text-on-surface-variant font-body text-sm text-center max-w-xs leading-relaxed">
                {search
                  ? `No assets match "${search}". Try a different search term.`
                  : "Generate a video to see your scene images here, or upload your own media files."
                }
              </p>
              {!search && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 primary-gradient text-white px-6 py-3 rounded-xl font-headline font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined">upload</span>
                  Upload Files
                </button>
              )}
            </div>
          )}

          {/* Drop zone */}
          {filtered.length > 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 py-12 flex flex-col items-center justify-center border-2 border-dashed border-primary/10 rounded-3xl glass mb-8 cursor-pointer hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-4">
                <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
              </div>
              <h4 className="font-headline font-bold text-lg text-on-surface mb-1">Upload more assets</h4>
              <p className="text-on-surface-variant font-body text-sm">Supports MP4, MOV, PNG, JPG, and WAV formats</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
