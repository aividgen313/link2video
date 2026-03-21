/**
 * Text generation via Groq (if key available) or Pollinations.ai (free, no key needed).
 * Groq: 30 req/min, 14,400 req/day on free tier — llama-3.3-70b-versatile
 * Pollinations: completely free, no key required — retries on 5xx errors
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    return generateViaGroq(prompt, groqKey);
  }
  console.log("No GROQ_API_KEY found, using Pollinations free API");
  return generateViaPollinationsWithRetry(prompt);
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
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    console.warn(`Groq API error ${response.status}, falling back to Pollinations`);
    return generateViaPollinationsWithRetry(prompt);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

const POLLINATIONS_MODELS = ["openai", "mistral", "openai-large", "deepseek", "openai"];

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
      if (!isRetryable) throw err;

      // Exponential backoff: 2s, 4s, 8s, 16s
      const delay = Math.min(2000 * Math.pow(2, attempt), 16000);
      console.warn(`Pollinations ${err.message} — retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

async function generateViaPollinationsText(prompt: string, model = "openai"): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model,
        seed: Math.floor(Math.random() * 100000),
        jsonMode: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Pollinations text API error ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text?.trim()) throw new Error("Pollinations returned empty response");
    return text;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Pollinations request timeout after 30s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
