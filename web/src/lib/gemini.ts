const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/**
 * Text generation via Groq (if key available) or Pollinations.ai (free, no key needed).
 * Groq: 30 req/min, 14,400 req/day on free tier — llama-3.3-70b-versatile
 * Pollinations: completely free, no key required — openai model
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  if (GROQ_API_KEY) {
    return generateViaGroq(prompt);
  }
  return generateViaPollinationsText(prompt);
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
    return generateViaPollinationsText(prompt);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

async function generateViaPollinationsText(prompt: string): Promise<string> {
  console.log("Using Pollinations.ai text generation (no API key required)");
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      model: "openai",
      seed: Math.floor(Math.random() * 10000),
      jsonMode: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pollinations text API error ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  if (!text) throw new Error("Pollinations returned empty response");
  return text;
}
