import type { QualityTier } from "@/context/AppContext";
import { getCloudHistory, saveProjectToCloud, getCloudProjectState, deleteProjectFromCloud } from "./cloudStorage";

export type VideoHistoryItem = {
  id: string;
  title: string;
  topic: string;
  angle: string;
  thumbnailUrl?: string; // Still useful for small previews in localStorage
  hasThumbnail?: boolean; // Flag to indicate if high-res thumbnail exists in IndexedDB
  quality: QualityTier;
  dimensionId: string;
  dimensionLabel: string;
  totalSeconds: number;
  activeStyle?: string | null;
  settingText?: string;
  createdAt: string;
  updatedAt: number;
  thumbnailBase64?: string;
  url?: string; 
  mode?: string; 
  audioFile?: string | null; 
  pollenUsed?: number;
};

export type ProjectState = {
  id: string; // matches VideoHistoryItem id
  scriptData: any; // original script metadata
  storyboardImages: Record<number, string[]>;
  sceneAudioUrls: Record<number, string>;
  sceneVideoUrls: Record<number, string>;
  sceneDurations: Record<number, number>;
  musicUrl: string | null;
  finalVideoUrl: string | null;
  // Extended editor state
  editorScenes?: any[]; 
  editorTracks?: any[];
};

/** Internal type for storage in IndexedDB */
type PersistentProjectState = Omit<ProjectState, 'storyboardImages' | 'sceneAudioUrls' | 'sceneVideoUrls' | 'musicUrl' | 'finalVideoUrl'> & {
  storyboardImages: Record<number, (string | Blob)[]>;
  sceneAudioUrls: Record<number, string | Blob>;
  sceneVideoUrls: Record<number, string | Blob>;
  musicUrl: string | Blob | null;
  finalVideoUrl: string | Blob | null;
  thumbnailBlob?: Blob;
};

const HISTORY_KEY = "link2video_history";
const IDB_DB_NAME = "link2video_db";
const IDB_STORE_NAME = "projects";
const MAX_ITEMS = 30;
const MAX_THUMBNAIL_BYTES = 80000; // 80KB final compressed limit per item

/**
 * Sync local history with cloud history.
 * Fetches from cloud and merges missing items into localStorage.
 */
export async function syncHistoryWithCloud(): Promise<VideoHistoryItem[]> {
  try {
    const cloud = await getCloudHistory();
    const local = getHistory();
    
    // Merge: cloud items that aren't in local (or are newer)
    const merged = [...local];
    for (const remote of cloud) {
      const idx = merged.findIndex(h => h.id === remote.id);
      if (idx === -1) {
        merged.push(remote);
      } else if (new Date(remote.createdAt) > new Date(merged[idx].createdAt)) {
        merged[idx] = remote;
      }
    }
    
    // Sort and limit
    const final = merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, MAX_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(final));
    return final;
  } catch (err) {
    console.warn("History sync failed:", err);
    return getHistory();
  }
}

/**
 * Compress a base64 data URL thumbnail to fit within size limits.
 * Uses an offscreen canvas to resize and re-encode as JPEG.
 */
function compressThumbnail(dataUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    // External URLs are always fine (tiny strings)
    if (dataUrl.startsWith("http")) {
      resolve(dataUrl);
      return;
    }
    // Only compress data URLs
    if (!dataUrl.startsWith("data:image")) {
      resolve(dataUrl.length < MAX_THUMBNAIL_BYTES ? dataUrl : undefined);
      return;
    }
    try {
      const img = new Image();
      img.onload = () => {
        const maxW = 320;
        const maxH = 200;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const scale = Math.min(maxW / w, maxH / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(undefined); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.6);
        resolve(compressed.length < MAX_THUMBNAIL_BYTES ? compressed : undefined);
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl;
    } catch {
      resolve(undefined);
    }
  });
}

export function getHistory(): VideoHistoryItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out malformed entries missing required fields
    const items: VideoHistoryItem[] = parsed.filter(
      (item: unknown): item is VideoHistoryItem =>
        typeof item === "object" && item !== null &&
        typeof (item as VideoHistoryItem).id === "string" &&
        typeof (item as VideoHistoryItem).title === "string" &&
        typeof (item as VideoHistoryItem).createdAt === "string"
    );
    // Deduplicate and sort
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Convert a URL (blob: or data:) to a Blob object for persistent storage.
 */
