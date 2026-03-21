const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/**
 * Text generation via Groq API (free tier: 30 req/min, 14,400 req/day)
 * Uses llama-3.3-70b-versatile — fast and high quality
 */
export async function generateGeminiText(prompt: string, _model?: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in .env.local. Get a free key at https://console.groq.com");
  }

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
    throw new Error(`Groq API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned empty response");
  }

  return text;
}
