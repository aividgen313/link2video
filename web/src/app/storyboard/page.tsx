"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";

type ImgStatus = "queued" | "loading" | "done" | "error";

export default function StoryboardPreview() {
  const router = useRouter();
  const { scriptData, storyboardImages, setStoryboardImages } = useAppContext();
  const [statuses, setStatuses] = useState<Record<number, { status: ImgStatus; url?: string | undefined }>>({});
  const [hasMounted, setHasMounted] = useState(false);
  const abortRefs = useRef<Record<number, AbortController>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    setHasMounted(true);
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    if (!scriptData || scriptData.scenes.length === 0) {
      router.replace("/script");
      return;
    }

    // Initialize statuses
    const init: Record<number, { status: ImgStatus; url?: string }> = {};
    scriptData.scenes.forEach((s) => {
      init[s.id] = storyboardImages[s.id]
        ? { status: "done", url: storyboardImages[s.id] }
        : { status: "queued" };
    });
    setStatuses(init);

    // Generate images in batches of 3
    const scenes = scriptData.scenes.filter((s) => !storyboardImages[s.id]);
    generateInBatches(scenes);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  const generateImage = async (sceneId: number, prompt: string) => {
    if (!isMountedRef.current) return;

    const controller = new AbortController();
    abortRefs.current[sceneId] = controller;

    setStatuses((prev) => ({ ...prev, [sceneId]: { status: "loading" } }));

    try {
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: 1280, height: 720 }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!isMountedRef.current) return;

      if (data.success && data.images?.[0]?.imageURL) {
        const url = data.images[0].imageURL;
        setStatuses((prev) => ({ ...prev, [sceneId]: { status: "done", url } }));
        setStoryboardImages({ ...storyboardImages, [sceneId]: url });
      } else {
        setStatuses((prev) => ({ ...prev, [sceneId]: { status: "error" } }));
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      if (isMountedRef.current) {
        setStatuses((prev) => ({ ...prev, [sceneId]: { status: "error" } }));
      }
    }
  };

  const generateInBatches = async (scenes: NonNullable<typeof scriptData>["scenes"]) => {
    const BATCH_SIZE = 3;
    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
      if (!isMountedRef.current) break;
      const batch = scenes.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((s) => generateImage(s.id, s.visual_prompt))
      );
    }
  };

  const regenerateScene = (sceneId: number, prompt: string) => {
    // Cancel any in-flight request
    abortRefs.current[sceneId]?.abort();
    // Remove from storyboard cache
    const updated = { ...storyboardImages };
    delete updated[sceneId];
    setStoryboardImages(updated);
    generateImage(sceneId, prompt);
  };

  if (!hasMounted) return null;
  if (!scriptData) return null;

  const total = scriptData.scenes.length;
  const doneCount = Object.values(statuses).filter((s) => s.status === "done").length;
  const allReady = doneCount === total;
  const anyLoading = Object.values(statuses).some((s) => s.status === "loading" || s.status === "queued");

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/script" className="text-outline hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          Script
        </Link>
        <span className="material-symbols-outlined text-outline-variant text-sm">chevron_right</span>
        <span className="font-bold text-on-surface">Storyboard</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-3 border border-primary/20">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>view_comfy</span>
            <span className="text-[10px] uppercase font-bold tracking-widest">Visual Preview</span>
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight">Storyboard</h2>
          <p className="text-outline text-sm mt-1">Review and approve all scene images before generating your video.</p>
        </div>

        {/* Progress + CTA */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-32 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
            <span className="font-bold text-on-surface text-xs">{doneCount}/{total}</span>
          </div>
          <button
            onClick={() => router.push("/generate")}
            disabled={anyLoading}
            className="primary-gradient text-white font-headline font-bold px-8 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {anyLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Images...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
                {allReady ? "Approve & Generate Video" : `Generate Video (${doneCount}/${total} ready)`}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scene Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-20">
        {scriptData.scenes.map((scene, index) => {
          const st = statuses[scene.id];
          const isLoading = !st || st.status === "loading" || st.status === "queued";
          const isError = st?.status === "error";
          const isDone = st?.status === "done";

          return (
            <div key={scene.id} className="glass-card rounded-2xl overflow-hidden group">
              {/* Image Area */}
              <div className="relative aspect-video bg-surface-container-highest">
                {isDone && st.url ? (
                  <img
                    src={st.url}
                    alt={`Scene ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : isError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-error text-3xl">broken_image</span>
                    <span className="text-xs text-error">Failed</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs text-outline">Generating...</span>
                  </div>
                )}

                {/* Overlays */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    {scene.duration_estimate_seconds}s
                  </span>
                </div>

                {/* Status badge */}
                {isDone && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check</span>
                      Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <p className="text-xs text-on-surface/80 leading-relaxed line-clamp-2 italic">
                  &ldquo;{scene.narration}&rdquo;
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-outline line-clamp-1 flex-1">
                    {scene.visual_prompt}
                  </p>
                  <button
                    onClick={() => regenerateScene(scene.id, scene.visual_prompt)}
                    disabled={!isDone && !isError}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass text-xs font-medium text-outline hover:text-primary transition-all disabled:opacity-40"
                    title="Regenerate this scene"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Redo
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
