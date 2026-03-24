import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText } from "@/lib/gemini";

export const maxDuration = 120;

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
        const content = mainContent.slice(0, 12000);
        const title = $("title").text().trim() || $("h1").first().text().trim() || new URL(url).hostname;

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
            const prompt = `You are a knowledge extraction engine. Extract the key facts, claims, data points, statistics, insights, and important details from this text.

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
- Be concise but include enough detail to be useful`;

            try {
              const responseText = await generateGeminiText(prompt);
              let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, "").trim();
              const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return { sourceId: source.id, facts: parsed.facts || [] };
              }
            } catch (err) {
              console.warn(`Extraction failed for source ${source.id}:`, err);
            }
            return { sourceId: source.id, facts: [] };
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
