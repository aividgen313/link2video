/**
 * Text generation via Pollinations.ai with Claude Sonnet (primary)
 * Fallback chain: Pollinations models → Groq → OpenRouter (free)
 * Better retry logic with longer delays for 502/503 errors
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  const errors: string[] = [];

  // Primary: Pollinations with multiple models
  try {
    return await generateViaPollinationsWithRetry(prompt);
  } catch (err: any) {
    errors.push(`Pollinations: ${err.message}`);
    console.warn("Pollinations failed, trying fallbacks:", err.message);
  }

  // Fallback 1: Groq if key is available
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    try {
      return await generateViaGroq(prompt, groqKey);
    } catch (err: any) {
      errors.push(`Groq: ${err.message}`);
      console.warn("Groq fallback also failed:", err.message);
    }
  }

  // Fallback 2: OpenRouter free models
  try {
    return await generateViaOpenRouter(prompt);
  } catch (err: any) {
    errors.push(`OpenRouter: ${err.message}`);
    console.warn("OpenRouter fallback failed:", err.message);
  }

  // Fallback 3: One more Pollinations attempt with a longer timeout
  try {
    console.log("Final attempt: Pollinations with extended timeout...");
    return await generateViaPollinationsText(prompt, "openai", 120000);
  } catch (err: any) {
    errors.push(`Final Pollinations: ${err.message}`);
  }

  throw new Error(`All text generation providers failed: ${errors.join(" | ")}`);
}

async function generateViaGroq(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

// Free tier via OpenRouter (no key needed for some models)
async function generateViaOpenRouter(prompt: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  // Without a key, OpenRouter provides limited free access
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (openRouterKey) headers["Authorization"] = `Bearer ${openRouterKey}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned empty response");
  return text;
}

// Claude Sonnet first, then fallback models
// Model order: mistral is most reliable (plain text), then deepseek, openai, claude
// openai sometimes returns reasoning-only wrappers; claude sometimes 404s
const POLLINATIONS_MODELS = ["mistral", "deepseek", "openai", "openai-large", "claude"];

async function generateViaPollinationsWithRetry(prompt: string, maxRetries = 5): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const model = POLLINATIONS_MODELS[attempt % POLLINATIONS_MODELS.length];
    console.log(`Pollinations attempt ${attempt + 1}/${maxRetries} with model: ${model}`);

    try {
      const text = await generateViaPollinationsText(prompt, model);
      return text;
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";

      // These errors should skip to the next model immediately (no delay)
      const skipToNext = msg.includes("404") || msg.includes("reasoning only") || msg.includes("empty wrapper");
      if (skipToNext) {
        console.warn(`Model ${model} failed: ${msg}, trying next model...`);
        continue;
      }

      // These errors are retryable with a delay
      const isRetryable = msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("429") || msg.includes("timeout");
      if (!isRetryable) {
        // Non-retryable error — try next model without delay
        console.warn(`Model ${model} non-retryable error: ${msg}, trying next...`);
        continue;
      }

      // Longer delays for server errors: 3s, 6s, 12s, 20s, 30s
      const delay = Math.min(3000 * Math.pow(2, attempt), 30000);
      console.warn(`Pollinations ${msg} — retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

async function generateViaPollinationsText(prompt: string, model = "openai", timeoutMs = 90000): Promise<string> {
  const pollinationsKey = process.env.POLLINATIONS_API_KEY || "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      messages: [{ role: "user", content: prompt }],
      model,
      seed: Math.floor(Math.random() * 100000),
      jsonMode: false,
    };
    if (pollinationsKey) {
      body.key = pollinationsKey;
    }

    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Pollinations text API error ${response.status}: ${response.statusText}`);
    }

    let text = await response.text();
    if (!text?.trim()) throw new Error("Pollinations returned empty response");
    // Some Pollinations models return a message wrapper object instead of plain text
    // e.g. {"role":"assistant","content":"actual response"}
    // or {"role":"assistant","reasoning_content":"thinking..."} (reasoning-only, no real content)
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && parsed.role === "assistant") {
        // It's a message wrapper — extract actual content
        if (parsed.content && typeof parsed.content === "string" && parsed.content.trim().length > 0) {
          console.log(`Pollinations wrapper: extracted "content" field (${parsed.content.length} chars)`);
          text = parsed.content;
        } else if (parsed.choices?.[0]?.message?.content) {
          text = parsed.choices[0].message.content;
        } else if (parsed.reasoning_content && !parsed.content) {
          // Model only returned reasoning/thinking but no actual content
          // This means it failed to produce a response — throw to retry with another model
          console.warn(`Pollinations wrapper: model returned only reasoning_content (${parsed.reasoning_content.length} chars), no actual content`);
          throw new Error("Model returned reasoning only, no content — retrying");
        } else {
          // Unknown wrapper format — find the longest string field
          const stringFields = Object.entries(parsed)
            .filter(([k, v]) => typeof v === "string" && k !== "role" && (v as string).length > 20)
            .sort((a, b) => (b[1] as string).length - (a[1] as string).length);
          if (stringFields.length > 0) {
            console.warn(`Pollinations wrapper: using field "${stringFields[0][0]}" (${(stringFields[0][1] as string).length} chars)`);
            text = stringFields[0][1] as string;
          } else {
            throw new Error("Pollinations returned empty wrapper with no content");
          }
        }
      }
      // If it's a valid JSON object/array (scenes, angles, etc.) but NOT a wrapper, keep original text
    } catch (parseErr: any) {
      // If it's our own thrown error (not a JSON parse error), re-throw it
      if (parseErr.message && !parseErr.message.includes("JSON")) {
        throw parseErr;
      }
      // Not JSON at all — use text as-is (most common case for working models)
    }
    return text;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Pollinations request timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
