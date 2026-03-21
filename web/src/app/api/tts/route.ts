import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

/**
 * Text-to-Speech — tries Pollinations first, falls back to Edge TTS (free)
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice = "adam" } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log(`TTS (voice=${voice}):`, text.substring(0, 50) + "...");

    // Try Pollinations first
    if (POLLINATIONS_API_KEY) {
      try {
        const url = `https://gen.pollinations.ai/v1/audio/speech?key=${POLLINATIONS_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${POLLINATIONS_API_KEY}`,
          },
          body: JSON.stringify({ input: text, voice, model: "elevenlabs" }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          if (audioBuffer.length > 100) {
            console.log(`Pollinations TTS: ${audioBuffer.length} bytes`);
            const base64Audio = audioBuffer.toString("base64");
            return NextResponse.json({
              success: true,
              audioUrl: `data:audio/mp3;base64,${base64Audio}`,
              audioUUID: `tts-${Date.now()}`,
              cost: 0,
            });
          }
        }
        console.log(`Pollinations TTS failed (${response.status}), falling back to Edge TTS`);
      } catch (e) {
        console.log("Pollinations TTS error, falling back to Edge TTS");
      }
    }

    // Fallback: Edge TTS (completely free, no API key needed)
    console.log("Using Edge TTS (free fallback)...");
    const { EdgeTTS } = await import("edge-tts-universal");

    const edgeVoice = "en-US-ChristopherNeural"; // Deep male voice, good for documentaries
    const tts = new EdgeTTS(text, edgeVoice, {
      rate: "+0%",
      volume: "+0%",
      pitch: "+0Hz",
    });

    const result = await tts.synthesize();
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Edge TTS returned empty audio");
    }

    console.log(`Edge TTS generated: ${audioBuffer.length} bytes`);
    const base64Audio = audioBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      audioUrl: `data:audio/mp3;base64,${base64Audio}`,
      audioUUID: `tts-${Date.now()}`,
      cost: 0,
    });
  } catch (error) {
    console.error("TTS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage, retryable: true }, { status: 500 });
  }
}
