import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

/**
 * Image generation via Pollinations.ai — FREE with API key
 * Sign up at https://enter.pollinations.ai to get a free key
 */
export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      width = 1280,
      height = 768,
      model = "flux",
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    console.log("Pollinations Image:", prompt.substring(0, 80) + "...");

    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);

    // Build URL with API key
    let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&width=${width}&height=${height}&seed=${seed}&nologo=true`;
    if (POLLINATIONS_API_KEY) {
      imageURL += `&key=${POLLINATIONS_API_KEY}`;
    }

    // Verify the image generates successfully
    const response = await fetch(imageURL, {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Pollinations image error: ${response.status}`, errorText.substring(0, 200));
      throw new Error(`Pollinations returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    console.log(`Image response: ${response.status}, type: ${contentType}`);

    // Convert the image to base64 data URL for reliable cross-origin usage
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");
    const mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      images: [
        {
          imageURL: dataUrl,
          imageUUID: `poll-${seed}`,
          seed,
          cost: 0,
        },
      ],
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
