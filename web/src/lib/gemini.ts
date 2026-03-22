/**
 * Text generation — Google Gemini API (primary) with Pollinations fallback
 * Set GEMINI_API_KEY in Render env vars (free from https://aistudio.google.com/apikey)
 * Set POLLINATIONS_API_KEY as fallback (from https://auth.pollinations.ai)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const POLLINATIONS_API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const POLLINATIONS_FREE_MODELS = ["openai", "deepseek", "mistral", "openai-fast", "claude-fast"];

export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;

  // Primary: Gemini API
  if (geminiKey) {
    try {
      return await generateViaGemini(prompt, geminiKey);
    } catch (err: any) {
      console.warn("Gemini failed, trying Pollinations fallback:", err.message);
    }
  }

  // Fallback: Pollinations (requires API key since March 2026)
  if (pollinationsKey) {
    return await generateViaPollinationsWithRetry(prompt, pollinationsKey);
  }

  throw new Error(
    "No AI API key configured. Please set GEMINI_API_KEY in your Render environment variables. " +
    "Get a free key at https://aistudio.google.com/apikey"
  );
}

async function generateViaGemini(prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Try flash first (faster/cheaper), fall back to pro
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  let lastError: Error = new Error("Unknown error");
  for (const modelName of models) {
    try {
      console.log(`Gemini attempt with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text || text.trim().length === 0) throw new Error("Empty response");
      console.log(`Gemini ${modelName} success (${text.length} chars)`);
      return text;
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${modelName} failed: ${err.message}`);
      // Don't retry on auth errors
      if (err.message?.includes("API_KEY_INVALID") || err.message?.includes("403")) break;
    }
  }
  throw lastError;
}

async function generateViaPollinationsWithRetry(prompt: string, apiKey: string): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let i = 0; i < POLLINATIONS_FREE_MODELS.length; i++) {
    const model = POLLINATIONS_FREE_MODELS[i];
    console.log(`Pollinations text attempt ${i + 1}/${POLLINATIONS_FREE_MODELS.length} with model: ${model}`);

    try {
      return await callPollinationsChat(prompt, model, apiKey);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";
      console.warn(`Model ${model} failed: ${msg}`);

      if (msg.includes("429")) {
        await new Promise(r => setTimeout(r, 3000));
      } else if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        await new Promise(r => setTimeout(r, 5000));
      }
      continue;
    }
  }

  throw new Error(`All Pollinations text models failed: ${lastError.message}`);
}

async function callPollinationsChat(prompt: string, model: string, apiKey: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  const maxTokens = ["deepseek"].includes(model) ? 4096 : 8192;

  const response = await fetch(POLLINATIONS_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
      seed: Math.floor(Math.random() * 100000),
    }),
    signal: AbortSignal.timeout(120000),
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
