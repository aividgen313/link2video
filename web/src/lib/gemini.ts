/**
 * Text generation — Pollinations free text models only
 * Endpoint: gen.pollinations.ai/v1/chat/completions (OpenAI-compatible)
 */

const POLLINATIONS_API_URL = "https://gen.pollinations.ai/v1/chat/completions";
// Free models (paid_only: false) — ordered by quality for script writing
const POLLINATIONS_FREE_MODELS = ["openai", "deepseek", "mistral", "openai-fast", "claude-fast"];

export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  return await generateViaPollinationsWithRetry(prompt);
}

async function generateViaPollinationsWithRetry(prompt: string): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  // Try max 3 models to avoid long waits (5 models × 60s = 5min is too long)
  const modelsToTry = POLLINATIONS_FREE_MODELS.slice(0, 3);

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    console.log(`Pollinations text attempt ${i + 1}/${modelsToTry.length} with model: ${model}`);

    try {
      return await callPollinationsChat(prompt, model);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";
      console.warn(`Model ${model} failed: ${msg}`);

      if (msg.includes("402")) {
        console.warn(`Insufficient balance detected (402). Retrying ${model} without API key...`);
        try {
          return await callPollinationsChat(prompt, model, true);
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
          console.warn(`Free fallback for ${model} failed: ${fallbackErr.message}`);
        }
      } else if (msg.includes("429")) {
        await new Promise(r => setTimeout(r, 2000));
      } else if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        await new Promise(r => setTimeout(r, 3000));
      }
      continue;
    }
  }

  throw new Error(`All Pollinations text models failed: ${lastError.message}`);
}

async function callPollinationsChat(prompt: string, model: string, omitApiKey: boolean = false): Promise<string> {
  const apiKey = omitApiKey ? "" : (process.env.POLLINATIONS_API_KEY || "");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Some models (deepseek) require max_tokens ≤ 4096 without streaming
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
    signal: AbortSignal.timeout(45000), // 45s per model — fail fast, try next
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
