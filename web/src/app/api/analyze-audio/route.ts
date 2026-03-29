import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";
import { parseAIResponse } from "@/lib/jsonUtils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lyrics, durationSeconds } = body;

    const parsedDuration = Number(durationSeconds);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 7200) {
      return NextResponse.json({ error: "durationSeconds must be a number between 1 and 7200" }, { status: 400 });
    }
    if (lyrics != null && typeof lyrics !== "string") {
      return NextResponse.json({ error: "lyrics must be a string" }, { status: 400 });
    }

    // If lyrics provided, use AI to segment them
    if (lyrics && lyrics.trim().length > 20) {
      const prompt = `You are a music structure analyst. Given these song lyrics and a total song duration of ${durationSeconds} seconds, split the lyrics into labeled segments with timestamps.

LYRICS:
${lyrics.substring(0, 5000)}

RULES:
- Identify: intro, verse, chorus, bridge, outro sections
- Assign realistic timestamps that sum to ${durationSeconds} seconds total
- Each segment gets the matching lyrics text
- Typical structure: intro (10-20s), verse (20-40s), chorus (20-35s), bridge (15-25s), outro (10-20s)
- Choruses usually repeat. Verses have different lyrics each time.
- If lyrics are short, spread them across fewer segments
- Return ONLY raw JSON, no markdown fences

Return JSON array:
[
  { "id": 1, "type": "intro", "startTime": 0, "endTime": 15, "lyrics": "..." },
  { "id": 2, "type": "verse", "startTime": 15, "endTime": 45, "lyrics": "..." },
  ...
]`;

      const responseText = await generateGeminiText(prompt);
      
      try {
        const segments = parseAIResponse(
          responseText,
          (parsed: any) => Array.isArray(parsed) && parsed.length > 0 && parsed[0].type !== undefined
        );
        return NextResponse.json({ segments });
      } catch (err: any) {
        console.error("Failed to parse AI segment analysis:", err.message);
        throw new Error("Failed to parse AI segment analysis");
      }
    }

    // No lyrics: generate heuristic segments based on typical song structure
    const segments = generateHeuristicSegments(durationSeconds);
    return NextResponse.json({ segments });

  } catch (error: any) {
    console.error("Audio analysis error:", error);
    return NextResponse.json({ error: error.message || "Audio analysis failed" }, { status: 500 });
  }
}

function generateHeuristicSegments(durationSeconds: number): any[] {
  // Standard song structure proportions
  const structure = [
    { type: "intro", proportion: 0.06 },
    { type: "verse", proportion: 0.15 },
    { type: "chorus", proportion: 0.13 },
    { type: "verse", proportion: 0.15 },
    { type: "chorus", proportion: 0.13 },
    { type: "bridge", proportion: 0.10 },
    { type: "chorus", proportion: 0.15 },
    { type: "outro", proportion: 0.13 },
  ];

  // For short songs (< 90s), use simpler structure
  const simpleStructure = [
    { type: "intro", proportion: 0.10 },
    { type: "verse", proportion: 0.25 },
    { type: "chorus", proportion: 0.30 },
    { type: "verse", proportion: 0.25 },
    { type: "outro", proportion: 0.10 },
  ];

  const parts = durationSeconds < 90 ? simpleStructure : structure;
  const segments: any[] = [];
  let currentTime = 0;

  parts.forEach((part, index) => {
    const duration = Math.round(durationSeconds * part.proportion);
    const endTime = index === parts.length - 1 ? durationSeconds : currentTime + duration;
    segments.push({
      id: index + 1,
      type: part.type,
      startTime: Math.round(currentTime),
      endTime: Math.round(endTime),
      lyrics: "",
    });
    currentTime = endTime;
  });

  return segments;
}
