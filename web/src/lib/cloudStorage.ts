/**
 * Upload a base64 data URL to cloud storage via /api/upload.
 * Returns the persistent cloud URL, or falls back to the original dataUrl if upload fails.
 */
export async function uploadToCloud(
  dataUrl: string,
  path: string
): Promise<string> {
  // Skip if already a cloud URL (not a data: or blob: URL)
  if (dataUrl.startsWith("http")) return dataUrl;

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, path }),
    });

    if (!res.ok) {
      // Cloud storage not configured — fall back to data URL (local only)
      console.warn("Cloud upload unavailable, keeping local data URL");
      return dataUrl;
    }

    const data = await res.json();
    if (data.success && data.url) {
      return data.url;
    }
    return dataUrl;
  } catch {
    // Network error — fall back to data URL
    return dataUrl;
  }
}

/**
 * Upload all generated assets for a project to cloud storage.
 * Replaces base64 data URLs with persistent cloud URLs.
 */
export async function uploadProjectAssets(
  projectId: string,
  assets: {
    storyboardImages: Record<number, string[]>;
    sceneAudioUrls: Record<number, string>;
    sceneVideoUrls: Record<number, string>;
    finalVideoUrl: string | null;
  }
): Promise<{
  storyboardImages: Record<number, string[]>;
  sceneAudioUrls: Record<number, string>;
  sceneVideoUrls: Record<number, string>;
  finalVideoUrl: string | null;
}> {
  const result = {
    storyboardImages: { ...assets.storyboardImages },
    sceneAudioUrls: { ...assets.sceneAudioUrls },
    sceneVideoUrls: { ...assets.sceneVideoUrls },
    finalVideoUrl: assets.finalVideoUrl,
  };

  // Upload all assets in parallel (images, audio, video)
  const uploads: Promise<void>[] = [];

  for (const [sceneId, urls] of Object.entries(assets.storyboardImages)) {
    if (Array.isArray(urls)) {
      urls.forEach((url, i) => {
        uploads.push(
          uploadToCloud(url, `projects/${projectId}/images/scene_${sceneId}_frame_${i}.jpg`).then(
            (cloudUrl) => { 
              if (!result.storyboardImages[Number(sceneId)]) result.storyboardImages[Number(sceneId)] = [];
              result.storyboardImages[Number(sceneId)][i] = cloudUrl; 
            }
          )
        );
      });
    } else if (typeof urls === "string") {
      uploads.push(
        uploadToCloud(urls, `projects/${projectId}/images/scene_${sceneId}.jpg`).then(
          (cloudUrl) => { result.storyboardImages[Number(sceneId)] = [cloudUrl]; }
        )
      );
    }
  }

  for (const [sceneId, url] of Object.entries(assets.sceneAudioUrls)) {
    uploads.push(
      uploadToCloud(url, `projects/${projectId}/audio/scene_${sceneId}.mp3`).then(
        (cloudUrl) => { result.sceneAudioUrls[Number(sceneId)] = cloudUrl; }
      )
    );
  }

  for (const [sceneId, url] of Object.entries(assets.sceneVideoUrls)) {
    uploads.push(
      uploadToCloud(url, `projects/${projectId}/video/scene_${sceneId}.mp4`).then(
        (cloudUrl) => { result.sceneVideoUrls[Number(sceneId)] = cloudUrl; }
      )
    );
  }

  // Upload final stitched video
  if (assets.finalVideoUrl && !assets.finalVideoUrl.startsWith("http")) {
    uploads.push(
      uploadToCloud(assets.finalVideoUrl, `projects/${projectId}/final_video.mp4`).then(
        (cloudUrl) => { result.finalVideoUrl = cloudUrl; }
      )
    );
  }

  await Promise.allSettled(uploads);
  return result;
}

/**
 * Save the entire project state and history item to the cloud.
 */
export async function saveProjectToCloud(
  projectId: string,
  state: any,
  historyItem: any
): Promise<boolean> {
  try {
    // 1. Upload the state.json (using raw json field for efficiency)
    await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: state, path: `projects/${projectId}/state.json` }),
    });

    // 2. Update the projects.json index
    const historyRes = await fetch("/api/upload?path=projects.json");
    let cloudHistory: any[] = [];
    if (historyRes.ok) {
      const data = await historyRes.json();
      if (Array.isArray(data)) cloudHistory = data;
      else if (data.success && Array.isArray(data.data)) cloudHistory = data.data; // fallback for old format
    }

    // Merge current item into cloud history (deduplicate)
    const existingIdx = cloudHistory.findIndex(h => h.id === projectId);
    if (existingIdx >= 0) {
      cloudHistory[existingIdx] = { ...cloudHistory[existingIdx], ...historyItem };
    } else {
      cloudHistory.unshift(historyItem);
    }
    // Limit to 50 items in cloud
    cloudHistory = cloudHistory.slice(0, 50);

    // 3. Upload the history (using raw json field for efficiency)
    await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: cloudHistory, path: "projects.json" }),
    });

    return true;
  } catch (err) {
    console.error("Cloud project sync failed:", err);
    return false;
  }
}

/**
 * Fetch the project list from the cloud.
 */
export async function getCloudHistory(): Promise<any[]> {
  try {
    const res = await fetch("/api/upload?path=projects.json");
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data.success && Array.isArray(data.data)) return data.data; // fallback
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetch a specific project state from the cloud.
 */
export async function getCloudProjectState(projectId: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/upload?path=projects/${projectId}/state.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && (data.id || data.scriptData) ? data : data.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * Delete a project and its metadata from the cloud.
 */
export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  try {
    // 1. Remove from projects.json index
    const historyRes = await fetch("/api/upload?path=projects.json");
    if (historyRes.ok) {
      const data = await historyRes.json();
      const list: any[] = Array.isArray(data) ? data : (data.success && Array.isArray(data.data)) ? data.data : [];
      if (list.length > 0) {
        const updated = list.filter((h: any) => h.id !== projectId);
        await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: updated, path: "projects.json" }),
        });
      }
    }
    // 2. Delete the ENTIRE project folder (state.json + all media files)
    await fetch(`/api/upload?path=projects/${projectId}&folder=true`, { method: "DELETE" });
  } catch (err) {
    console.error("Failed to delete project from cloud:", err);
  }
}
