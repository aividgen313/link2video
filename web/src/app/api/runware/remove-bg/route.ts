import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      inputImage,
      model = "runware:109@1",
      outputFormat = "PNG",
    } = await req.json();

    if (!inputImage || typeof inputImage !== "string" || !inputImage.trim()) {
      return NextResponse.json({ error: "inputImage must be a non-empty string (imageUUID or URL)" }, { status: 400 });
    }

    console.log("Runware Remove Background:", inputImage);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "removeBackground",
          taskUUID: uuidv4(),
          inputImage,
          model,
          outputType: "URL",
          outputFormat,
          includeCost: true,
        },
      ]),
      signal: AbortSignal.timeout(30000),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON response from Runware" }, { status: 502 });
    }

    if (data.errors) {
      console.error("Runware remove-bg error:", data.errors);
      return NextResponse.json({ error: data.errors[0]?.message || "Background removal failed" }, { status: 500 });
    }

    const result = data.data?.[0];
    return NextResponse.json({
      success: true,
      imageURL: result?.imageURL,
      imageUUID: result?.imageUUID,
      cost: result?.cost,
    });
  } catch (error) {
    console.error("Runware remove-bg error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
