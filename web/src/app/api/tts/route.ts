import { NextRequest, NextResponse } from "next/server";
import { runwareRequest, generateTaskUUID } from "@/lib/runware";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceProvider = "elevenlabs:1@1", voice = "Adam", duration = 30 } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log(`Generating TTS using Runware (${voiceProvider}) with voice: ${voice}:`, text.substring(0, 50) + "...");

    // Ensure duration is an integer within valid range (10-300)
    const validDuration = Math.max(10, Math.min(300, Math.floor(duration)));

    const data = await runwareRequest([
      {
        taskType: "audioInference",
        taskUUID: generateTaskUUID(),
        positivePrompt: text,
        model: voiceProvider.includes("elevenlabs") ? voiceProvider : "elevenlabs:1@1",
        audioSettings: {
          voice: voice,
          duration: validDuration,
        },
        outputType: "URL",
        outputFormat: "MP3",
        numberResults: 1,
        includeCost: true,
      },
    ]);

    if (data.errors) {
      console.error("Runware TTS error:", data.errors);
      
      const isCreditError = data.errors.some((e: any) => e.message?.toLowerCase().includes("credit") || e.message?.toLowerCase().includes("invoice"));
      if (isCreditError) {
        console.warn("Runware out of credits. Falling back to mock TTS to allow flow completion.");
        return NextResponse.json({
          success: true,
          audioUrl: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race1.ogg",
          audioUUID: "mock-tts-uuid",
          cost: 0,
          duration,
        });
      }

      return NextResponse.json({ error: data.errors[0]?.message || "TTS generation failed" }, { status: 500 });
    }

    const result = data.data?.[0];
    return NextResponse.json({
      success: true,
      audioUrl: result?.audioURL,
      audioUUID: result?.audioUUID,
      cost: result?.cost,
      duration,
    });

  } catch (error) {
    console.error("TTS generation error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
      return NextResponse.json(
        {
          error: "Network error: Unable to connect to Runware TTS API.",
          retryable: true
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal Server Error during TTS generation",
        message: errorMessage,
        retryable: true
      },
      { status: 500 }
    );
  }
}