async function urlToBlob(url: string): Promise<Blob | string> {
  if (!url || url.startsWith("http")) return url;
  try {
    const res = await fetch(url);
    return await res.blob();
  } catch (err) {
    console.warn("Failed to convert URL to Blob:", url, err);
    return url;
  }
}

/**
 * Convert a Blob back to a usable blob: URL.
 */
function blobToUrl(blob: Blob | string): string {
  if (typeof blob === "string") return blob;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}

/**
 * Fetch just the thumbnail Blob from IndexedDB for a project.
 */
export async function getThumbnailBlob(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    const localState = await new Promise<PersistentProjectState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (localState?.thumbnailBlob) {
      return blobToUrl(localState.thumbnailBlob);
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveToHistory(item: VideoHistoryItem): Promise<void> {
  try {
    // Compress thumbnail for storage
    let thumbUrl: string | undefined;
    if (item.thumbnailUrl) {
      thumbUrl = await compressThumbnail(item.thumbnailUrl);
    }
    const safe: VideoHistoryItem = {
      ...item,
      totalSeconds: Math.round(item.totalSeconds), // avoid floating point
      thumbnailUrl: thumbUrl,
      pollenUsed: typeof item.pollenUsed === "number" ? Number(item.pollenUsed.toFixed(4)) : 0,
    };
    const existing = getHistory().filter((h) => h.id !== safe.id);
    const updated = [safe, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

    // Updated locally. Cloud sync is handled by saveProjectState.
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function deleteFromHistory(id: string): void {
  try {
    const updated = getHistory().filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    deleteProjectState(id); // Clean up IndexedDB space
    deleteProjectFromCloud(id); // Clean up cloud
  } catch {}
}

// ==========================================
// IndexedDB Wrappers for Large Project State
// ==========================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectState(state: ProjectState): Promise<void> {
  try {
    // 1. Process all URLs into persistent Blobs
    const persistentState: PersistentProjectState = { 
      ...state,
      storyboardImages: {},
      sceneAudioUrls: {},
      sceneVideoUrls: {}
    };
    
    // Process storyboard images
    for (const [id, urls] of Object.entries(state.storyboardImages)) {
      persistentState.storyboardImages[Number(id)] = await Promise.all(
        urls.map(url => typeof url === "string" ? urlToBlob(url) : url)
      );
    }

    // Process audio/video
    for (const [id, url] of Object.entries(state.sceneAudioUrls)) {
      if (typeof url === "string") persistentState.sceneAudioUrls[Number(id)] = await urlToBlob(url);
    }
    for (const [id, url] of Object.entries(state.sceneVideoUrls)) {
      if (typeof url === "string") persistentState.sceneVideoUrls[Number(id)] = await urlToBlob(url);
    }
    if (typeof state.finalVideoUrl === "string") {
      persistentState.finalVideoUrl = await urlToBlob(state.finalVideoUrl);
    }
    if (typeof state.musicUrl === "string") {
      persistentState.musicUrl = await urlToBlob(state.musicUrl);
    }

    // Capture first frame as persistent thumbnail blob if not present
    let hasThumbnail = false;
    if (state.storyboardImages[0]?.[0]) {
      const firstImg = state.storyboardImages[0][0];
      const thumb = typeof firstImg === "string" ? await urlToBlob(firstImg) : firstImg;
      if (thumb instanceof Blob) {
        persistentState.thumbnailBlob = thumb;
        hasThumbnail = true;
      }
    }

    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(persistentState);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Update history flag if item exists
    const history = getHistory();
    const histIdx = history.findIndex(h => h.id === state.id);
    if (histIdx !== -1) {
      if (hasThumbnail) history[histIdx].hasThumbnail = true;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    // Background cloud sync — use the original state so we don't try to upload Blobs to the cloud JSON field
    // Cloud upload handles its own conversion to S3/Cloud storage URLs
    const item = history.find(h => h.id === state.id);
    // Use a minimal stub so new (pipeline-generated) projects are still uploaded
    const historyItem = item ?? {
      id: state.id,
      title: state.scriptData?.title || "Untitled",
      topic: "",
      angle: "",
      quality: "basic" as const,
      dimensionId: "16:9",
      dimensionLabel: "16:9",
      totalSeconds: 0, 
      activeStyle: null, 
      settingText: "", 
      createdAt: new Date().toISOString(),
      hasThumbnail: hasThumbnail,
    };
    saveProjectToCloud(state.id, state, historyItem);

  } catch (err) {
    console.error("Failed to save project state to IndexedDB", err);
  }
}

export async function loadProjectState(id: string): Promise<ProjectState | null> {
  try {
    const db = await openDB();
    const localState = await new Promise<PersistentProjectState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    const stateToHydrate = localState || await getCloudProjectState(id) as PersistentProjectState;
    if (!stateToHydrate) return null;

    // 2. Convert Blobs back to usable blob: URLs for the browser
    const hydrated: ProjectState = { 
      ...stateToHydrate as any,
      storyboardImages: {},
      sceneAudioUrls: {},
      sceneVideoUrls: {},
      musicUrl: null,
      finalVideoUrl: null
    };
    
    for (const [sid, blobs] of Object.entries(stateToHydrate.storyboardImages)) {
      if (Array.isArray(blobs)) {
        hydrated.storyboardImages[Number(sid)] = blobs.map(b => typeof b === "string" ? b : blobToUrl(b));
      }
    }

    for (const [sid, b] of Object.entries(stateToHydrate.sceneAudioUrls)) {
      hydrated.sceneAudioUrls[Number(sid)] = typeof b === "string" ? b : blobToUrl(b as any);
    }

    for (const [sid, b] of Object.entries(stateToHydrate.sceneVideoUrls)) {
      hydrated.sceneVideoUrls[Number(sid)] = typeof b === "string" ? b : blobToUrl(b as any);
    }

    if (stateToHydrate.finalVideoUrl) {
      hydrated.finalVideoUrl = typeof stateToHydrate.finalVideoUrl === "string" 
        ? stateToHydrate.finalVideoUrl 
        : blobToUrl(stateToHydrate.finalVideoUrl);
    }
    
    if (stateToHydrate.musicUrl) {
      hydrated.musicUrl = typeof stateToHydrate.musicUrl === "string"
        ? stateToHydrate.musicUrl
        : blobToUrl(stateToHydrate.musicUrl);
    }

    // If we have a persistent thumbnail blob but missing history thumb, we can restore it elsewhere,
    // but here we just ensure the hydrated object is a clean string-based version for context.
    
    if (localState === null && stateToHydrate) {
      // Save local copy for next time if it came from cloud
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(stateToHydrate);
    }

    return hydrated;
  } catch (err) {
    console.error("Failed to load project state from IndexedDB", err);
    return null;
  }
}

export async function deleteProjectState(id: string): Promise<void> {
  try {
    const db = await openDB();

    // Load the project state first to revoke any blob URLs (frees browser memory)
    const state = await new Promise<ProjectState | null>((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (state) {
      // Revoke all blob: URLs to free browser memory
      const urlsToRevoke: string[] = [];
      if (state.storyboardImages) {
        Object.values(state.storyboardImages).forEach(urls => {
          if (Array.isArray(urls)) {
            urls.forEach(url => {
              if (typeof url === "string" && url.startsWith("blob:")) urlsToRevoke.push(url);
            });
          }
        });
      }
      if (state.sceneAudioUrls) {
        Object.values(state.sceneAudioUrls).forEach(url => {
          if (typeof url === "string" && url.startsWith("blob:")) urlsToRevoke.push(url);
        });
      }
      if (state.sceneVideoUrls) {
        Object.values(state.sceneVideoUrls).forEach(url => {
          if (typeof url === "string" && url.startsWith("blob:")) urlsToRevoke.push(url);
        });
      }
      if (state.finalVideoUrl && typeof state.finalVideoUrl === "string" && state.finalVideoUrl.startsWith("blob:")) {
        urlsToRevoke.push(state.finalVideoUrl);
      }
      urlsToRevoke.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    }

    // Delete the IndexedDB record
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete project state from IndexedDB", err);
  }
}
