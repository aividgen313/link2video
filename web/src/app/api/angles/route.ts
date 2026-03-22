import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, durationMinutes = 3 } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "Topic must be a non-empty string" }, { status: 400 });
    }

    if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
      return NextResponse.json({ error: "durationMinutes must be a number between 1 and 120" }, { status: 400 });
    }

    const prompt = `
You are an elite viral content strategist who has produced Netflix documentaries and YouTube videos with 100M+ views.
Topic: ${topic}

Generate 4 unique story angles that would make viewers STOP SCROLLING and watch the entire video. Each angle must have a different emotional strategy — do NOT repeat the same "shocking truth" formula four times.

Think like a showrunner: What angle would make THIS topic go viral? What would make someone share this with everyone they know?

The 4 angles should each use a DIFFERENT narrative strategy from this list:
1. Mystery/Revelation — "The thing nobody knows about X" — builds curiosity through unanswered questions
2. Emotional Journey — "How X changed everything" — follows a personal/human arc with stakes
3. Conflict/Controversy — "Why X is more dangerous than you think" — creates tension and debate
4. Behind-the-Scenes — "Inside the hidden world of X" — exclusive access, insider knowledge

Format your response as a JSON array of objects, each with these keys:
- "title": A compelling, clickable angle title that creates curiosity (NOT generic — make it feel like a Netflix episode title, max 12 words)
- "description": 2-3 sentences explaining: (1) the cold open moment, (2) the narrative arc, (3) the emotional payoff at the end
- "type": The content type (e.g. "True Crime Documentary", "Investigative Expose", "Emotional Narrative", "Mind-Blowing Explainer", "Conspiracy Deep Dive")
- "duration": "${durationMinutes} min" (the user wants a ${durationMinutes}-minute video)

Return ONLY the JSON array. No explanations, no markdown, no code blocks.
`;

    console.log("Generating angles via Pollinations...");
    const responseText = await generateGeminiText(prompt);
    console.log("Raw angles response (first 300 chars):", responseText.substring(0, 300));

    // Clean up response text: strip <think> tags, markdown fences, and extract JSON
    let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Strip ALL markdown code fences anywhere in the text
    cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, '').trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    let jsonStr = jsonMatch ? jsonMatch[0] : cleanText;

    let anglesData;
    try {
      anglesData = JSON.parse(jsonStr);
      console.log("Successfully parsed angles data");
    } catch (e) {
      // Try removing trailing commas before closing brackets/braces and re-parse
      try {
        const sanitized = jsonStr.replace(/,\s*([\]}])/g, '$1');
        anglesData = JSON.parse(sanitized);
        console.log("Parsed angles after removing trailing commas");
      } catch (e2) {
        console.error("JSON Parse failed for response:", responseText.substring(0, 500));
        throw new Error("Failed to parse AI response as JSON.");
      }
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
