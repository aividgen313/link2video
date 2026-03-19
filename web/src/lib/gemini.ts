import { GoogleGenerativeAI } from "@google/generative-ai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

export async function generateGeminiText(prompt: string, model: string = "gemini-2.0-flash-exp") {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable is not set. Get a free API key at https://makersuite.google.com/app/apikey");
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
}
