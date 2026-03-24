"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, QUALITY_TIERS, VIDEO_DIMENSIONS, calculateTotalCost } from "@/context/AppContext";
import { pipelineManager, type PipelineProgressData, type SceneAssetStatus } from "@/lib/pipelineManager";
import SocialCopyPanel from "@/components/SocialCopyPanel";

export default function VideoGeneration() {
  const {
    scriptData,
    finalVideoUrl,
    qualityTier,
    videoDimension,
    musicEnabled,
  } = useAppContext();
  const router = useRouter();
  const tier = QUALITY_TIERS[qualityTier];
  const dim = videoDimension || VIDEO_DIMENSIONS[0];
  const [pipeline, setPipeline] = useState<PipelineProgressData>(pipelineManager.getState());
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => {
    const unsub = pipelineManager.subscribe(setPipeline);
    return () => { unsub(); };
  }, []);

  if (!hasMounted) return null;

  // If pipeline is idle and no final video, redirect to script
  if (pipeline.phase === "idle" && !finalVideoUrl && !scriptData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-6xl text-outline/30 mb-4">movie</span>
        <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No Video to Generate</h3>
        <p className="text-outline text-sm max-w-md mb-6">Create a script first, then generate your video.</p>
        <Link href="/" className="primary-gradient text-white px-6 py-3 rounded-xl font-headline font-bold flex items-center gap-2 shadow-md">
          <span className="material-symbols-outlined">home</span>
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const isRunning = pipeline.phase !== "idle" && pipeline.phase !== "complete" && pipeline.phase !== "error" && pipeline.phase !== "cancelled";
  const isComplete = pipeline.phase === "complete" || !!finalVideoUrl;
  const isError = pipeline.phase === "error";
  const showVideo = finalVideoUrl || pipeline.finalVideoUrl;

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const estimateRemaining = () => {
    if (pipeline.progress <= 0 || pipeline.elapsedTime <= 0) return "";
    const totalEstMs = (pipeline.elapsedTime / pipeline.progress) * 100;
    const remaining = Math.max(0, totalEstMs - pipeline.elapsedTime);
    const sec = Math.floor(remaining / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
  };

  const scenes = scriptData?.scenes || [];
  const sceneIds = Object.keys(pipeline.sceneStatuses).map(Number);

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/script" className="text-outline hover:text-primary transition-colors">Script Builder</Link>
          <span className="material-symbols-outlined text-outline-variant text-sm">chevron_right</span>
          <span className="font-headline font-bold text-on-surface">Video Generation</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header & Progress */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="font-headline text-display-lg text-4xl font-extrabold tracking-tight">Video Generation</h2>
              <div className="flex flex-wrap items-center gap-2 text-outline">
                <span className={`font-label text-xs uppercase tracking-widest px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}>{tier.label}</span>
                <span className="font-label text-xs uppercase tracking-widest">{dim.label}</span>
                {musicEnabled && <span className="font-label text-xs text-primary flex items-center gap-1"><span className="material-symbols-outlined text-xs">music_note</span>Music On</span>}
              </div>
            </div>
            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-semibold text-primary">
                    {isComplete ? "Complete" : isError ? "Error" : "Rendering Progress"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono text-sm text-outline tabular-nums block">{formatElapsed(pipeline.elapsedTime)}</span>
                    {isRunning && pipeline.progress > 0 && (
                      <span className="font-mono text-[10px] text-primary/70 tabular-nums block">{estimateRemaining()}</span>
                    )}
                  </div>
                  <span className="font-headline text-2xl font-bold">{pipeline.progress}%</span>
                </div>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_12px_rgba(75,142,255,0.4)] transition-all duration-500 ease-out"
                  style={{ width: `${pipeline.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bento Layout */}
          <div className="grid grid-cols-12 gap-6 pb-20">
            {/* Main Preview */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="relative aspect-video rounded-xl bg-surface-container-lowest overflow-hidden group border border-outline-variant/10">
                {showVideo ? (
                  <video src={showVideo} controls autoPlay className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary">auto_fix_high</span>
                      </div>
                      <p className="font-body text-sm font-medium text-on-surface drop-shadow-md">{pipeline.status || "Processing..."}</p>
                      {isRunning && pipeline.progress > 0 && (
                        <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-sm">timer</span>
                          <span className="text-white/90 text-xs font-mono tabular-nums">{estimateRemaining()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 glass-card rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const url = finalVideoUrl || pipeline.finalVideoUrl;
                      if (url) {
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${scriptData?.title || "video"}.mp4`;
                        a.click();
                      }
                    }}
                    disabled={!showVideo}
                    className="px-6 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <span className="material-symbols-outlined">download</span>
                    Download Video
                  </button>
                  <button
                    onClick={() => router.push(`/editor?project=${pipeline.projectId || "draft"}`)}
                    disabled={!showVideo}
                    className="px-6 py-3 rounded-xl bg-secondary text-on-secondary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <span className="material-symbols-outlined">movie_edit</span>
                    Open in Editor
                  </button>
                </div>
                {isRunning && (
                  <button
                    onClick={() => pipelineManager.cancel()}
                    className="px-4 py-2 rounded-xl text-error bg-error/10 hover:bg-error/20 border border-error/20 text-sm font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">stop_circle</span>
                    Cancel
                  </button>
                )}
                <div className="text-center">
                  <p className="text-[10px] text-outline uppercase font-label tracking-widest">Est. Cost</p>
                  <p className="font-bold text-sm text-on-surface">
                    {qualityTier === "basic" ? "FREE" : (() => {
                      const total = scenes.length || 0;
                      const cost = calculateTotalCost(qualityTier, total, musicEnabled);
                      return cost > 0.01 ? `~${cost.toFixed(4)} pollen` : "~0.01 pollen";
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Scenes List */}
            <div className="col-span-12 lg:col-span-4 space-y-4 h-[calc(100vh-280px)] flex flex-col">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-lg font-bold">Scene Progress</h3>
                <span className="text-xs text-outline font-mono tabular-nums">{pipeline.completedScenes}/{pipeline.totalScenes}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {scenes.map((scene, i) => {
                  const status: SceneAssetStatus | undefined = pipeline.sceneStatuses[scene.id];
                  const isDone = status?.done;
                  const hasError = status?.error;

                  return (
                    <div
                      key={scene.id}
                      className={`p-4 rounded-xl flex items-start gap-4 transition-all ${
                        isDone
                          ? hasError
                            ? "bg-error-container/10 border border-error/20"
                            : "glass-card"
                          : status?.image
                            ? "bg-surface-container-highest border border-primary/40 shadow-lg shadow-primary/5"
                            : "bg-surface-container-high/50 border border-outline-variant/5 opacity-60"
                      }`}
                    >
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-container-lowest relative flex-shrink-0">
                        {status?.imageUrl ? (
                          <img src={status.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            {isDone && hasError ? (
                              <span className="material-symbols-outlined text-error">error</span>
                            ) : status?.image === false && !isDone ? (
                              <span className="material-symbols-outlined text-outline">hourglass_empty</span>
                            ) : (
                              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            )}
                          </div>
                        )}
                        {status?.videoUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="material-symbols-outlined text-white text-sm">play_circle</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className={`font-body text-sm font-semibold truncate ${hasError ? "text-error" : isDone ? "" : "text-outline"}`}>
                            {String(i + 1).padStart(2, "0")}. {isDone ? (hasError ? "Error" : "Complete") : status?.image ? "Processing..." : "Queued"}
                          </h4>
                          <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                        </div>
                        <p className="text-xs text-outline line-clamp-1 mt-1 italic">&quot;{scene.narration}&quot;</p>
                        {/* Asset indicators */}
                        {status && !hasError && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[9px] font-medium px-1 rounded ${status.image ? "text-green-400 bg-green-400/10" : "text-outline/50 bg-surface-container-high"}`}>IMG</span>
                            <span className={`text-[9px] font-medium px-1 rounded ${status.audio ? "text-green-400 bg-green-400/10" : "text-outline/50 bg-surface-container-high"}`}>TTS</span>
                            <span className={`text-[9px] font-medium px-1 rounded ${status.video ? "text-green-400 bg-green-400/10" : "text-outline/50 bg-surface-container-high"}`}>VID</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Social Copy Panel */}
              {isComplete && scriptData && (
                <SocialCopyPanel scriptData={scriptData} dimension={dim.id} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
