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

const HISTORY_KEY = "link2video_history";
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
  } catch {}
}
