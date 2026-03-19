
const RUNWARE_API_KEY = "phxWMTInUtyjTPQnYDJX9k77A1evN9F6";
const RUNWARE_API_URL = "https://api.runware.ai/v1";
const crypto = require('crypto');

async function test() {
  try {
    console.log("Listing ALL Runware Models...");
    const tasks = [
      {
        taskType: "modelSearch",
        taskUUID: crypto.randomUUID(),
        search: "", // Empty search to list everything
        limit: 100,
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
    console.log("Full Data Results Count:", data.data?.[0]?.results?.length);
    if (data.data?.[0]?.results) {
      console.log("First 10 models:", JSON.stringify(data.data[0].results.slice(0, 10).map(r => ({ name: r.name, air: r.air, category: r.category })), null, 2));
    }
    
  } catch (error) {
    console.error("Runtime Error:", error);
  }
}

test();
