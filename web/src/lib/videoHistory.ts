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
const MAX_THUMBNAIL_BYTES = 150000; // 150KB base64 limit per item

export function getHistory(): VideoHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(item: VideoHistoryItem): void {
  try {
    // Trim large thumbnails before saving
    const safe: VideoHistoryItem = {
      ...item,
      thumbnailUrl: item.thumbnailUrl && item.thumbnailUrl.length < MAX_THUMBNAIL_BYTES
        ? item.thumbnailUrl
        : undefined,
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
