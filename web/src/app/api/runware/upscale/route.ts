import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      inputImage,
      upscaleFactor = 2,
      model = "runware:501@1",
      outputFormat = "JPG",
    } = await req.json();

    if (!inputImage) {
      return NextResponse.json({ error: "inputImage (imageUUID or URL) is required" }, { status: 400 });
    }

    console.log("Runware Upscale:", inputImage, `${upscaleFactor}x`);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "upscale",
          taskUUID: uuidv4(),
          inputImage,
          model,
          upscaleFactor,
          outputType: "URL",
          outputFormat,
          includeCost: true,
        },
      ]),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("Runware upscale error:", data.errors);
      return NextResponse.json({ error: data.errors[0]?.message || "Upscale failed" }, { status: 500 });
    }

    const result = data.data?.[0];
    return NextResponse.json({
      success: true,
      imageURL: result?.imageURL,
      imageUUID: result?.imageUUID,
      cost: result?.cost,
    });
  } catch (error) {
    console.error("Runware upscale error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
