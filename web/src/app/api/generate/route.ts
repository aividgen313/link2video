import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateRunwareText } from "@/lib/runware";

export async function POST(req: NextRequest) {
  try {
    const { topic, url, angle, provider = "runware", model: modelOverride, visualStyle = "Cinematic Documentary" } = await req.json();

    if (!topic && !url) {
      return NextResponse.json({ error: "URL or Topic is required" }, { status: 400 });
    }

    let extractedText = "";
    if (topic) {
      extractedText = topic;
    } else if (url) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        extractedText = $("body").text().slice(0, 5000); // Limit context
      } catch (e) {
        console.error("Failed to fetch URL, falling back to URL text only");
        extractedText = `Topic: ${url}`;
      }
    }

    let aestheticRules = "";
    switch (visualStyle) {
      case "Animated Storytime":
        aestheticRules = "CRITICAL AESTHETIC: You must write visual_prompts that describe 2D flat vector graphics, vibrant colors, cartoon style, and bold outlines. Do NOT request photorealism.";
        break;
      case "3D Render":
        aestheticRules = "CRITICAL AESTHETIC: You must write visual_prompts that describe 3D renders, Pixar/Disney style characters, soft lighting, and high-quality 3D assets.";
        break;
      case "Photorealistic":
        aestheticRules = "CRITICAL AESTHETIC: You must write visual_prompts that describe highly detailed, hyperrealistic photography, natural lighting, and 8k resolution.";
        break;
      case "Anime":
        aestheticRules = "CRITICAL AESTHETIC: You must write visual_prompts that describe Japanese anime style, Studio Ghibli aesthetics, beautiful hand-drawn backgrounds, and cel-shaded characters.";
        break;
      case "Cinematic Documentary":
      default:
        aestheticRules = "CRITICAL AESTHETIC: You must write visual_prompts that describe cinematic documentary footage, hyperrealistic 4k B-roll, dramatic lighting, and shallow depth of field.";
        break;
    }

    const prompt = `
You are an expert Youtube video scriptwriter and director. 
Subject Matter: ${extractedText}
Angle: ${angle}

Generate a short video script (3-5 scenes). 
Each scene must have:
- narration: The voiceover text.
- visual_prompt: A detailed prompt for an AI image generator to create the background.
- duration_estimate_seconds: The duration of the narration in seconds (default to 8 seconds).

${aestheticRules}

Format your response as a JSON object with 'title', 'angle', and a 'scenes' array.
Return ONLY the JSON.
`;

    const runwareModel = modelOverride || "meta:llama-3.1-8b-instruct";
    const finalModel = runwareModel.replace("runware:", "");

    const responseText = await generateRunwareText(prompt, finalModel);
    
    // Clean up potential markdown formatting from the response
    const jsonStr = responseText.replace(/```json\n?|\n?|```/g, '').trim();
    let scriptData;
    try {
      scriptData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse failed for response:", responseText);
      throw new Error("Failed to parse AI response as JSON");
    }

    return NextResponse.json(scriptData);
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
