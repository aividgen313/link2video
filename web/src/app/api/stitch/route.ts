import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

/**
 * Server-side video stitching using system ffmpeg.
 * Accepts image URLs, audio data URLs, and durations per scene.
 * Returns a downloadable MP4.
 */
export async function POST(req: NextRequest) {
  const workDir = join(tmpdir(), `stitch_${randomUUID()}`);
  try {
    await mkdir(workDir, { recursive: true });

    const body = await req.json();
    const {
      scenes,          // Array<{ image: string; audio?: string; duration: number; narration?: string }>
      resolution,      // { width: number; height: number }
      musicUrl,        // optional background music URL
      captionsEnabled, // boolean
    } = body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const width = resolution?.width ?? 1280;
    const height = resolution?.height ?? 720;

    // ── Step 1: Write all assets to disk ─────────────────────────────────────
    const scenePaths: { imgPath: string; audPath: string | null; duration: number }[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // Image — fetch from URL or decode base64 data URL
      const imgPath = join(workDir, `img_${i}.jpg`);
      if (scene.image.startsWith("data:")) {
        const base64Data = scene.image.replace(/^data:[^;]+;base64,/, "");
        await writeFile(imgPath, Buffer.from(base64Data, "base64"));
      } else {
        const imgRes = await fetch(scene.image);
        if (!imgRes.ok) throw new Error(`Failed to fetch image for scene ${i}: ${imgRes.status}`);
        const imgBuf = await imgRes.arrayBuffer();
        await writeFile(imgPath, Buffer.from(imgBuf));
      }

      // Audio — optional, data URL
      let audPath: string | null = null;
      if (scene.audio) {
        audPath = join(workDir, `aud_${i}.mp3`);
        const base64Data = scene.audio.replace(/^data:[^;]+;base64,/, "");
        await writeFile(audPath, Buffer.from(base64Data, "base64"));
      }

      scenePaths.push({ imgPath, audPath, duration: Math.max(scene.duration ?? 8, 3) });
    }

    // ── Step 2: Render each scene to a clip ────────────────────────────────
    const clipPaths: string[] = [];
    for (let i = 0; i < scenePaths.length; i++) {
      const { imgPath, audPath, duration } = scenePaths[i];
      const clipPath = join(workDir, `clip_${i}.mp4`);
      const dur = Math.ceil(duration);

      // Ken Burns zoom-pan effect from image
      const videoFilter = `scale=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * 25}:s=${width}x${height}:fps=25`;

      let ffCmd: string;
      if (audPath) {
        ffCmd = [
          "ffmpeg -y",
          `-loop 1 -i "${imgPath}"`,
          `-i "${audPath}"`,
          `-vf "${videoFilter}"`,
          `-c:v libx264 -pix_fmt yuv420p -r 25`,
          `-c:a aac -shortest`,
          `-t ${dur}`,
          `"${clipPath}"`
        ].join(" ");
      } else {
        // Silent clip
        ffCmd = [
          "ffmpeg -y",
          `-loop 1 -i "${imgPath}"`,
          `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
          `-vf "${videoFilter}"`,
          `-c:v libx264 -pix_fmt yuv420p -r 25`,
          `-c:a aac`,
          `-t ${dur}`,
          `"${clipPath}"`
        ].join(" ");
      }

      await execAsync(ffCmd, { timeout: 120_000 });
      clipPaths.push(clipPath);
    }

    // ── Step 3: Concat clips ───────────────────────────────────────────────
    const concatList = clipPaths.map(p => `file '${p}'`).join("\n");
    const concatFile = join(workDir, "concat.txt");
    await writeFile(concatFile, concatList);
    const masterPath = join(workDir, "master.mp4");
    await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${masterPath}"`, { timeout: 180_000 });

    // ── Step 4: Mix background music (if provided) ────────────────────────
    const outputPath = join(workDir, "output.mp4");
    if (musicUrl) {
      const musicPath = join(workDir, "music.mp3");
      const musicRes = await fetch(musicUrl);
      if (musicRes.ok) {
        await writeFile(musicPath, Buffer.from(await musicRes.arrayBuffer()));
        await execAsync([
          `ffmpeg -y -i "${masterPath}" -i "${musicPath}"`,
          `-filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]"`,
          `-map 0:v -map "[a]" -c:v copy -c:a aac "${outputPath}"`
        ].join(" "), { timeout: 120_000 });
      } else {
        await execAsync(`ffmpeg -y -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 60_000 });
      }
    } else {
      await execAsync(`ffmpeg -y -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 60_000 });
    }

    // ── Step 5: Return the MP4 ─────────────────────────────────────────────
    const videoData = await readFile(outputPath);

    return new NextResponse(videoData, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=\"video.mp4\"",
        "Content-Length": videoData.length.toString(),
      },
    });

  } catch (err) {
    console.error("[/api/stitch] Error:", err);
    const msg = err instanceof Error ? err.message : "Stitching failed";
    return NextResponse.json({ error: msg }, { status: 500 });

  } finally {
    // Clean up temp files
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
