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
    // Strip metadata labels that shouldn't appear in images (EXCEPT "Character Reference")
    .replace(/\b(Height|Weight|Age|Role|Gender|Race|Build|Frame|Occupation|Character|Profile|Description):\s*/gi, "")
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
    const body = await req.json();
    const { prompt, model } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt must be a non-empty string" }, { status: 400 });
    }

    const width = typeof body.width === "number" ? body.width : 1280;
    const height = typeof body.height === "number" ? body.height : 768;

    if (typeof width !== "number" || !Number.isFinite(width) || width < 64 || width > 4096) {
      return NextResponse.json({ error: "width must be a number between 64 and 4096" }, { status: 400 });
    }
    if (typeof height !== "number" || !Number.isFinite(height) || height < 64 || height > 4096) {
      return NextResponse.json({ error: "height must be a number between 64 and 4096" }, { status: 400 });
    }

    // Quality boosters for photorealism + full body accuracy
    const hasAction = /\b(walking|running|jumping|action|moving|reaching|turning|gesture|kneeling|climbing|shouting|throwing|holding)\b/i.test(prompt);
    // If prompt has action, remove "accurate facial likeness" to prevent forcing a static portrait
    const suffix = hasAction 
      ? ", ultra-realistic, photorealistic, 8k UHD, hyperdetailed, professional DSLR photography, cinematic lighting, sharp focus, in English"
      : ", ultra-realistic, photorealistic, 8k UHD, hyperdetailed, accurate facial likeness, exact face resemblance, recognizable identity, correct anatomy, correct proportions, professional DSLR photography, cinematic lighting, sharp focus, detailed face, in English";
    
    const maxPromptLen = 900;
    const negativeEncoded = encodeURIComponent(NEGATIVE_PROMPT);

    // Pollinations.ai — nanobanana-pro + seedream-pro for best photorealistic results (NO flux)
    const MODELS_TO_TRY = model ? [model] : ["nanobanana-pro", "seedream-pro"];

    // Build retry attempts: each model with progressively simpler prompts
    type Attempt = { prompt: string; model: string; isFreeFallback?: boolean };
    const attempts: Attempt[] = [];
    
    const sanitizedBase = sanitizePrompt(prompt, maxPromptLen);

    // Full prompt with each model
    for (const m of MODELS_TO_TRY) {
      attempts.push({ prompt: sanitizedBase + suffix, model: m });
    }
    
    // Shorter prompt: take first 100 words or 600 chars, but try to keep it meaningful
    attempts.push({
      prompt: sanitizedBase.substring(0, 600) + ", cinematic, photorealistic, 8k",
      model: "nanobanana-pro",
    });
    
    // Ultra-simple prompt: last resort (first 300 chars)
    attempts.push({
      prompt: sanitizedBase.substring(0, 300) + ", photorealistic",
      model: "seedream5",
    });
    
    // Free standalone fallback — ignores API key to ensure it runs without billing
    attempts.push({
      prompt: sanitizePrompt(prompt.split(",").slice(0, 3).join(","), 300) + ", photorealistic",
      model: "flux",
      isFreeFallback: true
    });

    /**
     * Fallback System: If all models fail (402/500), return a beautiful
     * curated stock image based on the prompt keywords.
     */
    const getFallbackImage = (prompt: string): string => {
      const p = prompt.toLowerCase();
      // Curated high-end Unsplash images for common demo topics
      const FALLBACKS: Record<string, string[]> = {
        space: [
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        cyberpunk: [
          "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        tech: [
          "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        nature: [
          "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        business: [
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        people: [
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        sports: [
          "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1541252260730-0412e8e2108e?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        history: [
          "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1508919892451-40314902493c?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1461360228754-6e81c478c882?auto=format&fit=crop&w=1280&h=768&q=80"
        ],
        abstract: [
          "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1280&h=768&q=80",
          "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1280&h=768&q=80"
        ]
      };

      const pick = (cat: string) => {
        const list = FALLBACKS[cat] || FALLBACKS.abstract;
        return list[Math.floor(Math.random() * list.length)];
      };

      if (p.includes("space") || p.includes("galaxy") || p.includes("star") || p.includes("astronaut")) return pick("space");
      if (p.includes("cyber") || p.includes("neon") || p.includes("future") || p.includes("matrix")) return pick("cyberpunk");
      if (p.includes("tech") || p.includes("code") || p.includes("digital") || p.includes("robot") || p.includes("data")) return pick("tech");
      if (p.includes("sports") || p.includes("basketball") || p.includes("football") || p.includes("soccer") || p.includes("stadium")) return pick("sports");
      if (p.includes("history") || p.includes("war") || p.includes("ancient") || p.includes("statue") || p.includes("ruins")) return pick("history");
      if (p.includes("nature") || p.includes("forest") || p.includes("mountain") || p.includes("tree") || p.includes("beach")) return pick("nature");
      if (p.includes("business") || p.includes("office") || p.includes("city") || p.includes("money") || p.includes("corporate")) return pick("business");
      if (p.includes("man") || p.includes("woman") || p.includes("person") || p.includes("people") || p.includes("crowd") || p.includes("portrait") || p.includes("face")) return pick("people");
      
      return pick("abstract");
    };

    let got402 = false;

    for (let i = 0; i < attempts.length; i++) {
      const { prompt: currentPrompt, model: currentModel } = attempts[i];
      console.log(`Pollinations Image (attempt ${i + 1}/${attempts.length}, model=${currentModel}):`, currentPrompt.substring(0, 100) + "...");

      const encodedPrompt = encodeURIComponent(currentPrompt);
      const seed = Math.floor(Math.random() * 1000000);

      let imageURL = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${currentModel}&width=${width}&height=${height}&seed=${seed}&nologo=true&quality=high&enhance=true&negative=${negativeEncoded}`;
      if (POLLINATIONS_API_KEY && !attempts[i].isFreeFallback) {
        imageURL += `&key=${POLLINATIONS_API_KEY}`;
      }

      try {
        const response = await fetch(imageURL, {
          signal: AbortSignal.timeout(90000),
        });

        if (!response.ok) {
          console.warn(`Pollinations ${currentModel} failed: ${response.status}`);
          if (response.status === 402) {
            got402 = true;
          }
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("image")) {
          console.warn(`Pollinations ${currentModel} returned non-image: ${contentType}`);
          continue;
        }

        // Validate response has real content
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        if (imageBuffer.length < 1000) {
          console.warn(`Pollinations ${currentModel} returned empty image`);
          continue;
        }

        // Return as base64 data URL
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

    // ABSOLUTE LAST RESORT: Return a beautiful fallback instead of an error
    console.warn("All generation attempts failed or 402 encountered. Returning high-quality fallback image.");
    const fallbackUrl = getFallbackImage(prompt);
    
    return NextResponse.json({
      success: true,
      isFallback: true,
      images: [{ 
        imageURL: fallbackUrl, 
        imageUUID: `fallback-${Date.now()}` 
      }],
      message: got402 ? "API credits exhausted. Using high-quality placeholder for demo." : "Generation failed. Using high-quality placeholder."
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
