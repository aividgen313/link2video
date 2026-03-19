import { NextRequest, NextResponse } from "next/server";
import { generateRunwareText } from "@/lib/runware";

export async function POST(req: NextRequest) {
  try {
    const { topic, provider = "runware", model: modelOverride } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const prompt = `
You are an expert Youtube video producer helping a creator brainstorm angles.
Topic: ${topic}

Generate 4 unique and compelling story angles for a video on this topic.
Format your response as a JSON array of objects, each with 'title' and 'description' keys.
Return ONLY the JSON.
`;

    console.log("Generating angles with model:", modelOverride || "minimax:m2.5@0");

    const runwareModel = modelOverride || "minimax:m2.5@0";
    const finalModel = runwareModel.replace("runware:", "");

    const responseText = await generateRunwareText(prompt, finalModel);

    console.log("Raw angles response (first 300 chars):", responseText.substring(0, 300));

    // Clean up response text: strip <think> tags and extract JSON
    const cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;

    let anglesData;
    try {
      anglesData = JSON.parse(jsonStr);
      console.log("Successfully parsed angles data");
    } catch (e) {
      console.error("JSON Parse failed for response:", responseText);
      console.error("Parse error:", e);
      throw new Error("Failed to parse AI response as JSON. Response may not be in correct format.");
    }

    const angles = Array.isArray(anglesData) ? anglesData : (anglesData.angles || []);

    if (!angles || angles.length === 0) {
      console.error("No angles found in response:", anglesData);
      throw new Error("AI response contained no angles");
    }

    console.log("Generated", angles.length, "angles");

    return NextResponse.json({ angles });
  } catch (error: any) {
    console.error("Angle generation error:", error);

    // Check if it's a credit error
    if (error.message?.includes('INSUFFICIENT_CREDITS')) {
      return NextResponse.json({
        error: "Runware Credits Exhausted",
        message: "Your Runware account has run out of credits. Please add credits at https://runware.ai to continue using AI features.",
        isCreditsError: true
      }, { status: 402 }); // 402 Payment Required
    }

    return NextResponse.json({ error: error.message || "Failed to generate angles" }, { status: 500 });
  }
}
