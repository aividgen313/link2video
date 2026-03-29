const fs = require('fs');

async function testApi(name, url, options, expectedKey) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
        let errStr = res.statusText;
        try {
            const errBody = await res.json();
            errStr = JSON.stringify(errBody);
        } catch(e) {}
        console.log(`❌ ${name} failed: HTTP ${res.status} - ${errStr}`);
        return false;
    }
    const data = await res.json();
    if (expectedKey) {
        if (data[expectedKey] === undefined && (data.data === undefined || data.data[expectedKey] === undefined)) {
            console.log(`❌ ${name} returned 200 but missing ${expectedKey}:`, data);
            return false;
        }
    }
    console.log(`✅ ${name} works! (${res.status})`);
    return true;
  } catch (err) {
    console.log(`❌ ${name} crashed: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log("Starting API Health Checks (Final)...");
  
  await testApi("Analyze Audio", "http://localhost:3000/api/analyze-audio", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({text: "Hello world testing audio analysis", durationSeconds: 5})
  });
  
  await testApi("Angles List", "http://localhost:3000/api/angles", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({topic: "The history of video games"})
  }, "angles");
  
  await testApi("Social Copy", "http://localhost:3000/api/social-copy", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({title: "Test Video", angle: "A deep dive into testing", scenes: [{narration: "Here we test the API."}]})
  }, "youtube");
  
  await testApi("Notepad Extraction", "http://localhost:3000/api/notepad/extract", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({sources: [{type:"text", content:"Majestic mountains"}]})
  }, "data");

  console.log("\nDone.");
}

run();
