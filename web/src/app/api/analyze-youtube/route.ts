import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";
import { parseAIResponse } from "@/lib/jsonUtils";

/**
 * Analyze a YouTube video's style by fetching its page metadata
 * and using AI to extract the storytelling/visual style patterns
 */
export async function POST(req: NextRequest) {
  try {
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl || typeof youtubeUrl !== "string" || !youtubeUrl.trim()) {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    }

    // Extract video ID from various YouTube URL formats
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    console.log(`Analyzing YouTube video: ${videoId}`);

    // Fetch video page to get metadata (title, description, etc.)
    let videoTitle = "";
    let videoDescription = "";
    let channelName = "";

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        videoTitle = oembedData.title || "";
        channelName = oembedData.author_name || "";
      }
    } catch (e) {
      console.warn("oEmbed fetch failed, continuing with AI analysis");
    }

    // Also try to scrape additional metadata from the YouTube page itself
    let thumbnailUrl = "";
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Link2Video/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        // Extract description from meta tag
        const descMatch = html.match(/name="description"\s+content="([^"]*)"/);
        if (descMatch) videoDescription = descMatch[1].slice(0, 500);
        // Extract high-res thumbnail
        const thumbMatch = html.match(/"thumbnails":\[.*?"url":"(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"/);
        if (thumbMatch) thumbnailUrl = thumbMatch[1];
        // Extract keywords
        const kwMatch = html.match(/name="keywords"\s+content="([^"]*)"/);
        if (kwMatch) videoDescription += `\nKeywords: ${kwMatch[1]}`;
      }
    } catch (e) {
      console.warn("Page scrape failed, continuing with oEmbed data");
    }
    if (!thumbnailUrl) {
      thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    // Use AI to deeply analyze every aspect of the video style
    const analysisPrompt = `You are an elite video production analyst who has studied thousands of YouTube videos. Your job is to reverse-engineer this video's EXACT production formula down to every visual, audio, and storytelling detail so we can perfectly clone it for any topic.

YouTube Video: "${videoTitle}"
Channel: "${channelName}"
Description: "${videoDescription}"
URL: ${youtubeUrl}

Based on the title, channel, description, and your knowledge of this channel's production style, perform a DEEP analysis. You should know popular YouTube creators and their distinctive production techniques.

Return a JSON object with ALL these fields (be extremely specific and detailed):
{
  "styleName": "A short 2-4 word name (e.g. 'Kurzgesagt Explainer', 'MrBeast Challenge', 'Vox Visual Essay')",
  "narrativeStyle": "documentary | pov_scenario | pov_levels | every_level | explainer | rich_story | dark_truth | quit_job | listicle | debate | reaction | tutorial | vlog",
  "visualStyle": "Best match: Cinematic Documentary, Photorealistic, Film Noir, 70s Retro Film, 80s VHS Aesthetic, Anime, Wes Anderson, Christopher Nolan, Blade Runner Cyberpunk, Golden Hour Cinema, Neon Noir, Studio Ghibli, Dreamlike Surrealism, High Fashion Editorial, Street Photography, Drone Aerial, Watercolor Illustration, Pop Art, Minimalist, Dark Academia, Vaporwave, Retro Futurism, Comic Book, Oil Painting",
  "pacing": "fast | medium | slow",
  "sceneDuration": "Average seconds per scene/cut (e.g. 3-5 for fast, 6-10 for medium, 10+ for slow)",
  "toneKeywords": ["list", "of", "5-8", "specific", "tone", "descriptors"],
  "hookStyle": "EXACT technique: what happens in the first 5 seconds. Quote an example opening line if possible.",
  "hookExample": "Write a sample hook line in the style of this video",
  "transitionStyle": "Detailed: cut type, motion graphics, sound effects, visual bridges",
  "transitionTechniques": ["specific", "transition", "techniques", "used"],
  "narrationStyle": "Detailed voice characteristics: gender, pace (words per minute estimate), energy level, emotional range, accent, pauses, emphasis patterns",
  "narrationVoice": "Best matching voice preset: adam | alloy | echo | fable | onyx | nova | shimmer | rachel | drew | clyde | paul | domi | elli | josh | arnold | sam | bella",
  "sceneStructure": "Step-by-step breakdown of the video structure (e.g. 'hook → context → escalation → climax → lesson → CTA')",
  "sceneBreakdown": [
    {"section": "Hook", "duration": "0:00-0:10", "description": "What happens visually and narratively"},
    {"section": "Setup", "duration": "0:10-0:30", "description": "How the topic is introduced"},
    {"section": "Main Content", "duration": "varies", "description": "How the bulk of the content is presented"},
    {"section": "Conclusion", "duration": "last 15-30s", "description": "How it wraps up"}
  ],
  "colorGrading": "Specific color palette: warm/cool, contrast level, saturation, dominant colors, color shifts between scenes",
  "lightingStyle": "Key lighting approach: natural, dramatic, neon, soft diffused, harsh shadows, backlit, golden hour",
  "cameraWork": "Specific camera movements: static, handheld, dolly, drone, tracking shots, zoom patterns, dutch angles",
  "cameraAngles": ["list", "of", "primary", "camera", "angles", "used"],
  "textOnScreen": "How text appears: font style, animation, lower thirds, titles, callouts, motion graphics style",
  "soundDesign": "Background music style, sound effects, ambient sounds, audio transitions, bass drops, whooshes",
  "musicGenre": "Background music genre and mood (e.g. 'lo-fi hip hop, chill', 'epic orchestral, building intensity')",
  "thumbnailStyle": "Face close-up, bold text, bright colors, dark/moody, clean minimal, before/after, etc.",
  "audienceEmotion": "The primary emotions the video is designed to evoke in order (e.g. 'curiosity → shock → aspiration → urgency')",
  "visualPromptSuffix": "A DETAILED 40-60 word suffix to append to every image prompt to visually match this style — include specific camera angles, lens type, color grading, lighting, composition, mood, texture, depth of field, film grain, contrast. Be extremely precise.",
  "description": "3-5 sentence detailed description of what makes this video style distinctive, engaging, and successful. Mention specific visual and narrative techniques."
}

Return ONLY the JSON. No markdown, no code blocks, no explanation.`;

    const responseText = await generateGeminiText(analysisPrompt);

    // Use the hardened parseAIResponse for resilience against reasoning preambles & content filters
    let styleData: any;
    try {
      styleData = parseAIResponse(
        responseText,
        (parsed: any) => !!(parsed && (parsed.styleName || parsed.visualStyle))
      );
      console.log(`Style analysis complete: ${styleData.styleName}`);
    } catch (err: any) {
      console.error("Failed to parse style analysis JSON:", err.message);
      throw new Error("Failed to parse AI style analysis");
    }

    // Add metadata
    styleData.sourceVideoId = videoId;
    styleData.sourceVideoTitle = videoTitle;
    styleData.sourceChannel = channelName;
    styleData.sourceUrl = youtubeUrl;
    styleData.thumbnailUrl = thumbnailUrl;
    styleData.createdAt = new Date().toISOString();

    return NextResponse.json({ success: true, style: styleData });

  } catch (error: any) {
    console.error("YouTube analysis error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze video" }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
