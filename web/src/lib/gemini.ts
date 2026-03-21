/**
 * Text generation via Pollinations.ai with Claude Sonnet 4.6 (primary)
 * Fallback chain: claude → openai → deepseek → mistral
 * Groq used as secondary fallback if GROQ_API_KEY is set
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  // Primary: Pollinations with Claude Sonnet
  try {
    return await generateViaPollinationsWithRetry(prompt);
  } catch (err: any) {
    console.warn("Pollinations failed, trying Groq fallback:", err.message);
  }

  // Fallback: Groq if key is available
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    try {
      return await generateViaGroq(prompt, groqKey);
    } catch (err: any) {
      console.warn("Groq fallback also failed:", err.message);
    }
  }

  throw new Error("All text generation providers failed");
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
  });

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

// Claude Sonnet first, then fallback models
const POLLINATIONS_MODELS = ["claude", "openai", "deepseek", "mistral", "openai-large"];

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
      const isRetryable = err.message?.includes("502") || err.message?.includes("503") || err.message?.includes("504") || err.message?.includes("429") || err.message?.includes("timeout");
      if (!isRetryable && attempt === 0) {
        // If Claude fails with non-retryable error, try next model
        console.warn(`Model ${model} failed: ${err.message}, trying next model...`);
        continue;
      }
      if (!isRetryable) throw err;

      // Exponential backoff: 2s, 4s, 8s, 16s
      const delay = Math.min(2000 * Math.pow(2, attempt), 16000);
      console.warn(`Pollinations ${err.message} — retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

async function generateViaPollinationsText(prompt: string, model = "claude"): Promise<string> {
  const pollinationsKey = process.env.POLLINATIONS_API_KEY || "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

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
    // Some Pollinations models return a message object instead of plain text
    try {
      const parsed = JSON.parse(text);
      if (parsed.content) text = parsed.content;
      else if (parsed.choices?.[0]?.message?.content) text = parsed.choices[0].message.content;
    } catch { /* not JSON, use as-is */ }
    return text;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Pollinations request timeout after 90s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
