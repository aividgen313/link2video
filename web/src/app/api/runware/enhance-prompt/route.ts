import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      promptMaxLength = 128,
      promptVersions = 4,
    } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt must be a non-empty string" }, { status: 400 });
    }

    console.log("Runware Enhance Prompt:", prompt.substring(0, 80));

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "promptEnhance",
          taskUUID: uuidv4(),
          prompt,
          promptMaxLength,
          promptVersions,
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
      console.error("Runware prompt enhance error:", data.errors);
      return NextResponse.json({ error: data.errors[0]?.message || "Prompt enhancement failed" }, { status: 500 });
    }

    const results = data.data || [];
    return NextResponse.json({
      success: true,
      enhancedPrompts: results.map((r: Record<string, unknown>) => ({
        text: r.text,
        cost: r.cost,
      })),
    });
  } catch (error) {
    console.error("Runware prompt enhance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
