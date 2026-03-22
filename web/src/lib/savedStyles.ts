export interface SavedStyle {
  id: string;
  styleName: string;
  narrativeStyle: string;
  visualStyle: string;
  pacing: string;
  toneKeywords: string[];
  hookStyle: string;
  transitionStyle: string;
  narrationStyle: string;
  sceneStructure: string;
  visualPromptSuffix: string;
  description: string;
  sourceVideoId?: string;
  sourceVideoTitle?: string;
  sourceChannel?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

const STORAGE_KEY = "link2video_saved_styles";

export function getSavedStyles(): SavedStyle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStyle(style: SavedStyle): void {
  const styles = getSavedStyles();
  // Replace if same ID exists
  const idx = styles.findIndex(s => s.id === style.id);
  if (idx >= 0) styles[idx] = style;
  else styles.unshift(style);
  // Keep max 20
  if (styles.length > 20) styles.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
}

export function deleteStyle(id: string): void {
  const styles = getSavedStyles().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
}
