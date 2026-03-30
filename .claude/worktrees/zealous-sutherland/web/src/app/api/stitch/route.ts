import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, rm, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// Allow up to 10 minutes for video stitching
export const maxDuration = 600;
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);
const EXEC_OPTS = { maxBuffer: 10 * 1024 * 1024 }; // 10 MB buffer for ffmpeg output

/** Stream a fetch response to disk instead of buffering in memory */
async function streamToDisk(url: string, destPath: string, timeoutMs = 45_000): Promise<number> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");
  const ws = createWriteStream(destPath);
  // Convert web ReadableStream to Node Readable
  const nodeStream = Readable.fromWeb(res.body as any);
  await pipeline(nodeStream, ws);
  const st = await stat(destPath);
  return st.size;
}

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

    // Cap resolution to 480p to stay within Render free-tier 512MB RAM.
    // FFmpeg's libx264 encoder + input decoder use ~200-300MB for 720p;
    // 480p cuts this roughly in half.
    const reqW = resolution?.width ?? 1280;
    const reqH = resolution?.height ?? 720;
    const MAX_HEIGHT = 480;
    const scale = Math.min(1, MAX_HEIGHT / reqH);
    const W = Math.round((reqW * scale) / 2) * 2; // ensure even
    const H = Math.round((reqH * scale) / 2) * 2;
    const FPS = 24;
    console.log(`[/api/stitch] Resolution: ${reqW}x${reqH} → ${W}x${H} (capped to ${MAX_HEIGHT}p for memory)`);

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

      // Write audio — handle both data URLs and remote URLs
      const audPath = join(workDir, `aud_${i}.mp3`);
      let hasAudio = false;
      if (scene.audio && typeof scene.audio === "string") {
        try {
          if (scene.audio.startsWith("data:")) {
            const b64 = scene.audio.replace(/^data:[^;]+;base64,/, "");
            const buf = Buffer.from(b64, "base64");
            if (buf.length > 100) { // sanity check — valid MP3 is at least a few KB
              await writeFile(audPath, buf);
              hasAudio = true;
            } else {
              console.warn(`[/api/stitch] Scene ${i} audio data too small (${buf.length}b), skipping`);
            }
          } else if (scene.audio.startsWith("http")) {
            const aRes = await fetch(scene.audio, { signal: AbortSignal.timeout(15_000) });
            if (aRes.ok) {
              const buf = Buffer.from(await aRes.arrayBuffer());
              if (buf.length > 100) {
                await writeFile(audPath, buf);
                hasAudio = true;
              } else {
                console.warn(`[/api/stitch] Scene ${i} fetched audio too small (${buf.length}b), skipping`);
              }
            } else {
              console.warn(`[/api/stitch] Scene ${i} audio fetch failed: ${aRes.status}`);
            }
          }
        } catch (audioErr) {
          console.warn(`[/api/stitch] Scene ${i} audio error, will use silent track:`, audioErr);
        }
      }

      // Write video if present — stream to disk to avoid OOM on large files
      const vidPath = join(workDir, `vid_${i}.mp4`);
      let hasVideo = false;
      if (typeof scene.video === "string") {
        try {
          if (scene.video.startsWith("data:")) {
            const b64 = scene.video.replace(/^data:[^;]+;base64,/, "");
            await writeFile(vidPath, Buffer.from(b64, "base64"));
            hasVideo = true;
          } else if (scene.video.startsWith("http")) {
            const size = await streamToDisk(scene.video, vidPath, 60_000);
            if (size > 1000) {
              hasVideo = true;
              console.log(`[/api/stitch] Scene ${i} video downloaded: ${(size / 1024 / 1024).toFixed(1)}MB`);
            } else {
              console.warn(`[/api/stitch] Scene ${i} video too small (${size}b), using Ken Burns`);
            }
          }
        } catch (e) {
          console.warn(`[/api/stitch] Failed to fetch video for scene ${i}, falling back to Ken Burns:`, e);
        }
      }

      // Validate video file with ffprobe before using it
      if (hasVideo) {
        try {
          await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${vidPath}"`, { timeout: 10_000, ...EXEC_OPTS });
        } catch {
          console.warn(`[/api/stitch] Scene ${i} video file is corrupt/unreadable, falling back to Ken Burns`);
          hasVideo = false;
        }
      }

      // Validate audio file with ffprobe before using it — catches corrupt/truncated files
      if (hasAudio) {
        try {
          await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audPath}"`, { timeout: 10_000, ...EXEC_OPTS });
        } catch {
          console.warn(`[/api/stitch] Scene ${i} audio file is corrupt/unreadable, using silent track instead`);
          hasAudio = false;
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
            `-c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -r ${FPS} -threads 1`,
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
            `-c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -r ${FPS} -threads 1`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      } else {
        // Ken Burns zoom-pan effect from image
        const videoFilter = `scale=${W}:${H},zoompan=z='min(zoom+0.002,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * FPS}:s=${W}x${H}:fps=${FPS}`;
        if (hasAudio) {
          // Loop image for dur, then enforce -t to keep audio and video in lock-step
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-loop 1 -t ${dur} -i "${imgPath}"`,
            `-i "${audPath}"`,
            `-vf "${videoFilter}"`,
            `-c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -r ${FPS} -threads 1`,
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
            `-c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -r ${FPS} -threads 1`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      }

      console.log(`[/api/stitch] Rendering clip ${i + 1}/${scenes.length} (video=${hasVideo}, audio=${hasAudio}, duration=${dur}s)...`);
      try {
        await execAsync(cmd, { timeout: 120_000, ...EXEC_OPTS });
      } catch (clipErr: any) {
        console.error(`[/api/stitch] FFmpeg clip ${i + 1} FAILED. stderr: ${clipErr.stderr || "none"}`);
        throw clipErr;
      }
      console.log(`[/api/stitch] Finished clip ${i + 1}/${scenes.length}`);
      clipPaths.push(clipPath);
      clipDurations.push(dur);

      // Clean up source files immediately to free disk/memory for next clip
      await rm(imgPath, { force: true }).catch(() => {});
      await rm(audPath, { force: true }).catch(() => {});
      await rm(vidPath, { force: true }).catch(() => {});
    }

    // ── Step 2: Concatenate clips (simple concat — low memory) ────────────
    console.log(`[/api/stitch] Assembling ${clipPaths.length} clips via concat demuxer...`);
    const masterPath = join(workDir, "master.mp4");

    // Always use simple concat demuxer — xfade holds multiple decoded streams in memory
    // and OOMs on Render's 512MB free tier. Concat with stream copy is near-zero memory.
    const concatTxt = join(workDir, "concat.txt");
    await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
    await execAsync(
      `ffmpeg -y -loglevel warning -f concat -safe 0 -i "${concatTxt}" -c copy "${masterPath}"`,
      { timeout: 180_000, ...EXEC_OPTS }
    );

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
        ].join(" "), { timeout: 60_000, ...EXEC_OPTS });
      } catch (err) {
        console.error(`[/api/stitch] User audio overlay failed:`, err);
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
      }
    } else if (musicUrl && typeof musicUrl === "string") {
      try {
        console.log(`[/api/stitch] Downloading background music...`);
        const musicPath = join(workDir, "music.mp3");
        const mRes = await fetch(musicUrl, { signal: AbortSignal.timeout(15_000) });
        if (mRes.ok) {
          await writeFile(musicPath, Buffer.from(await mRes.arrayBuffer()));
          console.log(`[/api/stitch] Mixing music with fade-out into final output...`);
          await execAsync([
            `ffmpeg -y -loglevel error`,
            `-i "${masterPath}" -i "${musicPath}"`,
            `-filter_complex "[1:a]volume=0.18,afade=t=out:st=-3:d=3[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=3[a]"`,
            `-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`
          ].join(" "), { timeout: 60_000, ...EXEC_OPTS });
        } else {
          await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
        }
      } catch {
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
      }
    } else {
      await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
    }

    const outputStat = await stat(outputPath);
    console.log(`[/api/stitch] Success! Streaming ${(outputStat.size / 1024 / 1024).toFixed(1)}MB MP4 back to client...`);

    // Stream the file to avoid loading entire video into memory (OOM prevention)
    const { createReadStream } = await import("fs");
    const fileStream = createReadStream(outputPath);
    const webStream = Readable.toWeb(fileStream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": outputStat.size.toString(),
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

