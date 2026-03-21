import { NextRequest, NextResponse } from "next/server";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";

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
    .replace(/(\d+)'(\d+)"/g, "$1 foot $2") // height measurements 5'9" → 5 foot 9
    .replace(/(\d+)'/g, "$1 foot") // 5' → 5 foot
    .replace(/[<>{}|\\^`[\]"']/g, "") // special chars + quotes
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
  if (clean.length > maxLen) clean = clean.substring(0, maxLen);
  return clean;
}

/**
 * Generate image via xAI Grok Imagine API
 */
async function generateViaGrok(prompt: string): Promise<{ dataUrl: string; id: string } | null> {
  if (!XAI_API_KEY) return null;

  try {
    console.log("Trying xAI Grok Imagine...");
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: prompt,
        n: 1,
        response_format: "url",
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`xAI Grok Imagine failed: ${response.status}`, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const imageUrl = data?.data?.[0]?.url;

    if (!imageUrl) {
      console.warn("xAI Grok returned no image URL");
      return null;
    }

    // Download the image and convert to base64
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!imgRes.ok) {
      console.warn(`Failed to download Grok image: ${imgRes.status}`);
      return null;
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const dataUrl = `data:${contentType};base64,${imgBuffer.toString("base64")}`;

    console.log("xAI Grok Imagine success");
    return { dataUrl, id: `grok-${Date.now()}` };
  } catch (err: any) {
    console.warn("xAI Grok Imagine error:", err.message);
    return null;
  }
}

/**
 * Image generation — tries xAI Grok first (if useGrok), then Pollinations fallback
 */
export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      width = 1280,
      height = 768,
      model,
      useGrok = false,
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Quality boosters for photorealism + full body accuracy
    const suffix = ", ultra-realistic, photorealistic, 8k UHD, hyperdetailed, accurate facial likeness, exact face resemblance, recognizable identity, correct anatomy, correct proportions, professional DSLR photography, cinematic lighting, sharp focus, detailed face, in English";
    const maxPromptLen = 900;
    const negativeEncoded = encodeURIComponent(NEGATIVE_PROMPT);

    // Try xAI Grok Imagine first for Medium/Pro/Story/Music tiers
    if (useGrok) {
      const grokPrompt = sanitizePrompt(prompt, maxPromptLen) + suffix;
      const result = await generateViaGrok(grokPrompt);
      if (result) {
        return NextResponse.json({
          success: true,
          images: [{
            imageURL: result.dataUrl,
            imageUUID: result.id,
            seed: 0,
            cost: 0,
          }],
        });
      }
      console.warn("Grok Imagine failed, falling back to Pollinations...");
    }

    // Fallback: Pollinations.ai
    // Models ranked by quality — grok-imagine first, then fallbacks
    const MODELS_TO_TRY = model ? [model] : ["grok-imagine", "flux", "nanobanana-pro"];

    // Build retry attempts: each model with progressively simpler prompts
    type Attempt = { prompt: string; model: string };
    const attempts: Attempt[] = [];
    // Full prompt with each model
    for (const m of MODELS_TO_TRY) {
      attempts.push({ prompt: sanitizePrompt(prompt, maxPromptLen) + suffix, model: m });
    }
    // Shorter prompt (first 6 comma segments) with flux
    attempts.push({
      prompt: sanitizePrompt(prompt.split(",").slice(0, 6).join(","), 600) + ", cinematic, photorealistic, 8k",
      model: "flux",
    });
    // Ultra-simple prompt (first 3 comma segments) with flux — last resort
    attempts.push({
      prompt: sanitizePrompt(prompt.split(",").slice(0, 3).join(","), 300) + ", photorealistic",
      model: "flux",
    });

    for (let i = 0; i < attempts.length; i++) {
      const { prompt: currentPrompt, model: currentModel } = attempts[i];
      console.log(`Pollinations Image (attempt ${i + 1}/${attempts.length}, model=${currentModel}):`, currentPrompt.substring(0, 100) + "...");

      const encodedPrompt = encodeURIComponent(currentPrompt);
      const seed = Math.floor(Math.random() * 1000000);

      let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${currentModel}&width=${width}&height=${height}&seed=${seed}&nologo=true&negative=${negativeEncoded}`;
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
