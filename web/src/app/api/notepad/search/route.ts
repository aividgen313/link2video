import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const maxDuration = 30;

function detectType(url: string): "youtube" | "pdf" | "image" | "page" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/\.pdf(\?|$)/i.test(url)) return "pdf";
  if (/\.(jpe?g|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) return "image";
  return "page";
}

export async function POST(req: NextRequest) {
  try {
    const { query, page = 1 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ error: "Query is required (min 2 characters)" }, { status: 400 });
    }

    const q = query.trim();
    const encoded = encodeURIComponent(q);

    // DuckDuckGo pagination uses 's' offset param (results per page ≈ 30)
    const offset = (page - 1) * 30;
    const pageParam = offset > 0 ? `&s=${offset}&dc=${offset + 1}` : "";

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}${pageParam}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Search request failed" }, { status: 502 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const results: { title: string; url: string; snippet: string; type: string }[] = [];

    $(".result").each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find(".result__a");
      const snippetEl = $el.find(".result__snippet");
      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || "";
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        href = decodeURIComponent(uddgMatch[1]);
      }
      const snippet = snippetEl.text().trim();

      if (title && href && href.startsWith("http")) {
        results.push({ title, url: href, snippet, type: detectType(href) });
      }
    });

    // Check if there's a "next" button for pagination
    const hasMore = $('input[value="Next"]').length > 0 || results.length >= 10;

    return NextResponse.json({ results: results.slice(0, 15), query: q, page, hasMore });
  } catch (e: any) {
    console.error("Search error:", e);
    return NextResponse.json({ error: e.message || "Search failed" }, { status: 500 });
  }
}
