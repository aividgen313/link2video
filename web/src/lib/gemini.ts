/**
 * Text generation — Pollinations text models
 * Primary: gen.pollinations.ai/v1/chat/completions (OpenAI-compatible)
 * Strategy 1: With API key (paid, higher limits)
 * Strategy 2: Without API key (anonymous, rate-limited but free)
 */

const POLLINATIONS_CHAT_URL = "https://gen.pollinations.ai/v1/chat/completions";
// Models ordered by quality for script writing
const POLLINATIONS_MODELS = ["openai", "mistral", "deepseek", "openai-fast", "claude-fast"];

/**
 * Sanitizes a prompt to reduce content filter triggers.
 * Used on retry when the original prompt was blocked by Azure OpenAI.
 * Strips graphic/violent/sexual language while preserving narrative intent.
 */
export function sanitizeForContentFilter(prompt: string): string {
  // Words/phrases that commonly trigger Azure OpenAI content filters
  const FILTER_TRIGGERS: [RegExp, string][] = [
    // Violence
    [/\b(kill(?:ed|ing|s)?|murder(?:ed|ing|s)?|slaughter(?:ed|ing)?|massacre)\b/gi, "confrontation"],
    [/\b(blood(?:y|ied|bath)?|gore|gory|gruesome|grisly)\b/gi, "intense"],
    [/\b(stab(?:bed|bing)?|shoot(?:ing|s)?|shot|gunshot)\b/gi, "conflict"],
    [/\b(death|dead|die(?:d|s)?|dying|corpse|body bag)\b/gi, "loss"],
    [/\b(attack(?:ed|ing)?|assault(?:ed|ing)?|beat(?:en|ing)?)\b/gi, "encounter"],
    [/\b(wound(?:ed|s)?|injur(?:ed|y|ies)|bleed(?:ing)?)\b/gi, "aftermath"],
    [/\b(maul(?:ed|ing)?|devour(?:ed|ing)?|torn apart|ripped)\b/gi, "overwhelmed"],
    [/\b(weapon(?:s)?|gun(?:s)?|knife|blade|sword)\b/gi, "tool"],
    [/\b(explod(?:e|ed|ing|sion)|bomb(?:ed|ing)?|detonate)\b/gi, "impact"],
    [/\b(torture(?:d)?|torment(?:ed)?|agony|suffering)\b/gi, "hardship"],
    // Self-harm
    [/\b(suicid(?:e|al)|self[- ]harm|overdose)\b/gi, "crisis"],
    // Sexual
    [/\b(naked|nude|nudity|exposed|undress(?:ed)?)\b/gi, "vulnerable"],
    [/\b(sexual(?:ly)?|erotic|sensual|seduct(?:ive|ion))\b/gi, "intimate"],
    // Drugs
    [/\b(drug(?:s)?|cocaine|heroin|meth|opioid|narcotic)\b/gi, "substance"],
    [/\b(overdos(?:e|ed|ing)|inject(?:ed|ing)?)\b/gi, "crisis point"],
  ];

  let sanitized = prompt;
  for (const [pattern, replacement] of FILTER_TRIGGERS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Add a meta-instruction to the AI to keep output clean
  if (sanitized !== prompt) {
    sanitized = sanitized + "\n\nIMPORTANT: Keep ALL visual_prompts and narration suitable for general audiences. Do not include graphic violence, gore, or explicit content in any descriptions.";
    console.log("[sanitize] Prompt was sanitized for content filter compliance");
  }

  return sanitized;
}

export async function generateGeminiText(prompt: string, jsonMode: boolean = false): Promise<string> {
  return await generateViaPollinationsWithRetry(prompt, jsonMode);
}

async function generateViaPollinationsWithRetry(prompt: string, jsonMode: boolean = false): Promise<string> {
  let lastError: Error = new Error("Unknown error");
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  // Strategy: try with API key first, then fall back to anonymous if auth fails
  const modelsToTry = POLLINATIONS_MODELS;

  // Phase 1: try with API key (if available)
  if (apiKey) {
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.log(`Pollinations chat attempt ${i + 1}/${modelsToTry.length} with model: ${model} (auth)`);
      try {
        return await callPollinationsChat(prompt, model, apiKey, jsonMode);
      } catch (err: any) {
        lastError = err;
        const msg = err.message || "";
        console.warn(`Model ${model} failed: ${msg}`);

        // Handle content filtering (Azure OpenAI policy) — try next model immediately
        if (msg.includes("filtered") && msg.includes("policy")) {
          console.warn(`Model ${model} triggered content filter. Attempting next available model...`);
          continue; // Move to next model in current phase
        }

        // 402 = out of credits — break current phase and fall back to anonymous
        if (msg.includes("402")) {
          console.warn("Pollinations balance empty, falling back to anonymous tier...");
          break; 
        }
        if (msg.includes("429")) {
          await new Promise(r => setTimeout(r, 2000));
        } else if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }

  // Phase 2: try without API key (anonymous/free tier) as fallback
  const anonModels = ["openai", "mistral", "openai-fast"];
  for (let i = 0; i < anonModels.length; i++) {
    const model = anonModels[i];
    console.log(`Pollinations chat anonymous fallback ${i + 1}/${anonModels.length} with model: ${model}`);
    try {
      return await callPollinationsChat(prompt, model, "", jsonMode);
    } catch (err: any) {
      console.warn(`Anonymous model ${model} failed: ${err.message || "Unknown error"}`);
    }
  }

  // Phase 3: Error handling
  if (lastError) {
    console.error("CRITICAL: All AI text models failed.", lastError);
    throw lastError;
  }

  throw new Error("All AI text models failed without a specific error.");
}

/** OpenAI-compatible chat endpoint — works with or without API key */
async function callPollinationsChat(prompt: string, model: string, apiKey: string, jsonMode: boolean = false): Promise<string> {
  // Use consistent token limit for all models
  const maxTokens = 8192;
  // Streaming prevents truncation and improves reliability for long JSON scripts
  const needsStream = (model === "deepseek" || model === "openai" || model === "mistral") && maxTokens > 4000;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(POLLINATIONS_CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
      seed: Math.floor(Math.random() * 100000),
      ...(needsStream ? { stream: true } : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    }),
    signal: AbortSignal.timeout(240000), // 4 min — script generation for 20+ scenes needs time
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Pollinations API error ${response.status}: ${response.statusText} ${errBody.substring(0, 200)}`);
  }

  let content: string;

  if (needsStream) {
    // Collect SSE streaming response into a single string
    const text = await response.text();
    const chunks: string[] = [];
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) chunks.push(delta);
      } catch { /* skip malformed chunks */ }
    }
    content = chunks.join("");
  } else {
    const data = await response.json();
    content = data.choices?.[0]?.message?.content || "";
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Pollinations returned empty content");
  }

  const authLabel = apiKey ? "auth" : "anon";
  console.log(`Pollinations chat ${model} (${authLabel}) success (${content.length} chars)`);
  return content;
}
