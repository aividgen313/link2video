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
    // Strip metadata labels that shouldn't appear in images
    .replace(/\b(Name|Height|Weight|Age|Role|Gender|Race|Build|Frame|Occupation|Character|Profile|Description):\s*/gi, "")
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
 * Image generation via Pollinations only
 * Models: nanobanana-pro, seedream-pro, seedream5
 */
export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      width = 1280,
      height = 768,
      model,
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Quality boosters for photorealism + full body accuracy
    const suffix = ", ultra-realistic, photorealistic, 8k UHD, hyperdetailed, accurate facial likeness, exact face resemblance, recognizable identity, correct anatomy, correct proportions, professional DSLR photography, cinematic lighting, sharp focus, detailed face, in English";
    const maxPromptLen = 900;
    const negativeEncoded = encodeURIComponent(NEGATIVE_PROMPT);

    // Pollinations.ai — nanobanana-pro + seedream-pro for best photorealistic results (NO flux)
    const MODELS_TO_TRY = model ? [model] : ["nanobanana-pro", "seedream-pro"];

    // Build retry attempts: each model with progressively simpler prompts
    type Attempt = { prompt: string; model: string };
    const attempts: Attempt[] = [];
    // Full prompt with each model
    for (const m of MODELS_TO_TRY) {
      attempts.push({ prompt: sanitizePrompt(prompt, maxPromptLen) + suffix, model: m });
    }
    // Shorter prompt (first 6 comma segments) with nanobanana-pro
    attempts.push({
      prompt: sanitizePrompt(prompt.split(",").slice(0, 6).join(","), 600) + ", cinematic, photorealistic, 8k",
      model: "nanobanana-pro",
    });
    // Ultra-simple prompt (first 3 comma segments) with seedream5 — last resort
    attempts.push({
      prompt: sanitizePrompt(prompt.split(",").slice(0, 3).join(","), 300) + ", photorealistic",
      model: "seedream5",
    });

    for (let i = 0; i < attempts.length; i++) {
      const { prompt: currentPrompt, model: currentModel } = attempts[i];
      console.log(`Pollinations Image (attempt ${i + 1}/${attempts.length}, model=${currentModel}):`, currentPrompt.substring(0, 100) + "...");

      const encodedPrompt = encodeURIComponent(currentPrompt);
      const seed = Math.floor(Math.random() * 1000000);

      let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${currentModel}&width=${width}&height=${height}&seed=${seed}&nologo=true&quality=high&enhance=true&negative=${negativeEncoded}`;
      if (POLLINATIONS_API_KEY) {
        imageURL += `&key=${POLLINATIONS_API_KEY}`;
      }

      try {
        const response = await fetch(imageURL, {
          signal: AbortSignal.timeout(90000),
        });

        if (!response.ok) {
          console.warn(`Pollinations ${currentModel} failed: ${response.status}`);
          if (response.status === 402) {
            return NextResponse.json({
              error: "Insufficient Pollinations credits.",
              isCreditsError: true,
            }, { status: 402 });
          }
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("image")) {
          console.warn(`Pollinations ${currentModel} returned non-image: ${contentType}`);
          continue;
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        if (imageBuffer.length < 1000) {
          console.warn(`Pollinations ${currentModel} returned empty image`);
          continue;
        }

        const mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

        console.log(`Pollinations ${currentModel} success (${imageBuffer.length} bytes)`);
        return NextResponse.json({
          success: true,
          images: [{ imageURL: dataUrl, imageUUID: `pollinations-${Date.now()}` }],
        });
      } catch (err: any) {
        if (err.name === "AbortError" || err.message?.includes("timeout")) {
          console.warn(`Pollinations ${currentModel} timed out`);
        } else {
          console.warn(`Pollinations ${currentModel} error:`, err.message);
        }
        continue;
      }
    }

    return NextResponse.json(
      { error: "All Pollinations image models failed. Try again.", retryable: true },
      { status: 500 }
    );
  } catch (error) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
