import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    if (!genAI) {
      console.error("GEMINI_API_KEY not found in environment.");
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
You are an expert Youtube video producer helping a creator brainstorm angles.
I will provide you with a core topic or URL.
Generate exactly 4 creative and distinct story angles/narrative frameworks for a video about this topic.
Make them highly engaging, ranging from deep dives to contrarian takes.

Topic: "${topic}"

Please output the response STRICTLY in JSON format as follows:
{
  "angles": [
    {
      "title": "A catchy title for the angle",
      "description": "A 2-sentence pitch for this narrative approach",
      "type": "e.g., Deep Dive, Contrarian, Storytime, Documentary, Listicle",
      "duration": "e.g., 60s, 5 min, 10 min"
    }
  ]
}
Only return the raw JSON object.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Angle generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
