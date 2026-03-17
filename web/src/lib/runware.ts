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
export async function runwareRequest(tasks: Record<string, unknown>[]) {
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
