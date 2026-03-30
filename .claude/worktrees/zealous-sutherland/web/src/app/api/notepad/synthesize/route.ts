import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export const maxDuration = 180;

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

    const prompt = `You are a Cinematic Director, Executive Producer, and Master of Visual Narrative. You think like a world-class Auteur—combining the information density of a documentary filmmaker with the visual flair of a high-budget commercial director. Your superpower is transforming "flat" information into an immersive, multi-sensory journey that commands absolute attention.

GOAL: Perform a deep analysis of the provided sources and synthesize them into a production-ready Director's Treatment.

EXTRACTED KNOWLEDGE:
${knowledgeDump.substring(0, 15000)}

Follow these strict rules for the synthesis:
- Attention is Currency: Every second must justify its existence.
- Semantic Motion: Camera movement represents focus, context, or connection.
- Source Integrity: Use only provided data.

OUTPUT FORMAT (Return a JSON object with these fields):
{
  "synthesis": "The full Director's Treatment following this structure:
    # FILM TITLE AND LOGLINE
    - Inferred Narrative Arc: A concise summary of the 'story'.
    - Film Title: A sharp, evocative, 'theatrical' title.
    - The Logline: A one-sentence hook.

    # PRODUCTION DESIGN AND AUTEUR STYLE
    - Cinematic DNA: Choose a specific filmic style (e.g., Noir, Minimalist Scandi, High-Tech Futurism, Handheld Documentary).
    - The 'Look' (Color & Grade): Primary Palette (HEX codes) + Lighting & Texture (mood) + Sonic Identity (Audio Mood).
    - Camera Language: Movement style (e.g., Majestic drone sweeps vs Jittery handheld).

    # FORBIDDEN TROPES
    - No 'Talking Head' shots > 3s, no generic corporate music, no scrolling text.

    # NARRATIVE COMPOSITION RULES
    - Rule 1 (The 3-Second Rule): Visual interest must evolve every 3s.
    - Rule 2 (Typography as Architecture): Text exists within the 3D space.
    - Rule 3 (Show, Don't Tell): Visual representation of scale/data.

    # THE SCENE-BY-SCENE STORYBOARD (10–12 Key Sequences)
    For each scene: Scene # | Duration | Sequence Type | Visual Description | Camera Movement | On-Screen Text/Graphics | Voiceover/Script Fragment | Source Anchor.",

  "suggestedTitle": "Theatrical Title",
  "suggestedAngle": "Auteur Style / Production Design",
  "themes": ["theme1", "theme2", "theme3"],
  "coreThesis": "The central insight"
}

Return ONLY raw JSON. No markdown fences.`;

    console.log(`[synthesize] Generating cinematic treatment for ${sources.length} sources (${targetDurationMinutes}min)...`);
    const responseText = await generateGeminiText(prompt);
    let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, "").trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[synthesize] Success — title: "${parsed.suggestedTitle}", synthesis: ${parsed.synthesis?.length || 0} chars`);
        return NextResponse.json(parsed);
      } catch {
        console.warn("[synthesize] JSON parse failed, returning raw text");
        return NextResponse.json({
          synthesis: cleanText.substring(0, 5000),
          suggestedTitle: "Untitled Video",
          suggestedAngle: "Documentary Overview",
          themes: [],
          coreThesis: "",
        });
      }
    }

    return NextResponse.json({
      synthesis: cleanText.substring(0, 5000),
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
