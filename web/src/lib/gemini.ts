/**
 * Text generation — tries xAI Grok first, then Pollinations, Groq, OpenRouter
 */

const POLLINATIONS_API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const POLLINATIONS_MODELS = ["openai", "claude", "mistral", "deepseek", "gemini"];

export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  const errors: string[] = [];

  // Primary: xAI Grok (best quality, paid)
  const xaiKey = process.env.XAI_API_KEY || "";
  if (xaiKey) {
    try {
      return await generateViaGrok(prompt, xaiKey);
    } catch (err: any) {
      errors.push(`Grok: ${err.message}`);
      console.warn("xAI Grok text failed, trying Pollinations:", err.message);
    }
  }

  // Fallback 1: Pollinations unified API
  try {
    return await generateViaPollinationsWithRetry(prompt);
  } catch (err: any) {
    errors.push(`Pollinations: ${err.message}`);
    console.warn("Pollinations failed, trying fallbacks:", err.message);
  }

  // Fallback 2: Groq
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    try {
      return await generateViaGroq(prompt, groqKey);
    } catch (err: any) {
      errors.push(`Groq: ${err.message}`);
      console.warn("Groq fallback failed:", err.message);
    }
  }

  // Fallback 3: OpenRouter free models
  try {
    return await generateViaOpenRouter(prompt);
  } catch (err: any) {
    errors.push(`OpenRouter: ${err.message}`);
    console.warn("OpenRouter fallback failed:", err.message);
  }

  throw new Error(`All text generation providers failed: ${errors.join(" | ")}`);
}

async function generateViaGrok(prompt: string, apiKey: string): Promise<string> {
  console.log("Generating text via xAI Grok...");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-non-reasoning",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`xAI API error ${response.status}: ${response.statusText} ${errBody.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("xAI Grok returned empty response");
  console.log(`xAI Grok text success (${text.length} chars)`);
  return text;
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

async function generateViaOpenRouter(prompt: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
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

async function generateViaPollinationsWithRetry(prompt: string): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let i = 0; i < POLLINATIONS_MODELS.length; i++) {
    const model = POLLINATIONS_MODELS[i];
    console.log(`Pollinations attempt ${i + 1}/${POLLINATIONS_MODELS.length} with model: ${model}`);

    try {
      return await callPollinationsChat(prompt, model);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";
      console.warn(`Model ${model} failed: ${msg}`);

      if (msg.includes("404")) continue;
      if (msg.includes("429")) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      continue;
    }
  }

  throw lastError;
}

async function callPollinationsChat(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(POLLINATIONS_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
      seed: Math.floor(Math.random() * 100000),
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Pollinations API error ${response.status}: ${response.statusText} ${errBody.substring(0, 200)}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("Pollinations returned empty content");
  }

  console.log(`Pollinations ${model} success (${content.length} chars)`);
  return content;
}
