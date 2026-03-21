const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/**
 * Text generation via Groq (if key available) or Pollinations.ai (free, no key needed).
 * Groq: 30 req/min, 14,400 req/day on free tier — llama-3.3-70b-versatile
 * Pollinations: completely free, no key required — retries on 5xx errors
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  if (GROQ_API_KEY) {
    return generateViaGroq(prompt);
  }
  return generateViaPollinationsWithRetry(prompt);
}

async function generateViaGroq(prompt: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.warn(`Groq API error ${response.status}, falling back to Pollinations`);
    return generateViaPollinationsWithRetry(prompt);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

const POLLINATIONS_MODELS = ["openai", "openai-large", "mistral"];

async function generateViaPollinationsWithRetry(prompt: string, maxRetries = 4): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const model = POLLINATIONS_MODELS[attempt % POLLINATIONS_MODELS.length];
    console.log(`Pollinations attempt ${attempt + 1}/${maxRetries} with model: ${model}`);

    try {
      const text = await generateViaPollinationsText(prompt, model);
      return text;
    } catch (err: any) {
      lastError = err;
      const isRetryable = err.message?.includes("502") || err.message?.includes("503") || err.message?.includes("504") || err.message?.includes("429");
      if (!isRetryable) throw err;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(`Pollinations ${err.message} — retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

async function generateViaPollinationsText(prompt: string, model = "openai"): Promise<string> {
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      model,
      seed: Math.floor(Math.random() * 100000),
      jsonMode: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pollinations text API error ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  if (!text?.trim()) throw new Error("Pollinations returned empty response");
  return text;
}
