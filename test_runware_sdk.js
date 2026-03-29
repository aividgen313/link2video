
const { Runware } = require('@runware/sdk-js');
const crypto = require('crypto');

async function test() {
  try {
    console.log("Testing Runware SDK Text Inference...");
    const runware = new Runware({
      apiKey: "phxWMTInUtyjTPQnYDJX9k77A1evN9F6",
    });

    // The SDK might have a specific method for text inference
    // Looking at the type definitions, it seems we might need to use 'request' or similar
    // but the types showed IRequestTextInference
    
    const result = await runware.request([
      {
        taskType: "textInference",
        taskUUID: crypto.randomUUID(),
        model: "minimax:m2.5",
        messages: [
          {
            role: "user",
            content: "Hello, how are you?"
          }
        ]
      }
    ]);
    
    console.log("SDK Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("SDK Error:", error);
  }
}

test();
