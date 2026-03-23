import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_CUSTOM_VOICE_ID = process.env.ELEVENLABS_CUSTOM_VOICE_ID || "";

/**
 * Text-to-Speech — tries Pollinations first, falls back to Edge TTS (free)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "adam", useEdgeTTS = false } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text must be a non-empty string" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Text must be at most 5000 characters" }, { status: 400 });
    }
    if (typeof voice !== "string" || voice.trim().length === 0) {
      return NextResponse.json({ error: "Voice must be a non-empty string" }, { status: 400 });
    }

    console.log(`TTS (voice=${voice}, edgeTTS=${useEdgeTTS}):`, text.substring(0, 50) + "...");

    // Custom Voice via Official ElevenLabs SDK
    if (voice === "custom") {
      if (ELEVENLABS_API_KEY && ELEVENLABS_CUSTOM_VOICE_ID) {
        console.log("Using official ElevenLabs SDK for Custom Voice");
        try {
          const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
          const audioStream = await elevenlabs.textToSpeech.convert(ELEVENLABS_CUSTOM_VOICE_ID, {
            text,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
          } as any);

          // Convert stream to Buffer
          const chunks: Buffer[] = [];
          for await (const chunk of audioStream as any) {
            chunks.push(Buffer.from(chunk));
          }
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer.length > 100) {
            console.log(`ElevenLabs Custom TTS: ${audioBuffer.length} bytes`);
            const base64Audio = audioBuffer.toString("base64");
            return NextResponse.json({
              success: true,
              audioUrl: `data:audio/mp3;base64,${base64Audio}`,
              audioUUID: `tts-custom-${Date.now()}`,
              cost: 0,
            });
          }
        } catch (err) {
          console.error("ElevenLabs Custom Voice Error:", err);
          console.log("Falling back to Edge TTS");
        }
      } else {
        console.warn("Custom voice requested but ELEVENLABS_API_KEY or ELEVENLABS_CUSTOM_VOICE_ID not set. Falling back to Edge TTS.");
      }
    }

    // Try Pollinations (paid ElevenLabs) only when NOT explicitly using Edge TTS (free tier)
    if (POLLINATIONS_API_KEY && !useEdgeTTS) {
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

    // Map Pollinations/ElevenLabs voice names to Edge TTS equivalents
    const VOICE_MAP: Record<string, string> = {
      adam: "en-US-ChristopherNeural",       // Deep male
      alloy: "en-US-GuyNeural",              // Neutral male
      echo: "en-US-EricNeural",              // Warm male
      fable: "en-GB-RyanNeural",             // British male
      onyx: "en-US-AndrewNeural",            // Deep authoritative male
      nova: "en-US-JennyNeural",             // Warm female
      shimmer: "en-US-AriaNeural",           // Bright female
      rachel: "en-US-MichelleNeural",        // Professional female
      drew: "en-US-DavisNeural",             // Casual male
      clyde: "en-US-JasonNeural",            // Gruff male
      paul: "en-US-TonyNeural",              // Friendly male
      domi: "en-US-SaraNeural",              // Energetic female
      elli: "en-US-JaneNeural",              // Soft female
      josh: "en-US-BrandonNeural",           // Young male
      arnold: "en-US-ChristopherNeural",     // Deep narrator
      sam: "en-US-SteffanNeural",            // Neutral male
      bella: "en-US-NancyNeural",            // Warm female
    };
    const edgeVoice = VOICE_MAP[voice.toLowerCase()] || "en-US-ChristopherNeural";
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
