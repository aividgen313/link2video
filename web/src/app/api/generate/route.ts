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
You are an elite documentary storyteller and viral content writer.
Your job is to create HIGH-RETENTION, EMOTIONALLY ENGAGING, CINEMATIC documentary-style scripts designed to keep viewers watching until the very end.
The script MUST feel like a Netflix-level documentary or a viral YouTube video with millions of views.

Subject Matter: ${extractedText}
Angle: ${angle}

STRUCTURE REQUIREMENTS:

1. HOOK (First 5-15 seconds)
   - Start with a powerful, curiosity-driven hook
   - This can be shocking, mysterious, emotional, or controversial
   - DO NOT introduce the topic normally
   - The viewer should feel: "Wait... what?! I need to keep watching"

2. SETUP (Context + Stakes)
   - Introduce the subject clearly
   - Explain why this story matters
   - Establish stakes (what's at risk, what's unusual, why it's important)
   - Make the viewer emotionally invested

3. RISING TENSION
   - Slowly reveal new information
   - Introduce conflict, mystery, or unanswered questions
   - Add twists, surprises, or contradictions
   - Keep increasing curiosity every 10-20 seconds
   - Each section should make the viewer NEED the next answer

4. CLIMAX (Peak Moment)
   - Deliver the biggest reveal, turning point, or emotional high
   - This should feel earned and powerful
   - This is the moment everything builds toward

5. RESOLUTION (Aftermath)
   - Explain what happened after the climax
   - Show consequences, impact, or lessons
   - Give emotional closure

6. FINAL LINE (Retention Loop)
   - End with a strong, memorable line
   - Can be thought-provoking, ironic, or open-ended
   - Should leave the viewer thinking or wanting more

STYLE REQUIREMENTS:
- Write in a cinematic, immersive tone
- Use vivid, descriptive language
- Avoid generic phrasing
- Vary sentence length for rhythm
- Use short punchy lines during intense moments
- Use longer descriptive lines for storytelling

ENGAGEMENT RULES:
- Every 10-20 seconds, introduce a new piece of information, question, or twist
- Avoid filler or repetition
- Maintain emotional tension throughout
- Use psychological triggers: curiosity, suspense, surprise, empathy

VISUAL PROMPT RULES:
- Each scene's visual_prompt must describe exactly what should be shown on screen
- Be specific about: camera movement, mood, lighting, subject, composition
- Think cinematic B-roll, Ken Burns-style images, or dramatic footage
- The visual must emotionally match the narration

${aestheticRules}

SCRIPT OUTPUT:
Generate 6-10 scenes that follow the structure above (HOOK -> SETUP -> RISING TENSION -> CLIMAX -> RESOLUTION -> FINAL LINE).

Each scene must have:
- narration: The voiceover text (cinematic, immersive, emotionally engaging)
- visual_prompt: Detailed AI image generation prompt describing the exact visual moment (camera angle, lighting, mood, subject)
- duration_estimate_seconds: Duration based on narration length (typically 6-12 seconds per scene)

QUALITY CHECK BEFORE RESPONDING:
- Does the HOOK make you stop scrolling?
- Does the story have real emotional stakes?
- Is there genuine tension and progression?
- Does it feel like a Netflix documentary, not a Wikipedia article?
- Would this realistically get millions of views?
- Does the FINAL LINE leave a lasting impression?

Format your response as a JSON object with:
{
  "title": "Compelling, clickable video title",
  "angle": "The narrative angle/hook",
  "scenes": [
    {
      "narration": "The voiceover text",
      "visual_prompt": "Detailed visual description with camera movement, mood, lighting",
      "duration_estimate_seconds": 8
    }
  ]
}

Return ONLY the JSON. No explanations, no markdown, no code blocks.
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
