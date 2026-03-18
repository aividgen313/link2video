import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const { url, angle, length = 60 } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let extractedText = "";
    
    // 1. Check if input is a URL or a Topic
    try {
      // Simple validation for URL structure before attempting to fetch
      new URL(url); // This will throw if it's not a valid URL
      
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      $('p').each((i, el) => {
        extractedText += $(el).text() + "\n\n";
      });
      
      if (extractedText.trim().length < 50) {
        extractedText = $('body').text().replace(/\s+/g, ' ');
      }
      extractedText = extractedText.substring(0, 20000);
    } catch (e) {
      // It's likely a topic string like "lil wayne", so we use it directly as the source text
      console.log(`Input "${url}" is not a valid URL or fetch failed. Treating as a topic prompt.`);
      extractedText = `Topic: ${url}`;
    }

    // 2. Generate Script using Gemini
    if (!genAI) {
      console.error("GEMINI_API_KEY not found in environment.");
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    // Using stable gemini model to avoid 404 versioning errors
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
You are an expert Youtube video scriptwriter and director. 
I will provide you with the source text extracted from a URL, and a requested story angle.
Write a script for a video that is approximately ${length} seconds long.

Source Text:
${extractedText}

Requested Story Angle:
${angle || "A balanced, engaging overview of the topic"}

Please output the response strictly in JSON format as follows:
{
  "title": "A catchy title for the video",
  "angle": "The narrative angle used",
  "scenes": [
    {
      "id": 1,
      "scene_number": 1,
      "narration": "The spoken voiceover script for this scene.",
      "visual_prompt": "A highly detailed midjourney/stable-diffusion style prompt describing the visual for this scene. Focus on lighting, camera angle, and style.",
      "duration_estimate_seconds": 5
    }
  ]
}

Only return the raw JSON object without markdown formatting blocks.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting from the response
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    let scriptData;
    try {
      scriptData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", responseText);
      return NextResponse.json({ error: "Failed to generate valid script format." }, { status: 500 });
    }

    return NextResponse.json(scriptData);
    
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
