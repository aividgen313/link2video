
const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
const RUNWARE_API_URL = "https://api.runware.ai/v1";
const crypto = require('crypto');

async function test() {
  try {
    console.log("Testing Runware Text Inference with memories:1@1...");
    const tasks = [
      {
        taskType: "textInference",
        taskUUID: crypto.randomUUID(),
        model: "memories:1@1",
        messages: [{ role: "user", content: "Hi" }]
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
