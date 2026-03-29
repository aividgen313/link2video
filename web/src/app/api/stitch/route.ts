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
const EXEC_OPTS = { maxBuffer: 20 * 1024 * 1024 }; // 20 MB buffer for ffmpeg output

/** Stream a fetch response to disk instead of buffering in memory */
async function streamToDisk(url: string, destPath: string, timeoutMs = 60_000): Promise<number> {
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
      videoResolution, // "480p", "720p", "1080p", "4k"
    } = body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    // Use user-requested resolution or fallback to 480p for memory safety
    const resId = videoResolution || "480p";
    const MAX_HEIGHT = resId === "4k" ? 2160 : resId === "1080p" ? 1080 : resId === "720p" ? 720 : 480;
    
    // Scale proportionally to fit the target height
    const reqW = resolution?.width ?? 1280;
    const reqH = resolution?.height ?? 720;
    const scale = Math.min(1, MAX_HEIGHT / reqH);
    const W = Math.round((reqW * scale) / 2) * 2; // ensure even
    const H = Math.round((reqH * scale) / 2) * 2;
    const FPS = 24;
    
    // Memory-intensive high-res exports need more aggressive optimization
    const CPU_THREADS = (resId === "4k" || resId === "1080p") ? 1 : 2;
    const CRF = (resId === "4k") ? 32 : 30; // Slightly higher compression for 4K to save memory

    console.log(`[/api/stitch] Resolution: ${reqW}x${reqH} → ${W}x${H} (${resId} mode, threads=${CPU_THREADS})`);

    // ── Step 1: Render individual clips ─────────────────────────────────────
    const clipPaths: string[] = [];
    const clipDurations: number[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      // Use audio duration as ground truth when available; clamp to >= 3s
      const dur = Math.max(Math.ceil(scene.duration ?? 8), 3);

      // ── Step 1a: Prepare Image(s) ─────────────────────────────
      const imageArray = Array.isArray(scene.images) ? scene.images : [scene.image].filter(Boolean);
      const subClips: string[] = [];
      const subDur = dur / Math.max(1, imageArray.length);

      for (let j = 0; j < imageArray.length; j++) {
        const imgUrl = imageArray[j];
        const imgPath = join(workDir, `img_${i}_${j}.jpg`);
        const subClipPath = join(workDir, `subclip_${i}_${j}.mp4`);

        // Get image
        if (imgUrl.startsWith("data:")) {
          const b64 = imgUrl.replace(/^data:[^;]+;base64,/, "");
          await writeFile(imgPath, Buffer.from(b64, "base64"));
        } else {
          const r = await fetch(imgUrl, { signal: AbortSignal.timeout(20_000) });
          if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
          await writeFile(imgPath, Buffer.from(await r.arrayBuffer()));
        }

        // Render sub-clip (simple linear Ken Burns)
        // We use a slight zoompan (1.0 to 1.1) for each sub-frame
        const subCmd = [
          "ffmpeg -y -loglevel error",
          `-loop 1 -t ${subDur} -i "${imgPath}"`,
          `-vf "scale=ceil(${W}*1.2/2)*2:ceil(${H}*1.2/2)*2,zoompan=z='min(zoom+0.001,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(subDur * FPS)}:s=${W}x${H}:fps=${FPS}"`,
          `-c:v libx264 -preset ultrafast -crf ${CRF} -pix_fmt yuv420p -r ${FPS} -threads ${CPU_THREADS} -t ${subDur}`,
          `"${subClipPath}"`
        ].join(" ");

        await execAsync(subCmd, { timeout: 30_000, ...EXEC_OPTS });
        subClips.push(subClipPath);
        await rm(imgPath, { force: true }).catch(() => {});
      }

      // Concat sub-clips into a single combined image track for the scene
      const combinedImgTrack = join(workDir, `img_track_${i}.mp4`);
      if (subClips.length > 1) {
        const subConcatTxt = join(workDir, `subconcat_${i}.txt`);
        await writeFile(subConcatTxt, subClips.map(p => `file '${p}'`).join("\n"));
        await execAsync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${subConcatTxt}" -c copy "${combinedImgTrack}"`, { timeout: 30_000, ...EXEC_OPTS });
        await rm(subConcatTxt, { force: true }).catch(() => {});
      } else {
        await execAsync(`cp "${subClips[0]}" "${combinedImgTrack}"`);
      }
      for (const p of subClips) await rm(p, { force: true }).catch(() => {});

      // ── Step 1b: Prepare Audio/Video ───────────────────────────
      const audPath = join(workDir, `aud_${i}.mp3`);
      let hasAudio = false;
      if (scene.audio && typeof scene.audio === "string") {
        try {
          if (scene.audio.startsWith("data:")) {
            const b64 = scene.audio.replace(/^data:[^;]+;base64,/, "");
            await writeFile(audPath, Buffer.from(b64, "base64"));
            hasAudio = true;
          } else if (scene.audio.startsWith("http")) {
            const aRes = await fetch(scene.audio, { signal: AbortSignal.timeout(20_000) });
            if (aRes.ok) {
              await writeFile(audPath, Buffer.from(await aRes.arrayBuffer()));
              hasAudio = true;
            }
          }
        } catch (audioErr) {
          console.warn(`[/api/stitch] Scene ${i} audio error:`, audioErr);
        }
      }

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
            if (size > 5000) hasVideo = true;
          }
        } catch (e) {
          console.warn(`[/api/stitch] Failed to fetch video for scene ${i}:`, e);
        }
      }

      // ── Step 1c: Subtitles & Transitions ──────────────────────
      let subtitleFilter = "";
      const { fontColor = "white", fontSize = 5, position = "bottom", showBackground = true } = body.captionStyle || {};
      const textPath = join(workDir, `text_${i}.txt`);
      if (captionsEnabled && scene.narration) {
        const wrapText = (text: string, maxLen: number = 40) => {
          const words = text.split(/\s+/);
          let lines = [], currentLine = "";
          words.forEach((word) => {
            if ((currentLine + " " + word).trim().length > maxLen) {
              lines.push(currentLine.trim());
              currentLine = word;
            } else currentLine += " " + word;
          });
          if (currentLine) lines.push(currentLine.trim());
          return lines.join("\n").replace(/'/g, "\u2019"); // Escape single quotes
        };
        await writeFile(textPath, wrapText(scene.narration));
        const escapedPath = textPath.replace(/\\/g, '/').replace(/:/g, '\\\\:');
        
        const fSize = Math.max(12, Math.round((H * fontSize) / 100));
        let yPos = "h-th-h/10";
        if (position === "top") yPos = "h/10";
        if (position === "middle") yPos = "(h-th)/2";

        const boxStr = showBackground ? ":box=1:boxcolor=black@0.5:boxborderw=10" : "";
        subtitleFilter = `,drawtext=textfile='${escapedPath}':fontcolor=${fontColor}:fontsize=${fSize}:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${yPos}:line_spacing=5${boxStr}`;
      }

      const transition = scene.transition || "fade";
      const tDur = Math.min(scene.transitionDuration || 0.5, dur / 3);
      const isFirst = i === 0, isLast = i === scenes.length - 1;
      let fadeVF = "", fadeAF = "";
      if (transition !== "none" && tDur > 0) {
        const vParts = [];
        if (!isFirst) vParts.push(`fade=t=in:st=0:d=${tDur}`);
        if (!isLast) vParts.push(`fade=t=out:st=${dur - tDur}:d=${tDur}`);
        if (vParts.length) fadeVF = "," + vParts.join(",");
        
        const aParts = [];
        if (!isFirst) aParts.push(`afade=t=in:st=0:d=${tDur}`);
        if (!isLast) aParts.push(`afade=t=out:st=${dur - tDur}:d=${tDur}`);
        if (aParts.length && hasAudio) fadeAF = aParts.join(",");
      }

      const clipPath = join(workDir, `clip_${i}.mp4`);
      const vfScale = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(in_w-${W})/2:(in_h-${H})/2`;
      
      let cmd: string;
      if (hasVideo) {
        cmd = [
          "ffmpeg -y -loglevel error",
          `-i "${vidPath}"`,
          hasAudio ? `-i "${audPath}"` : `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
          `-vf "${vfScale}${subtitleFilter}${fadeVF}"`,
          fadeAF ? `-af "${fadeAF}"` : "",
          `-c:v libx264 -preset ultrafast -crf ${CRF} -pix_fmt yuv420p -r ${FPS} -threads ${CPU_THREADS}`,
          `-c:a aac -b:a 96k -t ${dur} ${hasAudio ? "-shortest" : ""}`,
          `"${clipPath}"`
        ].filter(Boolean).join(" ");
      } else {
        cmd = [
          "ffmpeg -y -loglevel error",
          `-i "${combinedImgTrack}"`,
          hasAudio ? `-i "${audPath}"` : `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
          `-vf "null${subtitleFilter}${fadeVF}"`, // images already scaled/kenburns in combinedImgTrack
          fadeAF ? `-af "${fadeAF}"` : "",
          `-c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -r ${FPS} -threads 1`,
          `-c:a aac -b:a 96k -t ${dur} ${hasAudio ? "-shortest" : ""}`,
          `"${clipPath}"`
        ].filter(Boolean).join(" ");
      }

      console.log(`[/api/stitch] Rendering scene clip ${i + 1}/${scenes.length}...`);
      await execAsync(cmd, { timeout: 120_000, ...EXEC_OPTS });
      clipPaths.push(clipPath);

      // Cleanup scene temp files
      await Promise.allSettled([
        rm(audPath, { force: true }),
        rm(vidPath, { force: true }),
        rm(textPath, { force: true }),
        rm(combinedImgTrack, { force: true })
      ]);
    }

    // ── Step 2: Concatenate demuxer ─────────────────────────────
    console.log(`[/api/stitch] Concatenating ${clipPaths.length} clips...`);
    const concatTxt = join(workDir, "concat.txt");
    await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
    const masterPath = join(workDir, "master.mp4");
    await execAsync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${concatTxt}" -c copy "${masterPath}"`, { timeout: 180_000, ...EXEC_OPTS });

    // ── Step 3: Global Audio Mix ────────────────────────────────
    const outputPath = join(workDir, "output.mp4");
    if (userAudioDataUrl) {
      const userAudioPath = join(workDir, "user_audio.mp3");
      const b64 = userAudioDataUrl.replace(/^data:[^;]+;base64,/, "");
      await writeFile(userAudioPath, Buffer.from(b64, "base64"));
      await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -i "${userAudioPath}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`, { timeout: 60_000, ...EXEC_OPTS });
    } else if (musicUrl) {
      const musicPath = join(workDir, "music.mp3");
      const mRes = await fetch(musicUrl, { signal: AbortSignal.timeout(20_000) });
      if (mRes.ok) {
        await writeFile(musicPath, Buffer.from(await mRes.arrayBuffer()));
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -i "${musicPath}" -filter_complex "[1:a]volume=0.18,afade=t=out:st=-3:d=3[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`, { timeout: 60_000, ...EXEC_OPTS });
      } else await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
    } else {
      await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000, ...EXEC_OPTS });
    }

    // ── Step 4: Stream response ─────────────────────────────────
    const outputStat = await stat(outputPath);
    console.log(`[/api/stitch] Streaming final video (${(outputStat.size / 1048576).toFixed(1)}MB)...`);
    const { createReadStream } = await import("fs");
    const fileStream = createReadStream(outputPath);
    const webStream = Readable.toWeb(fileStream as any) as any;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": outputStat.size.toString(),
        "Content-Disposition": `attachment; filename="video.mp4"`,
      },
    });

  } catch (err) {
    console.error("[/api/stitch] FAILED:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Stitching failed" }, { status: 500 });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}


