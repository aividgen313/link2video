
const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
const RUNWARE_API_URL = "https://api.runware.ai/v1";
const crypto = require('crypto');

async function test() {
  try {
    console.log("Testing Runware Text Generation with MiniMax and Messages...");
    const tasks = [
      {
        taskType: "textInference",
        taskUUID: crypto.randomUUID(),
        model: "minimax:m2.5",
        messages: [
          {
            role: "user",
            content: "Return a JSON object with a 'test' key and 'success' value. Return ONLY JSON."
          }
        ]
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
    
    if (data.errors) {
      console.error("Errors:", data.errors);
      return;
    }
    
    const text = data.data?.[0]?.text || "";
    console.log("Text Result:", text);
  } catch (error) {
    console.error("Runtime Error:", error);
  }
}

test();
