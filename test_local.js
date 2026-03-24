#!/usr/bin/env node
/**
 * Local API test script
 *
 * Usage:
 *   node test_local.js                         # default: localhost:3000
 *   API_URL=http://localhost:3000 node test_local.js
 *   API_URL=https://your-app.onrender.com node test_local.js
 *
 * Start the dev server first:
 *   cd web && POLLINATIONS_API_KEY=your_key npm run dev
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

async function test(name, path, body, { expectFields = [], allowNull = [] } = {}) {
  process.stdout.write(`\n[${name}] POST ${path} ... `);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.log(`FAIL (${res.status})`);
      console.log("  →", JSON.stringify(data).substring(0, 200));
      failed++;
      return;
    }

    const missing = expectFields.filter(f => {
      if (allowNull.includes(f)) return !(f in data);  // null is ok
      return !data[f];
    });

    if (missing.length > 0) {
      console.log(`FAIL — missing fields: ${missing.join(", ")}`);
      console.log("  →", JSON.stringify(data).substring(0, 300));
      failed++;
      return;
    }

    console.log("PASS");
    for (const f of expectFields) {
      const val = data[f];
      const preview = val == null ? "null" :
        typeof val === "string" ? val.substring(0, 60) + (val.length > 60 ? "..." : "") :
        JSON.stringify(val).substring(0, 60);
      console.log(`  ${f}: ${preview}`);
    }
    passed++;
  } catch (err) {
    console.log(`ERROR — ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log(`\nTesting ${BASE_URL}\n${"=".repeat(50)}`);

  // 1. Angles
  await test(
    "Angles",
    "/api/angles",
    { topic: "The history of the internet", durationMinutes: 3 },
    { expectFields: ["angles"] }
  );

  // 2. Script / Generate
  await test(
    "Script Generate",
    "/api/generate",
    {
      topic: "The history of the internet",
      angle: "The untold story of how the internet was born",
      durationMinutes: 1,
      visualStyle: "Cinematic Documentary",
    },
    { expectFields: ["title", "scenes"] }
  );

  // 3. TTS — should always work (Edge TTS fallback requires no key)
  await test(
    "TTS (voice: adam)",
    "/api/tts",
    { text: "Hello, this is a test of the text to speech system.", voice: "adam" },
    { expectFields: ["success", "audioUrl", "audioUUID"] }
  );

  // 4. Music — non-critical, null is acceptable if no API key
  await test(
    "Music Generation",
    "/api/music",
    { prompt: "Upbeat cinematic background music, no vocals", duration: 10 },
    { expectFields: ["success", "audioUrl", "audioUUID"], allowNull: ["audioUrl", "audioUUID"] }
  );

  // 5. Runware image — requires RUNWARE_API_KEY
  await test(
    "Image (Runware)",
    "/api/runware/image",
    {
      prompt: "A beautiful sunset over the ocean, cinematic, 4k",
      model: "runware:101@1",
      width: 1280,
      height: 768,
      numberResults: 1,
    },
    { expectFields: ["images"] }
  );

  // 6. Social Copy — expects { title, angle, scenes }; returns { success, youtube, tiktok, ... }
  await test(
    "Social Copy",
    "/api/social-copy",
    {
      title: "The History of the Internet",
      angle: "The untold story of how the internet was born",
      scenes: [],
    },
    { expectFields: ["success", "youtube"] }
  );

  // Summary
  const total = passed + failed;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`\nTips:`);
    console.log("  • TTS failing? Check edge-tts-universal is installed");
    console.log("  • Music failing? Set POLLINATIONS_API_KEY env var");
    console.log("  • Image failing? Set RUNWARE_API_KEY env var");
    console.log("  • AI routes failing? Set GEMINI_API_KEY env var");
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
