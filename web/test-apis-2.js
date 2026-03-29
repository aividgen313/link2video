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
  console.log("Starting API Health Checks (Phase 2)...\n");
  
  await testApi("Video Build", "http://localhost:3000/api/video", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: "a majestic mountain", duration: 2, mode: "ai"})
  }, "videoUrl");
  
  await testApi("Runware Image", "http://localhost:3000/api/runware/image", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: "a majestic mountain", width: 512, height: 512})
  }, "images");
  
  await testApi("Analyze Audio", "http://localhost:3000/api/analyze-audio", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({text: "Hello world testing audio analysis"})
  });
  
  await testApi("Angles List", "http://localhost:3000/api/angles", {
    method: "GET"
  });
  
  await testApi("Social Copy", "http://localhost:3000/api/social-copy", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({title: "Test Video", platform: "twitter"})
  });
  
  await testApi("Notepad Extraction", "http://localhost:3000/api/notepad", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({sourceContent: "The majestic mountain is very tall. It is cold at the top.", sourceUrl: ""})
  }, "data");

  console.log("\nDone.");
}

run();
