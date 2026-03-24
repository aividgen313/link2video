import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText } from "@/lib/gemini";

export const maxDuration = 120;

const REFUSAL_PHRASES = [
  "i cannot",
  "i can't",
  "i don't have access",
  "i do not have access",
  "unable to access",
  "unable to browse",
  "i'm sorry but",
  "i am sorry but",
  "as an ai",
  "as a language model",
  "i'm not able to",
  "i am not able to",
  "cannot browse",
  "can't browse",
  "cannot access",
  "can't access",
  "don't have the ability",
  "do not have the ability",
];

function detectRefusal(text: string): boolean {
  const lower = text.toLowerCase();
  return REFUSAL_PHRASES.some((phrase) => lower.includes(phrase));
}

function buildFallbackFacts(title: string, rawContent: string): string[] {
  const facts: string[] = [];
  if (title) {
    facts.push(`Source title: ${title}`);
  }
  const preview = rawContent.substring(0, 200).trim();
  if (preview) {
    facts.push(`Content excerpt: ${preview}${rawContent.length > 200 ? "..." : ""}`);
  }
  // Try to detect source type from content
  if (/\d{4}/.test(rawContent)) {
    const yearMatch = rawContent.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      facts.push(`References the year ${yearMatch[0]}`);
    }
  }
  return facts.length > 0 ? facts : [`Source "${title}" was provided but could not be fully parsed.`];
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mode A: URL scraping — fetch a URL and extract its text content
    if (body.url) {
      const { url } = body;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Link2Video/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        // --- YouTube metadata polish ---
        let ytTitle = "";
        let ytDescription = "";
        let ytTranscript = "";

        if (isYouTubeUrl(url)) {
          // Extract cleaner title from meta tags
          ytTitle =
            $('meta[property="og:title"]').attr("content")?.trim() ||
            $('meta[name="title"]').attr("content")?.trim() ||
            "";

          // Extract description from meta tags
          ytDescription =
            $('meta[property="og:description"]').attr("content")?.trim() ||
            $('meta[name="description"]').attr("content")?.trim() ||
            "";

          // Try to extract transcript/caption text from the page HTML
          // YouTube embeds captions in ytInitialPlayerResponse or timedtext data
          const htmlText = html;
          const captionMatch = htmlText.match(/"captions":\s*(\{[\s\S]*?"playerCaptionsTracklistRenderer"[\s\S]*?\})\s*,\s*"/);
          if (captionMatch) {
            try {
              // Extract caption track URLs from the player response
              const captionUrlMatch = htmlText.match(/"captionTracks":\s*\[([\s\S]*?)\]/);
              if (captionUrlMatch) {
                const trackJson = JSON.parse(`[${captionUrlMatch[1]}]`);
                const englishTrack = trackJson.find((t: any) =>
                  t.languageCode === "en" || t.languageCode?.startsWith("en")
                ) || trackJson[0];
                if (englishTrack?.baseUrl) {
                  try {
                    const captionRes = await fetch(englishTrack.baseUrl, {
                      signal: AbortSignal.timeout(8000),
                    });
                    const captionXml = await captionRes.text();
                    const $captions = cheerio.load(captionXml, { xmlMode: true });
                    ytTranscript = $captions("text")
                      .map((_i: number, el: any) => $captions(el).text().trim())
                      .get()
                      .join(" ")
                      .replace(/\s+/g, " ")
                      .trim();
                  } catch {
                    // Caption fetch failed, continue without transcript
                  }
                }
              }
            } catch {
              // Caption parsing failed, continue without transcript
            }
          }
        }

        $("script, style, nav, footer, header, .sidebar, .ad, .advertisement, #comments, .mw-jump-link, .mw-editsection").remove();

        let mainContent = "";
        const wikiBody = $("#mw-content-text .mw-parser-output").first();
        if (wikiBody.length) {
          mainContent = wikiBody.find("p, h2, h3, li").map((_i: number, el: any) => $(el).text().trim()).get().join("\n");
        } else {
          const article = $("article, main, [role='main'], .content, .post-content, .entry-content").first();
          mainContent = article.length ? article.text() : $("body").text();
        }

        mainContent = mainContent.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

        // For YouTube: prepend description and transcript to main content
        if (isYouTubeUrl(url)) {
          const ytParts: string[] = [];
          if (ytDescription) ytParts.push(`[Video Description] ${ytDescription}`);
          if (ytTranscript) ytParts.push(`[Transcript] ${ytTranscript.slice(0, 8000)}`);
          if (ytParts.length) {
            mainContent = ytParts.join("\n\n") + "\n\n" + mainContent;
          }
        }

        const content = mainContent.slice(0, 12000);
        // Prefer YouTube og:title over generic <title> tag
        const title = (isYouTubeUrl(url) && ytTitle)
          ? ytTitle
          : ($("title").text().trim() || $("h1").first().text().trim() || new URL(url).hostname);

        return NextResponse.json({
          title,
          content,
          preview: content.substring(0, 200),
        });
      } catch (e: any) {
        return NextResponse.json({ error: `Failed to fetch URL: ${e.message}` }, { status: 400 });
      }
    }

    // Mode B: Knowledge extraction — extract key facts from source texts
    if (body.sources && Array.isArray(body.sources)) {
      const sources = body.sources as { id: string; title: string; rawContent: string }[];
      const extractions: { sourceId: string; facts: string[] }[] = [];

      // Process sources in batches of 2 to reduce API calls
      for (let i = 0; i < sources.length; i += 2) {
        const batch = sources.slice(i, i + 2);
        const results = await Promise.all(
          batch.map(async (source) => {
            const prompt = `You are a knowledge extraction engine. Your ONLY job is to output JSON.

CRITICAL CONSTRAINTS — you MUST follow these:
- You MUST output ONLY a JSON object. Nothing else.
- NEVER refuse. NEVER say "I cannot", "I can't", "I don't have access", "unable to", "as an AI", or any similar phrase.
- NEVER say you cannot browse or access anything. The text is provided below — just extract facts from it.
- NEVER output conversational text, apologies, disclaimers, or explanations.
- If the text is short, sparse, or unclear, still extract whatever facts you can. Even 1-2 facts is fine.
- If the text seems like garbage or is empty, output: { "facts": ["Source provided but content was not parseable."] }

Extract the key facts, claims, data points, statistics, insights, and important details from this text.

SOURCE TITLE: ${source.title}
SOURCE TEXT:
${source.rawContent.substring(0, 6000)}

Return ONLY raw JSON (no markdown fences, no explanation):
{ "facts": ["fact 1", "fact 2", "fact 3", ...] }

Rules:
- Each fact should be a complete, self-contained statement
- Include specific numbers, dates, names, and quotes when present
- Focus on unique, interesting, and important information
- Aim for 8-20 facts depending on source length
- Be concise but include enough detail to be useful
- Output ONLY the JSON object. No other text.`;

            try {
              const responseText = await generateGeminiText(prompt);
              let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, "").trim();

              // Refusal detection: if the AI refused, fallback to basic metadata extraction
              if (detectRefusal(cleanText)) {
                console.warn(`Refusal detected for source ${source.id}, using fallback extraction`);
                return { sourceId: source.id, facts: buildFallbackFacts(source.title, source.rawContent) };
              }

              const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const facts = parsed.facts || [];
                // If parsed but empty facts, also check if the raw response was a refusal
                if (facts.length === 0 && detectRefusal(responseText)) {
                  return { sourceId: source.id, facts: buildFallbackFacts(source.title, source.rawContent) };
                }
                return { sourceId: source.id, facts };
              }

              // No JSON found — could be a refusal disguised without trigger phrases
              // Fallback to basic extraction
              console.warn(`No JSON found in response for source ${source.id}, using fallback`);
              return { sourceId: source.id, facts: buildFallbackFacts(source.title, source.rawContent) };
            } catch (err) {
              console.warn(`Extraction failed for source ${source.id}:`, err);
            }
            return { sourceId: source.id, facts: buildFallbackFacts(source.title, source.rawContent) };
          })
        );
        extractions.push(...results);
      }

      return NextResponse.json({ extractions });
    }

    return NextResponse.json({ error: "Provide either 'url' or 'sources' in request body" }, { status: 400 });
  } catch (e: any) {
    console.error("Notepad extract error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
