import { v4 as uuidv4 } from "uuid";

export const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
export const RUNWARE_API_URL = "https://api.runware.ai/v1";

export function generateTaskUUID(): string {
  return uuidv4();
}

/**
 * Helper to make a Runware API request.
 * Accepts an array of task objects, returns the parsed JSON response.
 */
export async function runwareRequest(tasks: any[]) {
  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNWARE_API_KEY}`,
    },
    body: JSON.stringify(tasks),
  });
  return response.json();
}

/**
 * Text Inference via Runware LLMs (Llama 3.1, MiniMax, etc.)
 */
export async function generateRunwareText(prompt: string, model: string = "minimax:m2.5") {
  const data = await runwareRequest([
    {
      taskType: "textInference",
      taskUUID: generateTaskUUID(),
      positivePrompt: prompt,
      model: model,
      maxNewTokens: 2048,
      temperature: 0.7,
    },
  ]);
  
  if (data.errors) {
    throw new Error(data.errors[0]?.message || "Runware Text Generation failed");
  }
  
  return data.data?.[0]?.text || "";
}
