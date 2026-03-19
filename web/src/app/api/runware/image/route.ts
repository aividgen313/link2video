import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      negativePrompt = "blurry, low quality, distorted, watermark",
      width = 1024,
      height = 1024,
      model = "runware:101@1",
      steps = 30,
      cfgScale = 7.5,
      numberResults = 1,
      outputFormat = "jpg",
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    console.log("Runware Image Inference:", prompt.substring(0, 80) + "...");

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "imageInference",
          taskUUID: uuidv4(),
          positivePrompt: prompt,
          negativePrompt,
          width,
          height,
          model,
          steps,
          CFGScale: cfgScale,
          numberResults,
          outputType: "URL",
          outputFormat,
          includeCost: true,
        },
      ]),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("Runware image error:", data.errors);
      return NextResponse.json({ error: data.errors[0]?.message || "Image generation failed" }, { status: 500 });
    }

    const results = data.data || [];
    return NextResponse.json({
      success: true,
      images: results.map((r: Record<string, unknown>) => ({
        imageURL: r.imageURL,
        imageUUID: r.imageUUID,
        seed: r.seed,
        cost: r.cost,
      })),
    });
  } catch (error) {
    console.error("Runware image generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
