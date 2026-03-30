import { v4 as uuidv4 } from "uuid";

export const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY || "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
export const RUNWARE_API_URL = "https://api.runware.ai/v1";

export function generateTaskUUID(): string {
  return uuidv4();
}

/**
 * Helper to make a Runware API request.
 * Accepts an array of task objects, returns the parsed JSON response.
 */
export async function runwareRequest(tasks: any[]) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("runwareRequest requires a non-empty array of tasks");
  }

  console.log("Runware API Request:", {
    url: RUNWARE_API_URL,
    taskTypes: tasks.map(t => t.taskType),
    apiKeyPresent: !!RUNWARE_API_KEY,
    apiKeyLength: RUNWARE_API_KEY?.length || 0
  });

  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNWARE_API_KEY}`,
    },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    let data: any = {};
    try {
      data = await response.json();
    } catch {
      // response body may not be valid JSON
    }
    console.error("Runware API HTTP Error:", {
      status: response.status,
      statusText: response.statusText,
      errors: data.errors || data
    });
    return data;
  }

  const data = await response.json();
  return data;
}

/**
 * Text Inference via Runware LLMs (Llama 3.1, MiniMax, etc.)
 */
export async function generateRunwareText(prompt: string, model: string = "minimax:m2.5@0") {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("generateRunwareText requires a non-empty prompt");
  }
  console.log("generateRunwareText called with model:", model);

  const data = await runwareRequest([
    {
      taskType: "textInference",
      taskUUID: generateTaskUUID(),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
    },
  ]);

  if (data.errors) {
    console.error("Runware Text Generation errors:", JSON.stringify(data.errors, null, 2));

    // Check for credit exhaustion
    const isCreditError = data.errors.some((e: any) =>
      e.code === 'insufficientCredits' ||
      e.message?.toLowerCase().includes('credit') ||
      e.message?.toLowerCase().includes('invoice')
    );

    if (isCreditError) {
      throw new Error('INSUFFICIENT_CREDITS: Your Runware account has run out of credits. Please add credits at https://runware.ai or contact support.');
    }

    const errorDetails = data.errors.map((e: any) =>
      `${e.code || 'ERROR'}: ${e.message || 'Unknown error'} (param: ${e.parameter || 'N/A'})`
    ).join('; ');
    throw new Error(`Runware Text Generation failed: ${errorDetails}`);
  }

  if (!data.data || !data.data[0] || !data.data[0].text) {
    console.error("Invalid response from Runware:", data);
    throw new Error("Runware returned no text data");
  }

  console.log("Generated text length:", data.data[0].text.length);

  return data.data[0].text;
}
