"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAppContext, Scene, QUALITY_TIERS, VIDEO_DIMENSIONS } from "@/context/AppContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useRef } from "react";

type SceneStatus = {
  phase: "queued" | "image" | "video" | "complete" | "error";
  imageURL?: string;
  imageUUID?: string;
  videoURL?: string;
  audioURL?: string;
  error?: string;
  progress: number;
};

export default function VideoGeneration() {
  const {
    scriptData,
    finalVideoUrl,
    setFinalVideoUrl,
    qualityTier,
    videoDimension,
    selectedVoice,
    musicEnabled,
    creditsUsed, setCreditsUsed,
  } = useAppContext();
  const tier = QUALITY_TIERS[qualityTier];
  const dim = videoDimension || VIDEO_DIMENSIONS[0];
  const [progress, setProgress] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [sceneStatuses, setSceneStatuses] = useState<Record<number, SceneStatus>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [stitchStatus, setStitchStatus] = useState<string>("");
  const [hasMounted, setHasMounted] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
  }, []);

  const updateSceneStatus = useCallback((sceneId: number, update: Partial<SceneStatus>) => {
    setSceneStatuses(prev => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], ...update },
    }));
  }, []);

  // Generate image for a scene via Pollinations
  const generateSceneImage = useCallback(async (scene: Scene): Promise<{ imageURL: string; imageUUID: string } | null> => {
    try {
      updateSceneStatus(scene.id, { phase: "image", progress: 20 });
      const res = await fetch("/api/runware/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.visual_prompt,
          width: 1280,
          height: 768,
        }),
      });

      const data = await res.json();
      if (data.success && data.images?.[0]) {
        const img = data.images[0];
        updateSceneStatus(scene.id, { phase: "image", progress: 50, imageURL: img.imageURL, imageUUID: img.imageUUID });
        return { imageURL: img.imageURL, imageUUID: img.imageUUID };
      }
      throw new Error(data.error || "Image generation failed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Image generation failed";
      updateSceneStatus(scene.id, { phase: "error", error: errorMsg });
      return null;
    }
  }, [updateSceneStatus]);

  // Generate TTS voiceover for a scene via Pollinations
  const generateSceneAudio = useCallback(async (scene: Scene): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scene.narration,
          voice: selectedVoice,
          useEdgeTTS: qualityTier === "basic", // free mode uses Edge TTS
        }),
      });
      const data = await res.json();
      if (data.success && data.audioUrl) {
        updateSceneStatus(scene.id, { audioURL: data.audioUrl });
        return data.audioUrl;
      }
      return null;
    } catch (err) {
      console.error("TTS generation error:", err);
      return null;
    }
  }, [updateSceneStatus]);

  // Generate background music via Pollinations
  const generateMusic = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `cinematic background music for a documentary video about: ${scriptData?.title || "a documentary"}`,
          duration: 60,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioUrl) {
        setMusicUrl(data.audioUrl);
        return data.audioUrl;
      }
      return null;
    } catch (err) {
      console.error("Music generation error:", err);
      return null;
    }
  }, [scriptData?.title]);

  // Main generation pipeline
  useEffect(() => {
    if (!scriptData || isGenerating || finalVideoUrl) return;

    const runPipeline = async () => {
      setIsGenerating(true);
      setProgress(5);

      // Initial statuses
      const initialStatuses: Record<number, SceneStatus> = {};
      scriptData.scenes.forEach(s => {
        initialStatuses[s.id] = { phase: "queued", progress: 0 };
      });
      setSceneStatuses(initialStatuses);

      // Start music generation only if enabled
      const musicPromise = musicEnabled ? generateMusic() : Promise.resolve(null);

      const totalScenes = scriptData.scenes.length;
      let completedScenes = 0;

      // Generate images + TTS for all scenes in parallel
      const sceneResults = scriptData.scenes.map(async (scene, index) => {
        setActiveSceneIndex(index);

        // Start TTS and image generation simultaneously
        const audioPromise = generateSceneAudio(scene);
        const imageResult = await generateSceneImage(scene);
        if (!imageResult) throw new Error(`Scene ${index + 1} image failed`);

        // Mark scene as complete once image is ready
        // (video will be created from image via FFmpeg Ken Burns effect)
        updateSceneStatus(scene.id, { phase: "complete", progress: 100 });

        const audioUrl = await audioPromise;

        completedScenes++;
        setProgress(Math.round(10 + (completedScenes / totalScenes) * 60));

        return { image: imageResult.imageURL, audio: audioUrl, duration: scene.duration_estimate_seconds };
      });

      try {
        setStitchStatus("Generating images & voiceovers...");
        const sceneAssets = await Promise.all(sceneResults);
        const resolvedMusicUrl = await musicPromise;

        setProgress(75);

        if (sceneAssets.length > 0) {
          setStitchStatus("Loading FFmpeg engine...");
          const ffmpeg = ffmpegRef.current;
          if (!ffmpeg) throw new Error("FFmpeg not initialized");

          if (!ffmpeg.loaded) {
            await ffmpeg.load({
              coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
              wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"
            });
          }

          setProgress(80);
          setStitchStatus("Creating video from scenes...");
          const concatList: string[] = [];

          for (let index = 0; index < sceneAssets.length; index++) {
            const asset = sceneAssets[index];
            const imgFile = `img${index}.jpg`;
            const vidFile = `vid${index}.mp4`;
            const mergedFile = `scene${index}.mp4`;
            const sceneDuration = Math.max(asset.duration || 8, 4);

            // Write the image file
            await ffmpeg.writeFile(imgFile, await fetchFile(asset.image));

            // Create video from image with Ken Burns zoom effect using selected dimensions
            const outW = dim.width;
            const outH = dim.height;
            await ffmpeg.exec([
              '-loop', '1',
              '-i', imgFile,
              '-vf', `scale=${outW * 2}:${outH * 2},zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${sceneDuration * 25}:s=${outW}x${outH}:fps=25`,
              '-c:v', 'libx264',
              '-t', String(sceneDuration),
              '-pix_fmt', 'yuv420p',
              '-r', '25',
              vidFile,
            ]);

            // Merge with TTS audio if available
            if (asset.audio) {
              const audFile = `tts${index}.mp3`;
              await ffmpeg.writeFile(audFile, await fetchFile(asset.audio));
              await ffmpeg.exec([
                '-i', vidFile, '-i', audFile,
                '-c:v', 'copy', '-c:a', 'aac',
                '-map', '0:v:0', '-map', '1:a:0',
                '-shortest',
                mergedFile,
              ]);
            } else {
              // Add silent audio track so concat works
              await ffmpeg.exec([
                '-i', vidFile,
                '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                '-c:v', 'copy', '-c:a', 'aac',
                '-t', String(sceneDuration),
                '-shortest',
                mergedFile,
              ]);
            }

            concatList.push(`file '${mergedFile}'`);
            setProgress(80 + Math.round((index + 1) / sceneAssets.length * 10));
            setStitchStatus(`Rendering scene ${index + 1}/${sceneAssets.length}...`);
          }

          setProgress(92);
          setStitchStatus("Joining all scenes...");

          await ffmpeg.writeFile('concat.txt', concatList.join('\n'));
          await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'master.mp4']);

          setProgress(95);

          // Mix background music if available
          if (resolvedMusicUrl) {
            setStitchStatus("Mixing background music...");
            await ffmpeg.writeFile('music.mp3', await fetchFile(resolvedMusicUrl));
            await ffmpeg.exec([
              '-i', 'master.mp4', '-i', 'music.mp3',
              '-filter_complex', '[1:a]volume=0.15[bgm]; [0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]',
              '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', 'output.mp4'
            ]);
          } else {
            await ffmpeg.exec(['-i', 'master.mp4', '-c', 'copy', 'output.mp4']);
          }

          const fileData = await ffmpeg.readFile('output.mp4');
          const uint8Array = new Uint8Array(fileData as unknown as ArrayBuffer);
          setFinalVideoUrl(URL.createObjectURL(new Blob([uint8Array], { type: 'video/mp4' })));
          setStitchStatus("");
          setProgress(100);
          // Track credits used
          const creditsForThis = tier.creditsPerScene * sceneAssets.length;
          setCreditsUsed(creditsUsed + creditsForThis);
        }
      } catch (err) {
        console.error("Pipeline error:", err);
        setStitchStatus("Error: " + (err as Error).message);
      } finally {
        setIsGenerating(false);
      }
    };

    runPipeline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptData, finalVideoUrl]);

  if (!hasMounted) return null;

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
              <div className="flex flex-wrap items-center gap-2 text-outline">
                <span className={`font-label text-xs uppercase tracking-widest px-2 py-0.5 rounded-full ${tier.bgColor} ${tier.color} border ${tier.borderColor}`}>{tier.label}</span>
                <span className="font-label text-xs uppercase tracking-widest">{dim.label}</span>
                {musicEnabled && <span className="font-label text-xs text-primary flex items-center gap-1"><span className="material-symbols-outlined text-xs">music_note</span>Music On</span>}
              </div>
            </div>
            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-semibold text-primary">Rendering Progress</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-tighter">Free</span>
                </div>
                <span className="font-headline text-2xl font-bold">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_12px_rgba(75,142,255,0.4)] transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Bento Layout */}
          <div className="grid grid-cols-12 gap-6 pb-20">
            {/* Main Preview Player */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="relative aspect-video rounded-xl bg-surface-container-lowest overflow-hidden group border border-outline-variant/10">
                {finalVideoUrl ? (
                  <video src={finalVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                ) : (
                  <>
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

                    <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        <span className="bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/30">Generating</span>
                      </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary">auto_fix_high</span>
                        </div>
                        <p className="font-body text-sm font-medium text-on-surface drop-shadow-md">
                          {stitchStatus || (() => {
                            const activeStatus = scriptData?.scenes[activeSceneIndex]
                              ? sceneStatuses[scriptData.scenes[activeSceneIndex].id]
                              : undefined;
                            if (activeStatus?.phase === "image") return `Generating image for scene ${activeSceneIndex + 1}...`;
                            if (activeStatus?.phase === "video") return `Creating video for scene ${activeSceneIndex + 1}...`;
                            return `Processing scene ${activeSceneIndex + 1}...`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 glass-card rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (finalVideoUrl) {
                        const a = document.createElement('a');
                        a.href = finalVideoUrl;
                        a.download = `${scriptData?.title || 'video'}.mp4`;
                        a.click();
                      }
                    }}
                    disabled={!finalVideoUrl}
                    className="px-6 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <span className="material-symbols-outlined">download</span>
                    Download Video
                  </button>
                  <button
                    onClick={() => {
                      if (!scriptData) return;
                      const promptsData = scriptData.scenes.map((s, i) => ({
                        scene: i + 1,
                        narration: s.narration,
                        visualPrompt: s.visual_prompt,
                        duration: s.duration_estimate_seconds
                      }));
                      const blob = new Blob([JSON.stringify(promptsData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${scriptData.title}-prompts.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    disabled={!scriptData}
                    className="px-6 py-3 rounded-xl bg-surface-container-highest text-on-surface font-headline font-bold flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined">description</span>
                    Export Prompts
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {musicUrl && (
                    <span className="text-primary text-xs uppercase font-label tracking-widest flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">music_note</span>
                      Music
                    </span>
                  )}
                  <div className="text-center">
                    <p className="text-[10px] text-outline uppercase font-label tracking-widest">Credits Used</p>
                    <p className="font-bold text-sm text-on-surface">{qualityTier === "basic" ? "FREE" : `$${(tier.creditsPerScene * (scriptData?.scenes.length || 0)).toFixed(4)}`}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scenes List Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-4 h-[calc(100vh-280px)] flex flex-col">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-lg font-bold">Generated Scenes</h3>
                <span className="text-tertiary bg-tertiary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">Pollinations AI</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">

                {scriptData?.scenes.map((scene, i) => {
                  const status = sceneStatuses[scene.id];
                  const isComplete = status?.phase === "complete";
                  const isActive = (status?.phase === "image" || status?.phase === "video");
                  const isError = status?.phase === "error";

                  if (isComplete) {
                    return (
                      <div key={scene.id} className="p-4 rounded-xl glass-card flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer">
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
                              <span className="text-[9px] font-medium text-primary/70 bg-primary/5 px-1 rounded flex-shrink-0">done</span>
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
                            <h4 className="font-body text-sm font-semibold text-primary truncate">
                              {String(i + 1).padStart(2, '0')}. Generating Image...
                            </h4>
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
                            <h4 className="font-body text-sm font-semibold truncate text-outline">{String(i + 1).padStart(2, '0')}. Queued</h4>
                            <span className="text-[10px] font-bold text-outline ml-2">{scene.duration_estimate_seconds}s</span>
                          </div>
                          <p className="text-xs text-outline/50 line-clamp-1 mt-1">Waiting...</p>
                        </div>
                      </div>
                    );
                  }
                })}

              </div>

              <div className="mt-4 p-4 glass-card rounded-xl border-t-2 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-on-surface">Powered by Pollinations AI</p>
                    <p className="text-[10px] text-outline">Free Image + TTS + Ken Burns Video Pipeline</p>
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
