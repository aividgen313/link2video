import { NextRequest, NextResponse } from "next/server";
import { runwareRequest, generateTaskUUID } from "@/lib/runware";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceProvider = "elevenlabs:1@1", duration = 30 } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log(`Generating TTS using Runware (${voiceProvider}):`, text.substring(0, 50) + "...");

    const data = await runwareRequest([
      {
        taskType: "audioInference",
        taskUUID: generateTaskUUID(),
        positivePrompt: text,
        model: voiceProvider.includes("elevenlabs") ? voiceProvider : "elevenlabs:1@1",
        duration,
        outputType: "URL",
        outputFormat: "mp3",
        numberResults: 1,
        includeCost: true,
      },
    ]);

    if (data.errors) {
      console.error("Runware TTS error:", data.errors);
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
