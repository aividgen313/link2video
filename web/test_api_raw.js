
const API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";

async function test() {
  const payload = [
    {
      taskType: "videoInference",
      taskUUID: "550e8400-e29b-41d4-a716-446655440001",
      positivePrompt: "A cinematic shot of a sunset over the ocean, 4k, highly detailed.",
      model: "klingai:kling-video@3-standard",
      duration: 5,
      width: 1280,
      height: 720,
      numberResults: 1
    }
  ];

  console.log("Sending payload:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Raw Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();
