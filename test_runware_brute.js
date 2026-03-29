
const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
const RUNWARE_API_URL = "https://api.runware.ai/v1";
const crypto = require('crypto');

async function testModel(model) {
  try {
    console.log(`Testing model: ${model}`);
    const tasks = [
      {
        taskType: "textInference",
        taskUUID: crypto.randomUUID(),
        model: model,
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
    if (data.errors && data.errors[0].code === 'invalidModel') {
      return false;
    }
    console.log(`Model ${model} might be valid! Result:`, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

async function run() {
  const candidates = [
    "minimax:m2.5@1",
    "meta:llama-3.1-8b-instruct@1",
    "runware:100@1",
    "runware:1@1",
    "openai:gpt-4o-mini@1",
    "meta:llama-3-8b@1",
    "minimax:1@1"
  ];
  for (const c of candidates) {
    if (await testModel(c)) break;
  }
}

run();
