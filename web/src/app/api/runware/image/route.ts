import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";

const NEGATIVE_PROMPT = [
  // Anatomy / Body
  "bad anatomy", "extra limbs", "missing limbs", "malformed hands", "malformed fingers", "extra fingers",
  "fused fingers", "wrong number of fingers", "mutated hands", "deformed body", "disproportionate body",
  "unrealistic muscles", "incorrect joints", "unnatural posture", "contorted body", "floating limbs",
  // Faces
  "ugly face", "distorted face", "mutated face", "asymmetrical face", "wrong facial features",
  "unrealistic eyes", "crossed eyes", "extra eyes", "blurry eyes", "deformed mouth", "crooked teeth",
  "unnatural smile", "fake smile", "missing facial features",
  // Hair
  "messy hair", "weird hair", "unnatural hair", "floating hair", "clumped hair",
  // Clothing
  "ripped clothing", "messy clothing", "unrealistic clothing", "floating clothing", "clashing colors",
  // Lighting / Colors
  "overexposed", "underexposed", "poor lighting", "harsh shadows", "unnatural lighting",
  "color banding", "bad contrast", "color bleeding", "washed out", "oversaturated", "unnatural colors",
  // Environment
  "blurry background", "inconsistent perspective", "floating objects", "unnatural shadows",
  "cluttered background", "unfinished background", "warped environment", "wrong scale",
  // Image Quality
  "low quality", "pixelated", "blurry", "grainy", "noisy image", "compression artifacts",
  "JPEG artifacts", "over-sharpened", "distorted image", "corrupted image", "glitchy image",
  // Style
  "cartoonish", "unrealistic proportions", "low-poly", "abstract", "surreal", "glitch art",
  "distorted perspective", "uncanny valley", "floating text", "bad typography",
  // Video-Specific
  "frame skipping", "motion blur", "jittery movement", "unnatural animation",
  "ghosting frames", "stuttering motion", "jittery camera", "unstable camera movement",
  // Misc
  "watermark", "signature", "text overlay", "logo", "timestamp", "NSFW", "gore", "blood",
  "violence", "explicit content", "offensive imagery", "broken props", "unrealistic physics",
  "floating particles",
].join(", ");

/**
 * Sanitize prompt for URL-based image API:
 * - Remove special chars that trigger Cloudflare WAF
 * - Strip hex color codes, URLs, and problematic symbols
 * - Limit length for URL path safety
 */
function sanitizePrompt(prompt: string, maxLen: number): string {
  let clean = prompt
    .replace(/#[0-9A-Fa-f]{3,8}/g, "") // hex color codes
    .replace(/https?:\/\/\S+/g, "") // URLs
    .replace(/[<>{}|\\^`[\]]/g, "") // special chars
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
  if (clean.length > maxLen) clean = clean.substring(0, maxLen);
  return clean;
}

/**
 * Image generation via Pollinations.ai — FREE with API key
 * Retries with simplified prompt on failure
 */
export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      width = 1280,
      height = 768,
      model = "flux",
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const suffix = ", ultra-realistic, photorealistic, 8k UHD, hyperdetailed, accurate likeness, professional photography, cinematic lighting, in English";
    const maxPromptLen = 900; // conservative limit to avoid Cloudflare issues
    const negativeEncoded = encodeURIComponent(NEGATIVE_PROMPT);

    // Try up to 3 times: full prompt → shortened → simplified
    const attempts = [
      sanitizePrompt(prompt, maxPromptLen) + suffix,
      sanitizePrompt(prompt, 500) + suffix,
      sanitizePrompt(prompt.split(",").slice(0, 3).join(","), 300) + ", cinematic, photorealistic, 8k",
    ];

    for (let i = 0; i < attempts.length; i++) {
      const currentPrompt = attempts[i];
      console.log(`Pollinations Image (attempt ${i + 1}):`, currentPrompt.substring(0, 100) + "...");

      const encodedPrompt = encodeURIComponent(currentPrompt);
      const seed = Math.floor(Math.random() * 1000000);

      let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&width=${width}&height=${height}&seed=${seed}&nologo=true&negative=${negativeEncoded}`;
      if (POLLINATIONS_API_KEY) {
        imageURL += `&key=${POLLINATIONS_API_KEY}`;
      }

      try {
        const response = await fetch(imageURL, {
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.warn(`Pollinations attempt ${i + 1} failed: ${response.status}`, errorText.substring(0, 200));
          if (i < attempts.length - 1) continue; // retry with simpler prompt
          throw new Error(`Pollinations returned ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";
        console.log(`Image response: ${response.status}, type: ${contentType}`);

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const base64Image = imageBuffer.toString("base64");
        const mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        return NextResponse.json({
          success: true,
          images: [
            {
              imageURL: dataUrl,
              imageUUID: `poll-${seed}`,
              seed,
              cost: 0,
            },
          ],
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn(`Pollinations attempt ${i + 1} timed out`);
          if (i < attempts.length - 1) continue;
        }
        if (i === attempts.length - 1) throw err;
      }
    }

    throw new Error("All image generation attempts failed");
  } catch (error) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
