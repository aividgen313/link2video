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
    storyboardImages: Record<number, string>;
    sceneAudioUrls: Record<number, string>;
    sceneVideoUrls: Record<number, string>;
    finalVideoUrl: string | null;
  }
): Promise<{
  storyboardImages: Record<number, string>;
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

  for (const [sceneId, url] of Object.entries(assets.storyboardImages)) {
    uploads.push(
      uploadToCloud(url, `projects/${projectId}/images/scene_${sceneId}.jpg`).then(
        (cloudUrl) => { result.storyboardImages[Number(sceneId)] = cloudUrl; }
      )
    );
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
