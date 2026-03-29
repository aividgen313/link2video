
const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
const RUNWARE_API_URL = "https://api.runware.ai/v1";
const crypto = require('crypto');

async function test() {
  try {
    console.log("Testing Runware Text Inference with minimax:m2.5@0...");
    const tasks = [
      {
        taskType: "textInference",
        taskUUID: crypto.randomUUID(),
        model: "minimax:m2.5@0",
        messages: [{ role: "user", content: "Write a short 1-sentence slogan for a video app." }]
      },
    ];

    const response = await fetch(RUNWARE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify(tasks),
    });
    
    const data = await response.json();
    console.log("Full Data:", JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error("Runtime Error:", error);
  }
}

test();
