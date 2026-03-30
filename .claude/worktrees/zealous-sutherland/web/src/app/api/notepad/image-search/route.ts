import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { query, page = 1 } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ error: "Query is required (min 2 characters)" }, { status: 400 });
    }

    const q = query.trim();
    const encoded = encodeURIComponent(q);

    // Use DuckDuckGo image search via their vqd token flow
    // First get a vqd token
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=['"]([^'"]+)['"]/);
    const vqd = vqdMatch?.[1] || "";

    if (!vqd) {
      // Fallback: use Unsplash-like free image source via Pollinations or similar
      // Use a simple approach: scrape DuckDuckGo HTML image results
      const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}+images&ia=images`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      // If we can't get vqd, return empty with a message
      return NextResponse.json({ results: [], query: q, page, hasMore: false });
    }

    // Fetch image results from DuckDuckGo API
    const offset = (page - 1) * 20;
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encoded}&vqd=${vqd}&f=,,,,,&p=1&s=${offset}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://duckduckgo.com/",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!imgRes.ok) {
      return NextResponse.json({ results: [], query: q, page, hasMore: false });
    }

    const imgData = await imgRes.json();
    const results = (imgData.results || [])
      .slice(0, 20)
      .map((r: any) => ({
        title: r.title || "",
        url: r.image || "",
        thumbnail: r.thumbnail || r.image || "",
        source: r.source || "",
        width: r.width || 0,
        height: r.height || 0,
      }))
      .filter((r: any) => r.url && r.url.startsWith("http"));

    const hasMore = (imgData.results || []).length >= 20 || !!imgData.next;

    return NextResponse.json({ results, query: q, page, hasMore });
  } catch (e: any) {
    console.error("Image search error:", e);
    return NextResponse.json({ error: e.message || "Image search failed" }, { status: 500 });
  }
}
