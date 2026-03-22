import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Allow up to 5 minutes for video generation
export const maxDuration = 300;

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

/**
 * Video generation — all via Pollinations:
 * 1. "kenburns" (FREE) — Returns the image, client creates video with FFmpeg zoom/pan
 * 2. "ai" (Pollinations credits) — AI video via wan, seedance-pro, seedance, ltx-2
 */
export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      duration = 5,
      mode = "kenburns", // "kenburns" or "ai"
      imageDataUrl,
    } = await req.json();

    if (!prompt && !imageDataUrl) {
      return NextResponse.json({ error: "Prompt or image is required" }, { status: 400 });
    }

    // MODE 1: Ken Burns — just pass back the image for client-side FFmpeg processing
    if (mode === "kenburns") {
      console.log("Video (Ken Burns mode):", prompt?.substring(0, 60) + "...");

      if (imageDataUrl) {
        return NextResponse.json({
          success: true,
          videoUrl: imageDataUrl,
          videoUUID: uuidv4(),
          useKenBurns: true,
          cost: 0,
          duration: Math.min(Math.max(duration, 2), 15),
        });
      }

      // Generate an image first if none provided
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 1000000);
      let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=nanobanana-pro&width=1280&height=768&seed=${seed}&nologo=true`;
      if (POLLINATIONS_API_KEY) imageURL += `&key=${POLLINATIONS_API_KEY}`;

      const imgRes = await fetch(imageURL, { signal: AbortSignal.timeout(60000) });
      if (!imgRes.ok) throw new Error(`Image generation failed: ${imgRes.status}`);

      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = (imgRes.headers.get("content-type") || "").includes("png") ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${imgBuffer.toString("base64")}`;

      return NextResponse.json({
        success: true,
        videoUrl: dataUrl,
        videoUUID: uuidv4(),
        useKenBurns: true,
        cost: 0,
        duration: Math.min(Math.max(duration, 2), 15),
      });
    }

    // MODE 2: AI Video via Pollinations
    console.log("Video (Pollinations AI mode):", prompt?.substring(0, 60) + "...");

    const seed = Math.floor(Math.random() * 1000000);
    const clampedDuration = Math.min(Math.max(duration, 2), 10);
    const VIDEO_MODELS = ["wan", "seedance-pro", "seedance", "ltx-2"];

    for (let i = 0; i < VIDEO_MODELS.length; i++) {
      const videoModel = VIDEO_MODELS[i];
      const encodedPrompt = encodeURIComponent(prompt);

      let videoURL = `https://gen.pollinations.ai/video/${encodedPrompt}?model=${videoModel}&duration=${clampedDuration}&aspectRatio=16:9&seed=${seed}&nologo=true`;
      if (POLLINATIONS_API_KEY) videoURL += `&key=${POLLINATIONS_API_KEY}`;

      console.log(`Fetching AI video (attempt ${i + 1}/${VIDEO_MODELS.length}, model=${videoModel})...`);
      try {
        const response = await fetch(videoURL, {
          signal: AbortSignal.timeout(240000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.warn(`Video model ${videoModel} failed: ${response.status}`, errorText.substring(0, 200));

          if (response.status === 402) {
            return NextResponse.json({
              error: "Insufficient Pollinations credits for AI video. Buy credits at enter.pollinations.ai or switch to Ken Burns mode (free).",
              isCreditsError: true,
              retryable: false,
            }, { status: 402 });
          }
          if (i < VIDEO_MODELS.length - 1) continue;
          throw new Error(`Video generation failed: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        console.log(`AI Video response (${videoModel}): ${response.status}, type: ${contentType}`);

        const videoBuffer = Buffer.from(await response.arrayBuffer());
        if (videoBuffer.length < 1000) {
          console.warn(`Video model ${videoModel} returned empty file, trying next...`);
          if (i < VIDEO_MODELS.length - 1) continue;
          throw new Error("Video generation returned empty file");
        }

        const base64Video = videoBuffer.toString("base64");

        return NextResponse.json({
          success: true,
          videoUrl: `data:video/mp4;base64,${base64Video}`,
          videoUUID: uuidv4(),
          useKenBurns: false,
          cost: 0,
          duration: clampedDuration,
        });
      } catch (err: any) {
        if (err.name === "AbortError" || err.message?.includes("timeout")) {
          console.warn(`Video model ${videoModel} timed out`);
          if (i < VIDEO_MODELS.length - 1) continue;
        }
        if (i === VIDEO_MODELS.length - 1) throw err;
      }
    }

    throw new Error("All video models failed");
  } catch (error) {
    console.error("Video generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
      return NextResponse.json(
        { error: "Video generation timed out. Try again.", retryable: true },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: errorMessage, retryable: true }, { status: 500 });
  }
}
