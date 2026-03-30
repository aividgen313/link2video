import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { title, angle, scenes = [], dimension = "16:9" } = await req.json();

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }

    const narrationSummary = scenes
      .slice(0, 4)
      .map((s: { narration: string }) => s.narration)
      .join(" ")
      .slice(0, 800);

    const prompt = `
You are an elite social media strategist who creates viral content copy.

Video Details:
- Title: ${title}
- Narrative Angle: ${angle}
- Content Preview: "${narrationSummary}"
- Aspect Ratio: ${dimension}

Generate highly optimized social media copy for this video. Make it punchy, engaging, and designed for maximum reach.

Return ONLY this JSON (no markdown, no explanations):
{
  "youtube": {
    "title": "Clickable, SEO-optimized title under 70 chars with power words",
    "description": "3-4 paragraph description with storytelling hook, context, and CTA. Include natural keyword placement. End with subscribe prompt.",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"]
  },
  "tiktok": {
    "caption": "Punchy caption under 150 chars that hooks in the first 5 words",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6", "hashtag7", "hashtag8"]
  },
  "instagram": {
    "caption": "Conversational 2-3 sentence caption that builds curiosity, ends with a question to drive comments. Add 12-15 relevant hashtags at the end separated by spaces."
  },
  "twitter": {
    "tweet": "Compelling tweet under 280 chars with a hook + link prompt"
  }
}
`;

    const responseText = await generateGeminiText(prompt);
    const cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    let data;
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Social copy error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
