import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { topic, url, angle, visualStyle = "Cinematic Documentary" } = await req.json();

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
        extractedText = $("body").text().slice(0, 5000);
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
You are an expert YouTube video scriptwriter and cinematic documentary director specializing in viral storytelling.

Subject Matter: ${extractedText}
Angle: ${angle}

CORE STORY RULE (MANDATORY):
Every script MUST follow this 3-act narrative structure:

1. BEGINNING (HOOK + SETUP)
   - Open with a POWERFUL HOOK within the first 5-10 seconds
   - A shocking statement, question, or moment that creates immediate curiosity or tension
   - Introduce the subject, context, and central question or mystery
   - Goal: Make the viewer NEED to keep watching

2. MIDDLE (BUILD + CONFLICT + ESCALATION)
   - Gradually reveal deeper layers of the story
   - Introduce conflict, obstacles, contradictions, and stakes
   - Build tension and add new information that changes perspective
   - Include emotional beats and turning points
   - Important: The story must EVOLVE—not just list facts

3. CLIMAX (PEAK MOMENT)
   - The most intense, revealing, or emotional moment
   - Where the truth is exposed, conflict reaches its highest point
   - Everything comes together
   - Goal: Deliver a moment that feels impactful and unforgettable

4. ENDING (RESOLUTION + AFTERMATH)
   - Provide closure or reflection
   - Show what happened after, the consequences, the bigger meaning
   - End with a strong final line, thought, or question
   - Goal: Leave the viewer thinking

WRITING STYLE REQUIREMENTS:
- Write in cinematic, documentary narration style
- Use short, punchy sentences for impact
- Use occasional longer lines for emotional weight
- Avoid robotic or overly formal language
- Avoid flat, encyclopedic explanations
- Tone should feel: real, immersive, slightly dramatic (but not fake)

PACING RULES:
- Every 10-20 seconds, something new must happen: new information, a twist, or a deeper layer
- Avoid long stretches of static or repetitive narration

VISUAL AWARENESS:
- Write with visual storytelling in mind
- Each narration line should connect to a visual moment
- Think like an editor cutting between shots

ENGAGEMENT RULES:
- Trigger curiosity early
- Build emotional investment
- Maintain tension throughout
- Deliver a satisfying payoff

SCRIPT STRUCTURE:
Generate a compelling short video script with 5-8 scenes following the 3-act structure above.

Each scene must have:
- narration: Cinematic voiceover text (short, punchy, engaging)
- visual_prompt: Detailed prompt for AI image/video generation describing the exact visual moment
- duration_estimate_seconds: Duration based on narration length (typically 6-12 seconds per scene)

${aestheticRules}

QUALITY CHECK BEFORE RESPONDING:
- Does the story have a clear beginning, middle, and end?
- Is there real tension and progression?
- Does it feel like something people would actually watch?
- Does it tell a STORY, not just inform?

Format your response as a JSON object with:
{
  "title": "Compelling video title",
  "angle": "The narrative angle/hook",
  "scenes": [
    {
      "narration": "The voiceover text",
      "visual_prompt": "Detailed visual description",
      "duration_estimate_seconds": 8
    }
  ]
}

Return ONLY the JSON. No explanations.
`;

    console.log("Generating script via Groq...");
    const responseText = await generateGeminiText(prompt);
    console.log("Raw AI response (first 500 chars):", responseText.substring(0, 500));

    // Clean up response text: strip <think> tags and extract JSON
    const cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;

    let scriptData;
    try {
      scriptData = JSON.parse(jsonStr);
      console.log("Successfully parsed script with", scriptData.scenes?.length || 0, "scenes");
    } catch (e) {
      console.error("JSON Parse failed for response:", responseText);
      throw new Error("Failed to parse AI response as JSON.");
    }

    if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
      throw new Error("AI response missing required 'scenes' array");
    }

    // Ensure every scene has an id and scene_number (AI doesn't generate these)
    scriptData.scenes = scriptData.scenes.map((scene: any, index: number) => ({
      ...scene,
      id: scene.id ?? index + 1,
      scene_number: scene.scene_number ?? index + 1,
      duration_estimate_seconds: scene.duration_estimate_seconds || 8,
    }));

    return NextResponse.json(scriptData);
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
