import type { QualityTier } from "@/context/AppContext";

export type VideoHistoryItem = {
  id: string;
  title: string;
  topic: string;
  angle: string;
  thumbnailUrl?: string;
  quality: QualityTier;
  dimensionId: string;
  dimensionLabel: string;
  totalSeconds: number;
  createdAt: string;
};

export type ProjectState = {
  id: string; // matches VideoHistoryItem id
  scriptData: any; // using any to avoid circular imports of ScriptData if needed
  storyboardImages: Record<number, string>;
  sceneAudioUrls: Record<number, string>;
  sceneVideoUrls: Record<number, string>;
  sceneDurations: Record<number, number>;
  musicUrl: string | null;
  finalVideoUrl: string | null;
};

const HISTORY_KEY = "link2video_history";
const IDB_DB_NAME = "link2video_db";
const IDB_STORE_NAME = "projects";
const MAX_ITEMS = 20;
const MAX_THUMBNAIL_BYTES = 80000; // 80KB final compressed limit per item

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
    // Deduplicate by title+createdAt within 5 seconds (handles StrictMode double-saves)
    const seen = new Set<string>();
    return items.filter((item) => {
      const ts = Math.floor(new Date(item.createdAt).getTime() / 5000);
      const key = `${item.title}::${ts}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
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
    };
    const existing = getHistory().filter((h) => h.id !== safe.id);
    const updated = [safe, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function deleteFromHistory(id: string): void {
  try {
    const updated = getHistory().filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    deleteProjectState(id); // Clean up IndexedDB space
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
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(state);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save project state to IndexedDB", err);
  }
}

export async function loadProjectState(id: string): Promise<ProjectState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to load project state from IndexedDB", err);
    return null;
  }
}

export async function deleteProjectState(id: string): Promise<void> {
  try {
    const db = await openDB();
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
