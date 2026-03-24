import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { sources, targetDurationMinutes = 3 } = await req.json();

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: "No sources provided" }, { status: 400 });
    }

    // Build a combined knowledge dump from all sources
    const knowledgeDump = sources
      .map((s: { title: string; facts: string[] }) => {
        const factList = s.facts.map((f, i) => `  ${i + 1}. ${f}`).join("\n");
        return `SOURCE: ${s.title}\n${factList}`;
      })
      .join("\n\n");

    const prompt = `You are a knowledge synthesis engine for video script creation. You have extracted facts from multiple sources. Your job is to synthesize them into a unified, well-structured knowledge document that can be turned into a compelling ${targetDurationMinutes}-minute video.

EXTRACTED KNOWLEDGE:
${knowledgeDump.substring(0, 10000)}

Create a synthesis document with these sections:

1. **CORE THESIS** (1-2 sentences): The central insight or story that connects all sources
2. **KEY THEMES** (3-5 themes): Major topics that emerge across sources
3. **NARRATIVE ARC**: A suggested story structure with beginning/middle/end
4. **ESSENTIAL FACTS**: The 10-15 most compelling facts that MUST be in the video
5. **SURPRISING INSIGHTS**: 3-5 unexpected connections or revelations from combining these sources
6. **SUGGESTED TITLE**: A catchy video title
7. **SUGGESTED ANGLE**: The best narrative angle for this content

Return ONLY raw JSON (no markdown fences):
{
  "synthesis": "The full synthesis text combining all sections above into a flowing narrative document (500-1000 words)",
  "suggestedTitle": "Video title",
  "suggestedAngle": "Best narrative angle",
  "themes": ["theme1", "theme2", "theme3"],
  "coreThesis": "Central insight"
}`;

    const responseText = await generateGeminiText(prompt);
    let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, "").trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      } catch {
        // If JSON parse fails, return the raw synthesis text
        return NextResponse.json({
          synthesis: cleanText.substring(0, 3000),
          suggestedTitle: "Untitled Video",
          suggestedAngle: "Documentary Overview",
          themes: [],
          coreThesis: "",
        });
      }
    }

    return NextResponse.json({
      synthesis: cleanText.substring(0, 3000),
      suggestedTitle: "Untitled Video",
      suggestedAngle: "Documentary Overview",
      themes: [],
      coreThesis: "",
    });
  } catch (e: any) {
    console.error("Notepad synthesize error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
