/**
 * Text generation — Pollinations text models
 * Primary: gen.pollinations.ai/v1/chat/completions (OpenAI-compatible)
 * Strategy 1: With API key (paid, higher limits)
 * Strategy 2: Without API key (anonymous, rate-limited but free)
 */

const POLLINATIONS_CHAT_URL = "https://gen.pollinations.ai/v1/chat/completions";
// Models ordered by quality for script writing
const POLLINATIONS_MODELS = ["openai", "deepseek", "mistral", "openai-fast", "claude-fast"];

export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  return await generateViaPollinationsWithRetry(prompt);
}

async function generateViaPollinationsWithRetry(prompt: string): Promise<string> {
  let lastError: Error = new Error("Unknown error");
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  // Strategy 1: Try chat endpoint with API key (if available)
  if (apiKey) {
    const modelsToTry = POLLINATIONS_MODELS.slice(0, 3);
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.log(`Pollinations chat (auth) attempt ${i + 1}/${modelsToTry.length} with model: ${model}`);
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
        // On 401/402, stop trying with key — fall through to anonymous
        if (msg.includes("401") || msg.includes("402")) break;
      }
    }
  }

  // Strategy 2: Try chat endpoint WITHOUT API key (anonymous, rate-limited but free)
  console.log("Falling back to anonymous chat endpoint (no API key)...");
  const anonModels = POLLINATIONS_MODELS.slice(0, 4); // try more models without key
  for (let i = 0; i < anonModels.length; i++) {
    const model = anonModels[i];
    console.log(`Pollinations chat (anon) attempt ${i + 1}/${anonModels.length} with model: ${model}`);
    try {
      return await callPollinationsChat(prompt, model, "");
    } catch (err: any) {
      lastError = err;
      const msg = err.message || "";
      console.warn(`Anon model ${model} failed: ${msg}`);
      if (msg.includes("429")) {
        await new Promise(r => setTimeout(r, 3000));
      } else if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  throw new Error(`All Pollinations text models failed: ${lastError.message}`);
}

/** OpenAI-compatible chat endpoint — works with or without API key */
async function callPollinationsChat(prompt: string, model: string, apiKey: string): Promise<string> {
  const maxTokens = ["deepseek"].includes(model) ? 4096 : 8192;

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
    }),
    signal: AbortSignal.timeout(120000), // 2 min — script generation for 20+ scenes needs time
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

  const authLabel = apiKey ? "auth" : "anon";
  console.log(`Pollinations chat ${model} (${authLabel}) success (${content.length} chars)`);
  return content;
}
