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

/**
 * Server-side video stitching using system ffmpeg.
 * Restored Ken Burns zoompan effect for image-only scenes.
 * Support for AI Video clips if provided.
 */
export async function POST(req: NextRequest) {
  const workDir = join(tmpdir(), `stitch_${randomUUID()}`);
  try {
    await mkdir(workDir, { recursive: true });

    const body = await req.json();
    const {
      scenes,       // Array<{ image: string; audio?: string; duration: number; narration?: string }>
      resolution,   // { width: number; height: number }
      musicUrl,     // optional background music
    } = body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const W = resolution?.width ?? 1280;
    const H = resolution?.height ?? 720;

    // ── Write assets to disk ─────────────────────────────────────────────────
    const clipPaths: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
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

      // ── Render scene clip ──────────
      const clipPath = join(workDir, `clip_${i}.mp4`);
      let cmd: string;

      if (hasVideo) {
        // Pad/Scale AI Video to fit standard WxH
        const vfScale = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(in_w-${W})/2:(in_h-${H})/2`;
        if (hasAudio) {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-i "${vidPath}"`,
            `-i "${audPath}"`,
            `-vf "${vfScale}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25`,
            `-c:a aac -b:a 96k -shortest`,
            `"${clipPath}"`
          ].join(" ");
        } else {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-i "${vidPath}"`,
            `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
            `-vf "${vfScale}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      } else {
        // Ken Burns zoom-pan effect from image
        const videoFilter = `scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * 25}:s=${W}x${H}:fps=25`;
        if (hasAudio) {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-loop 1 -t ${dur} -i "${imgPath}"`,
            `-i "${audPath}"`,
            `-vf "${videoFilter}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25`,
            `-c:a aac -b:a 96k -shortest`,
            `"${clipPath}"`
          ].join(" ");
        } else {
          cmd = [
            "ffmpeg -y",
            `-loglevel error`,
            `-loop 1 -t ${dur} -i "${imgPath}"`,
            `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
            `-vf "${videoFilter}"`,
            `-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25`,
            `-c:a aac -b:a 96k -t ${dur}`,
            `"${clipPath}"`
          ].join(" ");
        }
      }

      await execAsync(cmd, { timeout: 120_000 });
      clipPaths.push(clipPath);
    }

    // ── Concatenate clips ─────────────────────────────────────────────────────
    const concatTxt = join(workDir, "concat.txt");
    await writeFile(concatTxt, clipPaths.map(p => `file '${p}'`).join("\n"));
    const masterPath = join(workDir, "master.mp4");
    await execAsync(
      `ffmpeg -y -loglevel error -f concat -safe 0 -i "${concatTxt}" -c copy "${masterPath}"`,
      { timeout: 120_000 }
    );

    // ── Optional: Mix background music ────────────────────────────────────────
    const outputPath = join(workDir, "output.mp4");
    if (musicUrl && typeof musicUrl === "string") {
      try {
        const musicPath = join(workDir, "music.mp3");
        const mRes = await fetch(musicUrl, { signal: AbortSignal.timeout(15_000) });
        if (mRes.ok) {
          await writeFile(musicPath, Buffer.from(await mRes.arrayBuffer()));
          await execAsync([
            `ffmpeg -y -loglevel error`,
            `-i "${masterPath}" -i "${musicPath}"`,
            `-filter_complex "[1:a]volume=0.15[bgm];[0:a][bgm]amix=inputs=2:duration=first[a]"`,
            `-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${outputPath}"`
          ].join(" "), { timeout: 60_000 });
        } else {
          await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
        }
      } catch {
        // music mix failed — fall back to master without music
        await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
      }
    } else {
      await execAsync(`ffmpeg -y -loglevel error -i "${masterPath}" -c copy "${outputPath}"`, { timeout: 30_000 });
    }

    // ── Stream MP4 back to client ──────────────────────────────────────────────
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
