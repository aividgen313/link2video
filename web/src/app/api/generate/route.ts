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

    // Detect narrative style from topic keywords
    const topicLower = extractedText.toLowerCase();
    let narrativeStyle = "documentary";
    if (topicLower.startsWith("pov:") || topicLower.startsWith("pov |") || topicLower.startsWith("pov:")) {
      if (topicLower.includes("every") || topicLower.includes("level") || topicLower.includes("tier")) {
        narrativeStyle = "pov_levels";
      } else {
        narrativeStyle = "pov_scenario";
      }
    } else if (topicLower.includes("every level") || topicLower.includes("every tier") || topicLower.includes("every type")) {
      narrativeStyle = "every_level";
    } else if (topicLower.startsWith("simply explaining") || topicLower.startsWith("explain") || topicLower.includes("questions everyone") || topicLower.includes("q&a")) {
      narrativeStyle = "explainer";
    } else if ((topicLower.includes("how") && (topicLower.includes("billionaire") || topicLower.includes("millionaire") || topicLower.includes("empire") || topicLower.includes("rich") || topicLower.includes("wealthy") || topicLower.includes("built"))) ||
               topicLower.includes("broke") && topicLower.includes("billion")) {
      narrativeStyle = "rich_story";
    }

    let narrativeInstructions = "";
    switch (narrativeStyle) {
      case "pov_scenario":
        narrativeInstructions = `
NARRATIVE FORMAT: POV SCENARIO (2nd Person Immersive)
Write ENTIRELY in 2nd person ("You wake up...", "You check your phone...", "Your heart races...").
Take the viewer through a vivid, emotional day-in-the-life experience of the scenario.
Structure: Morning/Beginning → Building excitement/tension → A major moment of change → Emotional peak → Reflection → Powerful final thought.
Every scene should make the viewer FEEL like they are inside the experience.
Use specific, sensory details: sounds, sights, feelings, smells. Make it cinematic and visceral.
Example narration style: "You open your eyes. The room is quiet. But today is different. Your phone buzzes once. Then again. You look down at the screen..."
`;
        break;
      case "pov_levels":
        narrativeInstructions = `
NARRATIVE FORMAT: POV LEVELS (2nd Person Tier Comparison)
Write in 2nd person ("You wake up at..."), but progress through distinct LEVELS/TIERS from lowest to highest.
Each scene = one tier or level. Show stark contrast between how different levels experience the same situation.
Start at the lowest level (broke/beginner) and climb to the highest (wealthy/elite).
Structure: Level 1 (bottom) → Level 2 → Level 3 → Level 4 → Level 5 → Level 6 (top) → Final reflection.
Make the contrast between each level VIVID and SURPRISING. Specific details = credibility.
Example: "Level 1: You set 4 alarms. You're exhausted. You eat cereal with no milk... Level 6: Your assistant calls. Your jet is ready."
`;
        break;
      case "every_level":
        narrativeInstructions = `
NARRATIVE FORMAT: EVERY LEVEL COMPARISON (3rd Person Tier Breakdown)
Break the topic into clear WEALTH/SKILL/STATUS LEVELS and show how each level experiences the same concept DIFFERENTLY.
Write in a confident, authoritative documentary voice.
Structure: Intro hook → Level 1 (bottom 20%) → Level 2 → Level 3 → Level 4 → Level 5 (top 1%) → Surprising revelation → Final takeaway.
Each level must have SPECIFIC, REALISTIC details. The contrast should be dramatic and eye-opening.
Use dollar amounts, time, specific habits, tools, mindsets that change at each level.
Example: "At $0, your morning alarm is survival. At $100K, it's optimization. At $10M, your morning doesn't start until your team is ready."
`;
        break;
      case "explainer":
        narrativeInstructions = `
NARRATIVE FORMAT: SIMPLE EXPLAINER (Demystify Complex Topics)
Write like the world's best teacher — clear, simple, relatable, and surprising.
NO jargon. Explain everything with analogies and real-world examples a 12-year-old would understand.
Structure: Hook question → Why this matters to you → Simple analogy → Deeper truth → Real-world example → Common misconception debunked → Key takeaway.
Each scene should answer a question the viewer is already silently asking.
Use "Here's the thing...", "Think of it like this...", "Most people don't realize..." language naturally.
Make complex topics feel surprisingly simple and make the viewer feel smart for watching.
`;
        break;
      case "rich_story":
        narrativeInstructions = `
NARRATIVE FORMAT: WEALTH ORIGIN STORY (Documentary Biography)
Tell a gripping, specific story of how someone built extraordinary wealth from nothing.
Write like a Netflix documentary — dramatic, specific, emotionally resonant.
Structure: Shocking hook (where they ended up) → Humble/difficult beginning → First breakthrough moment → Key insight or turning point → Rapid rise → What most people missed → The bigger lesson.
Use real-sounding specific details: dollar amounts, years, decisions, sacrifices.
The viewer should feel the emotional journey — from desperation to triumph.
Focus on the mindset shifts, the decisions others wouldn't make, and the unconventional path.
`;
        break;
      default: // documentary
        narrativeInstructions = `
NARRATIVE FORMAT: CINEMATIC DOCUMENTARY
Write in a compelling, cinematic documentary voice — authoritative yet emotionally engaging.
Structure: HOOK → SETUP → RISING TENSION → CLIMAX → RESOLUTION → FINAL LINE.
`;
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
You are an elite YouTube scriptwriter and viral content creator.
You specialize in creating HIGH-RETENTION scripts that keep viewers watching until the very last second.
Every script you write feels like it belongs on a channel with millions of subscribers.

Subject Matter: ${extractedText}
Angle: ${angle}

${narrativeInstructions}

UNIVERSAL WRITING RULES:
- Vary sentence length for rhythm and pacing
- Use short punchy lines during intense or dramatic moments
- Use longer sentences for storytelling and atmosphere
- Every 10-20 seconds must introduce new information, a question, or a twist
- NEVER use filler words or generic phrasing
- Use psychological triggers: curiosity, suspense, surprise, empathy, aspiration

VISUAL PROMPT RULES:
- Each scene's visual_prompt must describe EXACTLY what should appear on screen
- Be specific about: camera movement, mood, lighting, subject, composition
- Think cinematic B-roll, Ken Burns-style photography, atmospheric footage
- The visual must emotionally reinforce the narration

${aestheticRules}

SCRIPT OUTPUT:
Generate 6-10 scenes following the narrative format above.

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
