import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

/**
 * Music generation via Pollinations.ai — FREE with API key
 * Uses elevenmusic model for instrumental background music
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, duration = 30 } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt must be a non-empty string" }, { status: 400 });
    }

    const parsedDuration = Number(duration);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 300) {
      return NextResponse.json({ error: "Duration must be a number between 1 and 300" }, { status: 400 });
    }

    console.log("Pollinations Music:", prompt.substring(0, 80) + "...");

    let url = "https://gen.pollinations.ai/v1/audio/speech";
    if (POLLINATIONS_API_KEY) {
      url += `?key=${POLLINATIONS_API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(POLLINATIONS_API_KEY ? { "Authorization": `Bearer ${POLLINATIONS_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        input: prompt,
        model: "elevenmusic",
        duration: Math.min(duration, 120),
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      console.warn(`Music generation failed (${response.status}), skipping`);
      return NextResponse.json({
        success: true,
        audioUrl: null,
        audioUUID: null,
        cost: 0,
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    if (audioBuffer.length < 1000) {
      console.warn("Music returned very small file, skipping");
      return NextResponse.json({
        success: true,
        audioUrl: null,
        audioUUID: null,
        cost: 0,
      });
    }

    console.log(`Music generated: ${audioBuffer.length} bytes`);
    const base64Audio = audioBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      audioUrl: `data:audio/mp3;base64,${base64Audio}`,
      audioUUID: uuidv4(),
      cost: 0,
    });
  } catch (error) {
    console.error("Music error:", error);
    // Music is non-critical — return success with null
    return NextResponse.json({
      success: true,
      audioUrl: null,
      audioUUID: null,
      cost: 0,
    });
  }
}
