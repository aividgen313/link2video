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

    const runwareModel = modelOverride || "minimax:m2.5@0";
    const finalModel = runwareModel.replace("runware:", "");
    
    const responseText = await generateRunwareText(prompt, finalModel);
    
    // Clean up response text: strip <think> tags and extract JSON
    const cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;
    
    let anglesData;
    try {
      anglesData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse failed for response:", responseText);
      throw new Error("Failed to parse AI response as JSON");
    }

    const angles = Array.isArray(anglesData) ? anglesData : (anglesData.angles || []);
    
    return NextResponse.json({ angles });
  } catch (error: any) {
    console.error("Angle generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate angles" }, { status: 500 });
  }
}
