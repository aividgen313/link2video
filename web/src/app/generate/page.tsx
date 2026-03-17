"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAppContext, Scene } from "@/context/AppContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useRef } from "react";

type SceneStatus = {
  phase: "queued" | "image" | "video" | "complete" | "error";
  imageURL?: string;
  imageUUID?: string;
  videoURL?: string;
  error?: string;
  progress: number;
};

export default function VideoGeneration() {
  const { scriptData, finalVideoUrl, setFinalVideoUrl } = useAppContext();
  const [progress, setProgress] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [sceneStatuses, setSceneStatuses] = useState<Record<number, SceneStatus>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [stitchStatus, setStitchStatus] = useState<string>("");
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
  }, []);

  const updateSceneStatus = useCallback((sceneId: number, update: Partial<SceneStatus>) => {
    setSceneStatuses(prev => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], ...update },
    }));
  }, []);

  // Generate image for a scene
  const generateSceneImage = useCallback(async (scene: Scene): Promise<{ imageURL: string; imageUUID: string } | null> => {
    try {
      updateSceneStatus(scene.id, { phase: "image", progress: 20 });
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visual_prompt,
          width: 1280,
          height: 720,
          numberResults: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.images?.[0]) {
        const img = data.images[0];
        updateSceneStatus(scene.id, { phase: "image", progress: 40, imageURL: img.imageURL, imageUUID: img.imageUUID });
        return { imageURL: img.imageURL, imageUUID: img.imageUUID };
      }
      throw new Error(data.error || "Image generation failed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Image generation failed";
      updateSceneStatus(scene.id, { phase: "error", error: errorMsg });
      return null;
    }
  }, [updateSceneStatus]);

  // Generate video for a scene
  const generateSceneVideo = useCallback(async (scene: Scene, imageUUID?: string): Promise<string | null> => {
    try {
      updateSceneStatus(scene.id, { phase: "video", progress: 60 });
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visual_prompt,
          duration: Math.min(scene.duration_estimate_seconds, 10),
          width: 1280,
          height: 720,
          imageUUID,
        }),
      });
      const data = await res.json();
      if (data.success && data.videoUrl) {
        updateSceneStatus(scene.id, { phase: "complete", progress: 100, videoURL: data.videoUrl });
        return data.videoUrl;
      } else if (data.success && data.status === "processing") {
        // Async processing — mark as complete for now
        updateSceneStatus(scene.id, { phase: "complete", progress: 100 });
        return null;
      }
      throw new Error(data.error || "Video generation failed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Video generation failed";
      updateSceneStatus(scene.id, { phase: "error", error: errorMsg });
      return null;
    }
  }, [updateSceneStatus]);

  // Generate background music
  const generateMusic = useCallback(async () => {
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `cinematic background music for a video about: ${scriptData?.title || "a documentary"}`,
          duration: 30,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioUrl) {
        setMusicUrl(data.audioUrl);
      }
    } catch (err) {
      console.error("Music generation error:", err);
    }
  }, [scriptData?.title]);

  // Main generation pipeline
  useEffect(() => {
    if (!scriptData || isGenerating || finalVideoUrl) return;

    const runPipeline = async () => {
      setIsGenerating(true);

      // Initialize all scenes as queued
      const initialStatuses: Record<number, SceneStatus> = {};
      scriptData.scenes.forEach(s => {
        initialStatuses[s.id] = { phase: "queued", progress: 0 };
      });
      setSceneStatuses(initialStatuses);

      // Start music generation in parallel
      generateMusic();

      const videoUrls: string[] = [];

      // Process scenes sequentially
      for (let i = 0; i < scriptData.scenes.length; i++) {
        const scene = scriptData.scenes[i];
        setActiveSceneIndex(i);

        // Step 1: Generate image
        const imageResult = await generateSceneImage(scene);

        // Step 2: Generate video from the image
        const videoUrl = await generateSceneVideo(scene, imageResult?.imageUUID);
        if (videoUrl) {
          videoUrls.push(videoUrl);
        }

        // Update overall progress
        const newProgress = Math.round(((i + 1) / scriptData.scenes.length) * 100);
        setProgress(newProgress);
      }

      // Step 3: Stitch all videos together using FFmpeg built into the browser
      if (videoUrls.length > 0) {
        try {
          updateSceneStatus(scriptData.scenes[scriptData.scenes.length - 1].id, { phase: "complete", progress: 100 });
          setStitchStatus("Loading FFmpeg engine...");
          
          const ffmpeg = ffmpegRef.current;
          if (!ffmpeg) throw new Error("FFmpeg not initialized properly on client");
          
          if (!ffmpeg.loaded) {
            await ffmpeg.load({
              coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
              wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"
            });
          }

          setStitchStatus("Downloading media files...");
          const concatList: string[] = [];

          // Download all videos to FFmpeg's virtual FS
          for (let index = 0; index < videoUrls.length; index++) {
            const vUrl = videoUrls[index];
            const fileName = `vid${index}.mp4`;
            await ffmpeg.writeFile(fileName, await fetchFile(vUrl));
            concatList.push(`file '${fileName}'`);
          }

          // Create concat demuxer text file
          await ffmpeg.writeFile('concat.txt', concatList.join('\n'));

          let cmd = ['-f', 'concat', '-safe', '0', '-i', 'concat.txt'];

          if (musicUrl) {
            setStitchStatus("Adding audio track...");
            await ffmpeg.writeFile('music.mp3', await fetchFile(musicUrl));
            cmd.push('-i', 'music.mp3');
            // Copy video codec from concatenated input, encode audio input to aac
            // map video from the concat stream (0:v), map audio from the music stream (1:a)
            // Use shortest to truncate video or audio to the shortest length.
            cmd.push('-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', 'output.mp4');
          } else {
            setStitchStatus("Merging video clips...");
            cmd.push('-c', 'copy', 'output.mp4');
          }

          setStitchStatus("Rendering final video...");
          await ffmpeg.exec(cmd);
          
          setStitchStatus("Finalizing file...");
          const fileData = await ffmpeg.readFile('output.mp4');
          const data = fileData as Uint8Array;
          const blobUrl = URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' }));

          setFinalVideoUrl(blobUrl);
          setStitchStatus("");
        } catch (err) {
          console.error("FFmpeg Stitch error:", err);
          setStitchStatus("Error stitching video: " + (err as Error).message);
        }
      }

      setProgress(100);
      setIsGenerating(false);
    };

    runPipeline();
  // Run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptData]);

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/script" className="text-outline hover:text-primary transition-colors">Script Builder</Link>
          <span className="material-symbols-outlined text-outline-variant text-sm">chevron_right</span>
          <span className="font-headline font-bold text-on-surface">Video Generation</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="p-2 text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header & Global Progress */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="font-headline text-display-lg text-4xl font-extrabold tracking-tight">Video Generation</h2>
              <div className="flex items-center gap-3 text-outline">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>crop_16_9</span>
                <span className="font-label text-xs uppercase tracking-widest">Landscape • 1280x720 • Runware AI</span>
              </div>
            </div>
            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-semibold text-primary">Rendering Progress</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-tighter">Runware</span>
                </div>
                <span className="font-headline text-2xl font-bold">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_12px_rgba(75,142,255,0.4)] transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Bento Layout for Generation Details */}
          <div className="grid grid-cols-12 gap-6 pb-20">
            {/* Main Preview Player */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="relative aspect-video rounded-xl bg-surface-container-lowest overflow-hidden group border border-outline-variant/10">
                {finalVideoUrl ? (
                  <video src={finalVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                ) : (
                  <>
                    {/* Show the latest generated scene image as preview */}
                    {(() => {
                      const activeStatus = scriptData?.scenes[activeSceneIndex] 
                        ? sceneStatuses[scriptData.scenes[activeSceneIndex].id] 
                        : undefined;
                      if (activeStatus?.imageURL) {
                        return <img alt="Scene Preview" className="w-full h-full object-cover" src={activeStatus.imageURL} />;
                      }
                      return (
                        <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-outline/30">movie</span>
                        </div>
                      );
                    })()}
                    
                    {/* Overlay Controls */}
                    <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        <span className="bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/30">Generating</span>
                      </div>
                    </div>

                    {/* Loading Overlay for active generation */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary">auto_fix_high</span>
                        </div>
                        <p className="font-body text-sm font-medium text-on-surface drop-shadow-md">
                          {stitchStatus ? (
                            stitchStatus
                          ) : (
                            (() => {
                              const activeStatus = scriptData?.scenes[activeSceneIndex]
                                ? sceneStatuses[scriptData.scenes[activeSceneIndex].id]
                                : undefined;
                              if (activeStatus?.phase === "image") return `Generating image for scene ${activeSceneIndex + 1}...`;
                              if (activeStatus?.phase === "video") return `Creating video for scene ${activeSceneIndex + 1}...`;
                              return `Processing scene ${activeSceneIndex + 1}...`;
                            })()
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-surface-container-high/50 backdrop-blur-2xl rounded-xl border border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <button className="px-6 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform">
                    <span className="material-symbols-outlined">download</span>
                    Download Video
                  </button>
                  <button className="px-6 py-3 rounded-xl bg-surface-container-highest text-on-surface font-headline font-bold flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant/20">
                    <span className="material-symbols-outlined">description</span>
                    Export Prompts
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {musicUrl && (
                    <span className="text-primary text-xs uppercase font-label tracking-widest px-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">music_note</span>
                      Music Ready
                    </span>
                  )}
                  <span className="text-outline text-xs uppercase font-label tracking-widest px-3">Quality: HD</span>
                </div>
              </div>
            </div>

            {/* Scenes List Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-4 h-[calc(100vh-280px)] flex flex-col">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-lg font-bold">Generated Scenes</h3>
                <span className="text-tertiary bg-tertiary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">Runware AI</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                
                {scriptData?.scenes.map((scene, i) => {
                  const status = sceneStatuses[scene.id];
                  const isComplete = status?.phase === "complete";
                  const isActive = (status?.phase === "image" || status?.phase === "video");
                  const isError = status?.phase === "error";
                  
                  if (isComplete) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer">
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-container-lowest relative flex-shrink-0">
                          {status?.imageURL ? (
                            <img src={status.imageURL} alt={`Scene ${i+1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-lg">check_circle</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1 min-w-0">
                              <h4 className="font-body text-sm font-semibold truncate">{String(i + 1).padStart(2, '0')}. Scene</h4>
                              <span className="text-[9px] font-medium text-primary/70 bg-primary/5 px-1 rounded flex-shrink-0">✓</span>
                            </div>
                            <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                          </div>
                          <p className="text-xs text-outline line-clamp-1 mt-1 italic">&quot;{scene.narration}&quot;</p>
                        </div>
                      </div>
                    );
                  } else if (isActive) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-surface-container-highest border border-primary/40 flex items-start gap-4 shadow-lg shadow-primary/5">
                        <div className="w-20 h-14 rounded-lg bg-surface-container-lowest relative flex-shrink-0 overflow-hidden">
                          {status?.imageURL ? (
                            <img src={status.imageURL} alt={`Scene ${i+1}`} className="w-full h-full object-cover opacity-60" />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <h4 className="font-body text-sm font-semibold text-primary truncate">
                                {String(i + 1).padStart(2, '0')}. {status?.phase === "image" ? "Generating Image" : "Creating Video"}
                              </h4>
                              <span className="text-[9px] font-medium text-primary/70 bg-primary/10 px-1 rounded border border-primary/20 flex-shrink-0">Runware</span>
                            </div>
                          </div>
                          <div className="w-full h-1 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500" style={{ width: `${status?.progress || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (isError) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-error-container/10 border border-error/20 flex items-start gap-4">
                        <div className="w-20 h-14 rounded-lg bg-error/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-error">error</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-body text-sm font-semibold text-error truncate">{String(i + 1).padStart(2, '0')}. Error</h4>
                          <p className="text-xs text-error/70 mt-1 line-clamp-1">{status?.error}</p>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/5 flex items-start gap-4 opacity-60">
                        <div className="w-20 h-14 rounded-lg bg-surface-container-lowest flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-outline">hourglass_empty</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1 min-w-0">
                              <h4 className="font-body text-sm font-semibold truncate text-outline">{String(i + 1).padStart(2, '0')}. Queued</h4>
                            </div>
                            <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                          </div>
                          <p className="text-xs text-outline/50 line-clamp-1 mt-1">Waiting for Runware...</p>
                        </div>
                      </div>
                    );
                  }
                })}

              </div>
              
              {/* Secondary Sidebar Action */}
              <div className="mt-4 p-4 bg-surface-container-high rounded-xl border-t-2 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-on-surface">Powered by Runware</p>
                    <p className="text-[10px] text-outline">Image → Video pipeline with FLUX & Kling AI</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
