import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateRunwareText } from "@/lib/runware";

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const { topic, provider = "gemini", model: modelOverride } = await req.json();

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

    let responseText = "";

    if (provider === "runware" || (modelOverride && modelOverride.includes(":"))) {
      const runwareModel = modelOverride || "minimax:m2.5";
      responseText = await generateRunwareText(prompt, runwareModel);
    } else {
      if (!process.env.GEMINI_API_KEY || !genAI) {
        // Force fallback if key is missing
        console.warn("GEMINI_API_KEY missing, falling back to Runware");
        responseText = await generateRunwareText(prompt, "minimax:m2.5");
      } else {
        const modelIdentifier = modelOverride || "gemini-2.0-flash";
        try {
          const model = genAI.getGenerativeModel({ model: modelIdentifier });
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
        } catch (geminiError: any) {
          console.error("Gemini failed, falling back to Runware:", geminiError);
          // Fallback to Runware on ANY Gemini failure (quota, etc.)
          responseText = await generateRunwareText(prompt, "minimax:m2.5");
        }
      }
    }
    
    // Clean up response text if the LLM wrapped it in markdown
    const jsonStr = responseText.replace(/```json\n?|\n?|```/g, '').trim();
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
