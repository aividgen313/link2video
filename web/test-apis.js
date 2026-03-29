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
    if (expectedKey && data[expectedKey] === undefined) {
        console.log(`❌ ${name} returned 200 but missing ${expectedKey}:`, data);
        return false;
    }
    console.log(`✅ ${name} works! (${res.status})`);
    return true;
  } catch (err) {
    console.log(`❌ ${name} crashed: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log("Starting API Health Checks...\n");
  
  await testApi("TTS (Edge fallback)", "http://localhost:3000/api/tts", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({text: "Hello world testing TTS", voice: "adam", useEdgeTTS: true})
  }, "audioUrl");
  
  await testApi("Music Gen", "http://localhost:3000/api/music", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: "cinematic background music", duration: 5})
  }); // music api often returns success:false if pollen is down but handles it gracefully
  
  await testApi("Video Build", "http://localhost:3000/api/video", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: "a majestic mountain", duration: 2, mode: "fast"})
  });
  
  await testApi("Upload (List)", "http://localhost:3000/api/upload?path=projects.json", {
    method: "GET"
  });
  
  await testApi("Balance", "http://localhost:3000/api/balance", {
    method: "GET"
  }, "balance");
  
  console.log("\nDone.");
}

run();
