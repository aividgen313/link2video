import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// Allow up to 3 minutes for video stitching (default is 30s)
export const maxDuration = 180;
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

type TransitionType = "none" | "fade" | "dissolve" | "wipe-left" | "wipe-right" | "zoom-in" | "zoom-out" | "slide-left" | "slide-right";

/**
 * Server-side video stitching using system ffmpeg.
 * Ken Burns zoompan for image-only scenes.
 * AI Video clips with scale/crop.
 * Crossfade transitions between clips.
 * Strict audio-video sync enforcement.
 */
export async function POST(req: NextRequest) {
  const workDir = join(tmpdir(), `stitch_${randomUUID()}`);
  try {
    await mkdir(workDir, { recursive: true });

    const body = await req.json();
    const {
      scenes,       // Array<{ image, audio?, video?, duration, narration?, transition?, transitionDuration? }>
      resolution,
      musicUrl,
      userAudioDataUrl,
      captionsEnabled,
    } = body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const W = resolution?.width ?? 1280;
    const H = resolution?.height ?? 720;
    const FPS = 25;

    // ── Step 1: Render individual clips ─────────────────────────────────────
    const clipPaths: string[] = [];
    const clipDurations: number[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      // Use audio duration as ground truth when available; clamp to >= 3s
      const dur = Math.max(Math.ceil(scene.duration ?? 8), 3);

      // Write image
      const imgPath = join(workDir, `img_${i}.jpg`);
      if (typeof scene.image === "string" && scene.image.startsWith("data:")) {
        const b64 = scene.image.replace(/^data:[^;]+;base64,/, "");
        await writeFile(imgPath, Buffer.from(b64, "base64"));
      } else if (typeof scene.image === "string") {
        const r = await fetch(scene.image, { signal: AbortSignal.timeout(15_000) });
        if (!r.ok) throw new Error(`Image fetch failed for scene ${i}: ${r.status}`);
        await writeFile(imgPath, Buffer.from(await r.arrayBuffer()));
      }

      // Write audio
      const audPath = join(workDir, `aud_${i}.mp3`);
      let hasAudio = false;
      if (scene.audio) {
        const b64 = (scene.audio as string).replace(/^data:[^;]+;base64,/, "");
        await writeFile(audPath, Buffer.from(b64, "base64"));
        hasAudio = true;
      }

      // Write video if present
      const vidPath = join(workDir, `vid_${i}.mp4`);
      let hasVideo = false;
      if (typeof scene.video === "string") {
        try {
          if (scene.video.startsWith("data:")) {
            const b64 = scene.video.replace(/^data:[^;]+;base64,/, "");
            await writeFile(vidPath, Buffer.from(b64, "base64"));
            hasVideo = true;
          } else {
            const vRes = await fetch(scene.video, { signal: AbortSignal.timeout(45_000) });
            if (vRes.ok) {
              await writeFile(vidPath, Buffer.from(await vRes.arrayBuffer()));
              hasVideo = true;
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch video for scene ${i}, falling back to Ken Burns image.`);
        }
      }

      // ── Render scene clip with strict duration enforcement ──────────
      const clipPath = join(workDir, `clip_${i}.mp4`);
      let cmd: string;

      if (hasVideo) {
        const vfScale = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(in_w-${W})/2:(in_h-${H})/2`;
        if (hasAudio) {
          // Use -t to enforce exact duration on BOTH streams — prevents drift
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-i "${vidPath}"`,
            `-i "${audPath}"`,
            `-vf "${vfScale}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r ${FPS}`,
            `-c:a aac -b:a 96k -t ${dur} -shortest`,
            `"${clipPath}"`
          ].join(" ");
        } else {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-i "${vidPath}"`,
            `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
            `-vf "${vfScale}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r ${FPS}`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      } else {
        // Ken Burns zoom-pan effect from image
        const videoFilter = `scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * FPS}:s=${W}x${H}:fps=${FPS}`;
        if (hasAudio) {
          // Loop image for dur, then enforce -t to keep audio and video in lock-step
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-loop 1 -t ${dur} -i "${imgPath}"`,
            `-i "${audPath}"`,
            `-vf "${videoFilter}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r ${FPS}`,
            `-c:a aac -b:a 96k -t ${dur} -shortest`,
            `"${clipPath}"`
          ].join(" ");
        } else {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-loop 1 -t ${dur} -i "${imgPath}"`,
            `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
            `-vf "${videoFilter}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r ${FPS}`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      }

      console.log(`[/api/stitch] Rendering clip ${i + 1}/${scenes.length} (video=${hasVideo}, duration=${dur}s)...`);
      await execAsync(cmd, { timeout: 120_000 });
      console.log(`[/api/stitch] Finished clip ${i + 1}/${scenes.length}`);
      clipPaths.push(clipPath);
      clipDurations.push(dur);
    }

    // ── Step 2: Concatenate clips with transitions ──────────────────────────
    console.log(`[/api/stitch] Assembling ${clipPaths.length} clips...`);
    const masterPath = join(workDir, "master.mp4");

    // Check if any scene has a transition
    const hasTransitions = scenes.some(
      (s: any, i: number) => i > 0 && s.transition && s.transition !== "none"
    );

    if (hasTransitions && clipPaths.length >= 2) {
      // Use xfade filter for crossfade transitions between clips
      await assembleWithTransitions(clipPaths, scenes, clipDurations, masterPath, workDir, W, H, FPS);
    } else {
      // Simple concat (fast, no re-encoding)
      const concatTxt = join(workDir, "concat.txt");
      await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
      await execAsync(
        `ffmpeg -y -loglevel error -f concat -safe 0 -i "${concatTxt}" -c copy "${masterPath}"`,
        { timeout: 120_000 }
      );
    }

    // ── Step 3: Mix background music or user audio ─────────────────────────
    const outputPath = join(workDir, "output.mp4");

    if (userAudioDataUrl && typeof userAudioDataUrl === "string") {
      try {
        console.log(`[/api/stitch] Writing user audio for music-video mode...`);
        const userAudioPath = join(workDir, "user_audio.mp3");
        const base64Match = userAudioDataUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          await writeFile(userAudioPath, Buffer.from(base64Match[1], "base64"));
        } else {
          const uRes = await fetch(userAudioDataUrl, { signal: AbortSignal.timeout(15_000) });
          if (uRes.ok) await writeFile(userAudioPath, Buffer.from(await uRes.arrayBuffer()));
        }
        console.log(`[/api/stitch] Overlaying user audio as primary track...`);
        await execAsync([
          `ffmpeg -y -loglevel error`,
          `-i "${masterPath}" -i "${userAudioPath}"`,
          `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`
        ].join(" "), { timeout: 60_000 });
      } catch (err) {
        console.error(`[/api/stitch] User audio overlay failed:`, err);
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
      }
    } else if (musicUrl && typeof musicUrl === "string") {
      try {
        console.log(`[/api/stitch] Downloading background music...`);
        const musicPath = join(workDir, "music.mp3");
        const mRes = await fetch(musicUrl, { signal: AbortSignal.timeout(15_000) });
        if (mRes.ok) {
          await writeFile(musicPath, Buffer.from(await mRes.arrayBuffer()));
          console.log(`[/api/stitch] Mixing music with fade-out into final output...`);
          // Add fade-out on music in last 3 seconds for smooth ending
          await execAsync([
            `ffmpeg -y -loglevel error`,
            `-i "${masterPath}" -i "${musicPath}"`,
            `-filter_complex "[1:a]volume=0.18,afade=t=out:st=-3:d=3[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=3[a]"`,
            `-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`
          ].join(" "), { timeout: 60_000 });
        } else {
          await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
        }
      } catch {
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
      }
    } else {
      await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
    }

    console.log(`[/api/stitch] Success! Streaming MP4 payload back to client...`);

    const videoData = await readFile(outputPath);
    return new NextResponse(videoData, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": videoData.length.toString(),
        "Content-Disposition": `attachment; filename="video.mp4"`,
      },
    });

  } catch (err) {
    console.error("[/api/stitch] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stitching failed" },
      { status: 500 }
    );
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Transition assembly ────────────────────────────────────────────────────
// Uses ffmpeg xfade (video) + acrossfade (audio) filters for smooth transitions.
// Falls back to simple concat if xfade fails (older ffmpeg versions).

async function assembleWithTransitions(
  clipPaths: string[],
  scenes: any[],
  durations: number[],
  outputPath: string,
  workDir: string,
  W: number,
  H: number,
  FPS: number,
) {
  // Map transition types to xfade names
  const xfadeMap: Record<string, string> = {
    fade: "fade",
    dissolve: "dissolve",
    "wipe-left": "wipeleft",
    "wipe-right": "wiperight",
    "zoom-in": "smoothup",
    "zoom-out": "smoothdown",
    "slide-left": "slideleft",
    "slide-right": "slideright",
  };

  // Build chain of xfade filters
  // For N clips: N-1 transitions, each consuming 2 inputs
  const n = clipPaths.length;
  const inputs = clipPaths.map((p, i) => `-i "${p}"`).join(" ");

  // Calculate offsets (when each transition starts)
  // offset[i] = cumulative duration up to clip i, minus transition overlap
  let cumulativeOffset = 0;
  const vFilters: string[] = [];
  const aFilters: string[] = [];

  for (let i = 0; i < n - 1; i++) {
    const transition: TransitionType = scenes[i + 1]?.transition || "fade";
    const transDur = Math.min(scenes[i + 1]?.transitionDuration || 0.5, 1.0); // cap at 1s for stability
    const xfadeName = xfadeMap[transition] || "fade";

    const offset = Math.max(durations[i] - transDur, 1); // ensure at least 1s before transition

    const vIn = i === 0 ? `[0:v]` : `[vfade${i}]`;
    const aIn = i === 0 ? `[0:a]` : `[afade${i}]`;
    const vOut = i === n - 2 ? `[vout]` : `[vfade${i + 1}]`;
    const aOut = i === n - 2 ? `[aout]` : `[afade${i + 1}]`;

    const totalOffset = i === 0 ? offset : cumulativeOffset;
    if (i === 0) {
      cumulativeOffset = offset;
    } else {
      cumulativeOffset += durations[i] - transDur;
    }

    vFilters.push(`${vIn}[${i + 1}:v]xfade=transition=${xfadeName}:duration=${transDur}:offset=${totalOffset}${vOut}`);
    aFilters.push(`${aIn}[${i + 1}:a]acrossfade=d=${transDur}:c1=tri:c2=tri${aOut}`);
  }

  if (vFilters.length === 0) {
    // Single clip — just copy
    const concatTxt = join(workDir, "concat.txt");
    await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
    await execAsync(
      `ffmpeg -y -loglevel error -f concat -safe 0 -i "${concatTxt}" -c copy "${outputPath}"`,
      { timeout: 120_000 }
    );
    return;
  }

  const filterComplex = [...vFilters, ...aFilters].join(";");
  const cmd = [
    `ffmpeg -y -loglevel error`,
    inputs,
    `-filter_complex "${filterComplex}"`,
    `-map "[vout]" -map "[aout]"`,
    `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r ${FPS}`,
    `-c:a aac -b:a 96k`,
    `"${outputPath}"`,
  ].join(" ");

  try {
    console.log(`[/api/stitch] Applying transitions between ${n} clips...`);
    await execAsync(cmd, { timeout: 120_000 });
  } catch (e) {
    // xfade failed (maybe old ffmpeg version) — fall back to simple concat
    console.warn(`[/api/stitch] xfade transitions failed, falling back to simple concat:`, e);
    const concatTxt = join(workDir, "concat.txt");
    await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
    await execAsync(
      `ffmpeg -y -loglevel error -f concat -safe 0 -i "${concatTxt}" -c copy "${outputPath}"`,
      { timeout: 120_000 }
    );
  }
}
