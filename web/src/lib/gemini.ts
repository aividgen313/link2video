/**
 * Text generation — Pollinations text models
 * Primary: gen.pollinations.ai/v1/chat/completions (OpenAI-compatible, requires API key)
 * Fallback: text.pollinations.ai (anonymous, no key required)
 */

const POLLINATIONS_CHAT_URL = "https://gen.pollinations.ai/v1/chat/completions";
const POLLINATIONS_TEXT_URL = "https://text.pollinations.ai";
// Models ordered by quality for script writing
const POLLINATIONS_MODELS = ["openai", "deepseek", "mistral", "openai-fast", "claude-fast"];

export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  return await generateViaPollinationsWithRetry(prompt);
}

async function generateViaPollinationsWithRetry(prompt: string): Promise<string> {
  let lastError: Error = new Error("Unknown error");
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  // Strategy 1: Try OpenAI-compatible endpoint with API key (if available)
  if (apiKey) {
    const modelsToTry = POLLINATIONS_MODELS.slice(0, 3);
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.log(`Pollinations chat attempt ${i + 1}/${modelsToTry.length} with model: ${model}`);
      try {
        return await callPollinationsChat(prompt, model, apiKey);
      } catch (err: any) {
        lastError = err;
        const msg = err.message || "";
        console.warn(`Model ${model} failed: ${msg}`);
        if (msg.includes("429")) {
          await new Promise(r => setTimeout(r, 2000));
        } else if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
          await new Promise(r => setTimeout(r, 3000));
        }
        // On 401/402, don't retry same endpoint without key — fall through to text endpoint
        if (msg.includes("401") || msg.includes("402")) break;
      }
    }
  }

  // Strategy 2: Try anonymous text.pollinations.ai endpoint (no key needed)
  console.log("Falling back to anonymous text.pollinations.ai endpoint...");
  const fallbackModels = POLLINATIONS_MODELS.slice(0, 3);
  for (let i = 0; i < fallbackModels.length; i++) {
    const model = fallbackModels[i];
    console.log(`Pollinations text fallback ${i + 1}/${fallbackModels.length} with model: ${model}`);
    try {
      return await callPollinationsText(prompt, model);
    } catch (err: any) {
      lastError = err;
      console.warn(`Text fallback ${model} failed: ${err.message}`);
      if (err.message?.includes("429")) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw new Error(`All Pollinations text models failed: ${lastError.message}`);
}

/** OpenAI-compatible chat endpoint (requires API key) */
async function callPollinationsChat(prompt: string, model: string, apiKey: string): Promise<string> {
  const maxTokens = ["deepseek"].includes(model) ? 4096 : 8192;

  const response = await fetch(POLLINATIONS_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
      seed: Math.floor(Math.random() * 100000),
    }),
    signal: AbortSignal.timeout(45000),
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

  console.log(`Pollinations chat ${model} success (${content.length} chars)`);
  return content;
}

/** Anonymous text endpoint (no API key required) */
async function callPollinationsText(prompt: string, model: string): Promise<string> {
  const url = `${POLLINATIONS_TEXT_URL}/${encodeURIComponent(prompt)}?model=${model}&seed=${Math.floor(Math.random() * 100000)}`;

  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(60000), // text endpoint can be slower
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Pollinations text error ${response.status}: ${response.statusText} ${errBody.substring(0, 200)}`);
  }

  const content = await response.text();
  if (!content || content.trim().length === 0) {
    throw new Error("Pollinations text returned empty content");
  }

  console.log(`Pollinations text ${model} success (${content.length} chars)`);
  return content;
}
