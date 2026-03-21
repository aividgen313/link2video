import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const prompt = `
You are an expert Youtube video producer helping a creator brainstorm angles.
Topic: ${topic}

Generate 4 unique and compelling story angles for a video on this topic.
Format your response as a JSON array of objects, each with these keys:
- "title": A compelling angle title
- "description": 1-2 sentence description of the angle
- "type": The content type (e.g. "Documentary", "Explainer", "Narrative", "Opinion", "Investigative")
- "duration": Estimated video duration (e.g. "3-5 min", "1-2 min", "5-10 min")

Return ONLY the JSON array. No explanations.
`;

    console.log("Generating angles via Groq...");
    const responseText = await generateGeminiText(prompt);
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
      throw new Error("Failed to parse AI response as JSON.");
    }

    const angles = Array.isArray(anglesData) ? anglesData : (anglesData.angles || []);

    if (!angles || angles.length === 0) {
      throw new Error("AI response contained no angles");
    }

    console.log("Generated", angles.length, "angles");
    return NextResponse.json({ angles });
  } catch (error: any) {
    console.error("Angle generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate angles" }, { status: 500 });
  }
}
