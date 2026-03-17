import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      duration = 30,
      model = "elevenlabs:1@1",
      outputFormat = "mp3",
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    console.log("Runware Audio Inference:", prompt.substring(0, 80) + "...");

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "audioInference",
          taskUUID: uuidv4(),
          positivePrompt: prompt,
          model,
          duration,
          outputType: "URL",
          outputFormat,
          numberResults: 1,
          includeCost: true,
        },
      ]),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("Runware audio error:", data.errors);
      return NextResponse.json({ error: data.errors[0]?.message || "Music generation failed" }, { status: 500 });
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
    console.error("Music generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
