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

  // Strategy: try with API key first, then fall back to anonymous if auth fails
  const modelsToTry = POLLINATIONS_MODELS;

  // Phase 1: try with API key (if available)
  if (apiKey) {
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.log(`Pollinations chat attempt ${i + 1}/${modelsToTry.length} with model: ${model} (auth)`);
      try {
        return await callPollinationsChat(prompt, model, apiKey);
      } catch (err: any) {
        lastError = err;
        const msg = err.message || "";
        console.warn(`Model ${model} failed: ${msg}`);

        // 402 = out of credits — no point trying more models with the same key
        if (msg.includes("402")) {
          throw new Error("Pollinations balance is empty. Please top up at enter.pollinations.ai and try again.");
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
      return await callPollinationsChat(prompt, model, "");
    } catch (err: any) {
      lastError = err;
      console.warn(`Anon model ${model} failed: ${err.message || ""}`);
      if ((err.message || "").includes("429")) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw new Error(`All Pollinations text models failed: ${lastError.message}`);
}

/** OpenAI-compatible chat endpoint — works with or without API key */
async function callPollinationsChat(prompt: string, model: string, apiKey: string): Promise<string> {
  // Deepseek requires stream=true for max_tokens > 4096, so cap it
  const maxTokens = model === "deepseek" ? 4096 : 8192;

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
    signal: AbortSignal.timeout(240000), // 4 min — script generation for 20+ scenes needs time
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
