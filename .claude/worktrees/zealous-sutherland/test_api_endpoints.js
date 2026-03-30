// Simple test script to diagnose API issues
// Run with: node test_api_endpoints.js

const BASE_URL = process.env.API_URL || "http://localhost:3000";

async function testEndpoint(name, path, body) {
  console.log(`\n=== Testing ${name} ===`);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 500));

    if (!response.ok) {
      console.error(`❌ FAILED: ${data.error || 'Unknown error'}`);
      return false;
    }
    console.log(`✅ SUCCESS`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`Testing API endpoints at: ${BASE_URL}\n`);

  // Test 1: Angles Generation
  await testEndpoint(
    "Angles Generation",
    "/api/angles",
    {
      topic: "The history of the internet",
      provider: "runware",
      model: "minimax:m2.5@0"
    }
  );

  // Test 2: Script Generation
  await testEndpoint(
    "Script Generation",
    "/api/generate",
    {
      topic: "The history of the internet",
      angle: "The untold story of how the internet was born",
      provider: "runware",
      model: "minimax:m2.5@0",
      visualStyle: "Cinematic Documentary"
    }
  );

  // Test 3: TTS
  await testEndpoint(
    "TTS Generation",
    "/api/tts",
    {
      text: "This is a test of the text to speech system.",
      voiceProvider: "elevenlabs:1@1",
      duration: 10
    }
  );

  // Test 4: Image Generation
  await testEndpoint(
    "Image Generation",
    "/api/runware/image",
    {
      prompt: "A beautiful sunset over the ocean, cinematic, 4k",
      model: "runware:101@1",
      width: 1280,
      height: 768,
      numberResults: 1
    }
  );

  console.log("\n=== Test Summary ===");
  console.log("Check the results above to see which endpoints are failing.");
}

runTests().catch(console.error);
