import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";
import { parseAIResponse } from "@/lib/jsonUtils";

export const maxDuration = 300; // Increased to 5 minutes for complex topic analysis

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, durationMinutes = 3 } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "Topic must be a non-empty string" }, { status: 400 });
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
    const responseText = await generateGeminiText(prompt, true);
    console.log("RAW AI RESPONSE FOR ANGLES:", responseText.substring(0, 500));

    let angles: any[];
    try {
      angles = parseAIResponse(
        responseText,
        (parsed: any) => {
          return Array.isArray(parsed) || (parsed.angles && Array.isArray(parsed.angles));
        },
        (validObjects: any[]) => {
          const allAngles: any[] = [];
          for (const obj of validObjects) {
            if (Array.isArray(obj)) {
              allAngles.push(...obj);
            } else if (obj.angles && Array.isArray(obj.angles)) {
              allAngles.push(...obj.angles);
            }
          }
          return allAngles;
        }
      );
    } catch (parseError: any) {
      return NextResponse.json({ error: parseError.message, rawAIOutput: responseText.substring(0, 1000) }, { status: 500 });
    }

    if (angles.length === 0) {
      throw new Error(`AI response contained no valid angles. Raw output: ${responseText.substring(0, 500)}`);
    }

    console.log("Generated", angles.length, "angles");
    return NextResponse.json({ angles });
  } catch (error: any) {
    console.error("Angle generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate angles", rawOutput: process.env.NODE_ENV === 'development' ? error.message : undefined }, { status: 500 });
  }
}
