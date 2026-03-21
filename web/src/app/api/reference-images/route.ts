import { NextRequest, NextResponse } from "next/server";

/**
 * Search for reference images of subjects (people, locations, etc.)
 * Uses Bing Image Search scraping to find real photos
 * Returns { subjects: [{ name, images: [url, url, ...] }] }
 */
export async function POST(req: NextRequest) {
  try {
    const { subjects } = await req.json();

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json({ error: "subjects array required" }, { status: 400 });
    }

    console.log(`Searching reference images for ${subjects.length} subjects:`, subjects.map((s: any) => s.name).join(", "));

    const results = await Promise.all(
      subjects.slice(0, 8).map(async (subject: { name: string; type: string }) => {
        try {
          // Build search query based on type
          let query = subject.name;
          if (subject.type === "person") {
            query += " photo portrait face";
          } else if (subject.type === "location") {
            query += " photo";
          } else if (subject.type === "brand") {
            query += " logo";
          }

          const encodedQuery = encodeURIComponent(query);
          const response = await fetch(
            `https://www.bing.com/images/search?q=${encodedQuery}&form=HDRSC2&first=1`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
              signal: AbortSignal.timeout(10000),
            }
          );

          if (!response.ok) {
            console.warn(`Bing search failed for ${subject.name}: ${response.status}`);
            return { name: subject.name, type: subject.type, images: [] };
          }

          const html = await response.text();

          // Extract murl (media URLs) from Bing image results
          const murls: string[] = [];
          const murlRegex = /murl[&"]:\s*[&"]?(https?:\/\/[^"&]+\.(?:jpg|jpeg|png|webp))/gi;
          let match;
          while ((match = murlRegex.exec(html)) !== null && murls.length < 3) {
            const url = match[1]
              .replace(/&amp;/g, "&")
              .replace(/\\u002f/g, "/");
            // Skip tiny thumbnails
            if (!url.includes("th.bing.com") && !url.includes("tse") && !url.includes("favicon")) {
              murls.push(url);
            }
          }

          // Also try to extract from data attributes
          if (murls.length < 2) {
            const dataRegex = /mediaurl=([^&"]+)/gi;
            while ((match = dataRegex.exec(html)) !== null && murls.length < 3) {
              try {
                const url = decodeURIComponent(match[1]);
                if (url.match(/\.(jpg|jpeg|png|webp)/i) && !murls.includes(url)) {
                  murls.push(url);
                }
              } catch { /* skip bad urls */ }
            }
          }

          console.log(`Found ${murls.length} images for "${subject.name}"`);
          return { name: subject.name, type: subject.type, images: murls };
        } catch (err: any) {
          console.warn(`Image search failed for ${subject.name}:`, err.message);
          return { name: subject.name, type: subject.type, images: [] };
        }
      })
    );

    return NextResponse.json({ subjects: results });
  } catch (error) {
    console.error("Reference image search error:", error);
    return NextResponse.json({ error: "Failed to search for reference images" }, { status: 500 });
  }
}
