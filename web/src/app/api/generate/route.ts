import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { topic, url, angle, visualStyle = "Cinematic Documentary", durationMinutes = 3 } = await req.json();

    if (!topic && !url) {
      return NextResponse.json({ error: "URL or Topic is required" }, { status: 400 });
    }

    let extractedText = "";
    if (topic) {
      extractedText = topic;
    } else if (url) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        extractedText = $("body").text().slice(0, 5000);
      } catch (e) {
        console.error("Failed to fetch URL, falling back to URL text only");
        extractedText = `Topic: ${url}`;
      }
    }

    // Detect narrative style from topic keywords
    const topicLower = extractedText.toLowerCase();
    let narrativeStyle = "documentary";
    if (topicLower.startsWith("pov:") || topicLower.startsWith("pov |") || topicLower.startsWith("pov:")) {
      if (topicLower.includes("every") || topicLower.includes("level") || topicLower.includes("tier")) {
        narrativeStyle = "pov_levels";
      } else {
        narrativeStyle = "pov_scenario";
      }
    } else if (topicLower.includes("every level") || topicLower.includes("every tier") || topicLower.includes("every type")) {
      narrativeStyle = "every_level";
    } else if (topicLower.startsWith("simply explaining") || topicLower.startsWith("explain") || topicLower.includes("questions everyone") || topicLower.includes("q&a")) {
      narrativeStyle = "explainer";
    } else if ((topicLower.includes("how") && (topicLower.includes("billionaire") || topicLower.includes("millionaire") || topicLower.includes("empire") || topicLower.includes("rich") || topicLower.includes("wealthy") || topicLower.includes("built"))) ||
               (topicLower.includes("broke") && topicLower.includes("billion"))) {
      narrativeStyle = "rich_story";
    } else if (topicLower.includes("dark truth") || topicLower.includes("dark side") || topicLower.includes("secretly") || topicLower.includes("exposé") || topicLower.includes("no one talks about")) {
      narrativeStyle = "dark_truth";
    } else if (topicLower.includes("quit") || topicLower.includes("9-5") || topicLower.includes("9 to 5") || topicLower.includes("side hustle") || topicLower.includes("passive income") || topicLower.includes("from home") || topicLower.includes("fire your boss")) {
      narrativeStyle = "quit_job";
    }

    let narrativeInstructions = "";
    switch (narrativeStyle) {
      case "pov_scenario":
        narrativeInstructions = `
NARRATIVE FORMAT: POV SCENARIO (2nd Person Immersive)
Write ENTIRELY in 2nd person ("You wake up...", "You check your phone...", "Your heart races...").
Take the viewer through a vivid, emotional day-in-the-life experience of the scenario.
Structure: Morning/Beginning → Building excitement/tension → A major moment of change → Emotional peak → Reflection → Powerful final thought.
Every scene should make the viewer FEEL like they are inside the experience.
Use specific, sensory details: sounds, sights, feelings, smells. Make it cinematic and visceral.
Example narration style: "You open your eyes. The room is quiet. But today is different. Your phone buzzes once. Then again. You look down at the screen..."
`;
        break;
      case "pov_levels":
        narrativeInstructions = `
NARRATIVE FORMAT: POV LEVELS (2nd Person Tier Comparison)
Write in 2nd person ("You wake up at..."), but progress through distinct LEVELS/TIERS from lowest to highest.
Each scene = one tier or level. Show stark contrast between how different levels experience the same situation.
Start at the lowest level (broke/beginner) and climb to the highest (wealthy/elite).
Structure: Level 1 (bottom) → Level 2 → Level 3 → Level 4 → Level 5 → Level 6 (top) → Final reflection.
Make the contrast between each level VIVID and SURPRISING. Specific details = credibility.
Example: "Level 1: You set 4 alarms. You're exhausted. You eat cereal with no milk... Level 6: Your assistant calls. Your jet is ready."
`;
        break;
      case "every_level":
        narrativeInstructions = `
NARRATIVE FORMAT: EVERY LEVEL COMPARISON (3rd Person Tier Breakdown)
Break the topic into clear WEALTH/SKILL/STATUS LEVELS and show how each level experiences the same concept DIFFERENTLY.
Write in a confident, authoritative documentary voice.
Structure: Intro hook → Level 1 (bottom 20%) → Level 2 → Level 3 → Level 4 → Level 5 (top 1%) → Surprising revelation → Final takeaway.
Each level must have SPECIFIC, REALISTIC details. The contrast should be dramatic and eye-opening.
Use dollar amounts, time, specific habits, tools, mindsets that change at each level.
Example: "At $0, your morning alarm is survival. At $100K, it's optimization. At $10M, your morning doesn't start until your team is ready."
`;
        break;
      case "explainer":
        narrativeInstructions = `
NARRATIVE FORMAT: SIMPLE EXPLAINER (Demystify Complex Topics)
Write like the world's best teacher — clear, simple, relatable, and surprising.
NO jargon. Explain everything with analogies and real-world examples a 12-year-old would understand.
Structure: Hook question → Why this matters to you → Simple analogy → Deeper truth → Real-world example → Common misconception debunked → Key takeaway.
Each scene should answer a question the viewer is already silently asking.
Use "Here's the thing...", "Think of it like this...", "Most people don't realize..." language naturally.
Make complex topics feel surprisingly simple and make the viewer feel smart for watching.
`;
        break;
      case "rich_story":
        narrativeInstructions = `
NARRATIVE FORMAT: WEALTH ORIGIN STORY (Documentary Biography)
Tell a gripping, specific story of how someone built extraordinary wealth from nothing.
Write like a Netflix documentary — dramatic, specific, emotionally resonant.
Structure: Shocking hook (where they ended up) → Humble/difficult beginning → First breakthrough moment → Key insight or turning point → Rapid rise → What most people missed → The bigger lesson.
Use real-sounding specific details: dollar amounts, years, decisions, sacrifices.
The viewer should feel the emotional journey — from desperation to triumph.
Focus on the mindset shifts, the decisions others wouldn't make, and the unconventional path.
`;
        break;
      case "dark_truth":
        narrativeInstructions = `
NARRATIVE FORMAT: DARK TRUTH EXPOSÉ
Write like an investigative journalist revealing uncomfortable truths that "they" don't want you to know.
Tone: confident, slightly conspiratorial, backed with real-sounding specifics. NOT clickbait — deliver REAL insight.
Structure: Shocking hook statement → "Here's what they don't tell you..." → Layer 1 revelation → Layer 2 (deeper) → The real reason why → Who benefits from the lie → What the smart money does instead → Devastating final truth.
Use phrases like "Here's the thing nobody talks about...", "And this is where it gets dark...", "But the real story is..."
Every claim should feel backed by specific numbers, names, or examples. Make the viewer feel like an insider.
`;
        break;
      case "quit_job":
        narrativeInstructions = `
NARRATIVE FORMAT: QUIT YOUR JOB / FINANCIAL FREEDOM BLUEPRINT
Write like a mentor who already escaped the rat race and is giving the viewer the exact playbook.
Tone: energizing, specific, actionable. NOT vague motivation — give REAL steps with REAL numbers.
Structure: Hook (the contrast between your 9-5 and freedom) → Why most people stay trapped → The first thing I changed → Month 1-3 reality → The turning point → What $X/month actually looks like → The mindset shift nobody talks about → Your action plan starting today.
Use specific dollar amounts, timeframes, and platforms. Make it feel achievable but not easy.
The viewer should feel a fire lit under them — like they NEED to start today.
`;
        break;
      default: // documentary
        narrativeInstructions = `
NARRATIVE FORMAT: CINEMATIC DOCUMENTARY
Write in a compelling, cinematic documentary voice — authoritative yet emotionally engaging.
Structure: HOOK → SETUP → RISING TENSION → CLIMAX → RESOLUTION → FINAL LINE.
`;
    }

    // Map visual style to aesthetic instructions for the AI
    const STYLE_MAP: Record<string, string> = {
      "Cinematic Documentary": "cinematic documentary footage, hyperrealistic 4k B-roll, dramatic lighting, shallow depth of field",
      "Photorealistic": "highly detailed hyperrealistic photography, natural lighting, 8k resolution, DSLR quality",
      "Animated Storytime": "2D flat vector graphics, vibrant colors, cartoon style, bold outlines. Do NOT request photorealism",
      "3D Render": "3D renders, Pixar/Disney style characters, soft lighting, high-quality 3D assets",
      "Anime": "Japanese anime style, Studio Ghibli aesthetics, hand-drawn backgrounds, cel-shaded characters",
      "Film Noir": "high contrast black and white, deep shadows, dramatic venetian blind lighting, 1940s detective aesthetic",
      "70s Retro Film": "grainy 35mm film, warm amber tones, lens flare, vintage 1970s color grading, soft focus",
      "80s VHS Aesthetic": "VHS tape quality, scan lines, chromatic aberration, neon colors, 1980s retro aesthetic",
      "90s Camcorder": "handheld camcorder footage, slightly grainy, timestamped, natural 1990s home video look",
      "Golden Hour Cinema": "warm golden hour sunlight, long shadows, cinematic lens flare, magic hour photography",
      "Neon Noir": "neon-lit dark streets, rain reflections, cyberpunk noir, electric blue and magenta lighting",
      "Wes Anderson": "symmetrical composition, pastel color palette, whimsical staging, centered framing, quirky aesthetic",
      "Christopher Nolan": "IMAX quality, desaturated tones, epic scale, practical effects look, Hans Zimmer mood",
      "Tarantino Grindhouse": "gritty 70s exploitation film, film grain, saturated colors, dramatic close-ups, retro title cards",
      "Blade Runner Cyberpunk": "rain-soaked neon cityscape, holographic ads, dark futuristic dystopia, teal and orange grading",
      "IMAX Documentary": "ultra-wide IMAX format, crystal clear 8k, sweeping panoramic shots, nature documentary quality",
      "Drone Footage": "aerial drone perspective, sweeping overhead shots, vast landscapes, bird's eye view, smooth gimbal",
      "Manga Panel": "black and white manga style, screen tones, speed lines, dramatic panel layouts, Japanese comic art",
      "Comic Book": "bold comic book art, halftone dots, speech bubbles, dynamic action poses, vibrant primary colors",
      "Graphic Novel": "moody graphic novel illustration, ink wash, limited color palette, noir storytelling",
      "Flat Vector": "clean flat vector illustration, geometric shapes, minimal detail, modern infographic style",
      "Isometric 3D": "isometric perspective, 3D diorama style, clean edges, miniature world, tilted top-down view",
      "Claymation": "clay animation style, handmade texture, stop-motion look, plasticine characters, warm lighting",
      "Stop Motion": "stop motion animation, handcrafted miniatures, visible textures, Laika Studios quality",
      "Papercraft": "paper cutout art, layered paper textures, origami style, craft materials, shadow puppet aesthetic",
      "Storybook Illustration": "children's book illustration, soft watercolors, whimsical characters, fairy tale aesthetic",
      "Pixel Art": "detailed pixel art, 16-bit retro game style, limited color palette, crisp pixels",
      "Retro Game": "retro video game aesthetic, 8-bit/16-bit sprites, chiptune mood, arcade cabinet screen",
      "Low Poly 3D": "low polygon 3D art, geometric facets, minimalist 3D, vibrant flat shading",
      "Chibi Cartoon": "cute chibi characters, oversized heads, small bodies, kawaii style, bright colors",
      "Oil Painting": "classical oil painting, visible brushstrokes, rich pigments, gallery-quality fine art",
      "Watercolor": "soft watercolor painting, wet-on-wet technique, gentle color bleeds, translucent washes",
      "Charcoal Sketch": "detailed charcoal drawing, dramatic shading, textured paper, black and white, smudged edges",
      "Pencil Drawing": "precise pencil illustration, cross-hatching, fine detail, sketch pad texture",
      "Renaissance Art": "Italian Renaissance painting, classical composition, chiaroscuro lighting, Michelangelo/Da Vinci style",
      "Impressionist": "impressionist painting, visible brushstrokes, dappled light, Monet/Renoir color palette",
      "Surrealism": "surrealist art, dream-like imagery, impossible geometry, Salvador Dali melting aesthetic",
      "Pop Art": "bold pop art, Ben-Day dots, bright primary colors, Andy Warhol/Roy Lichtenstein style",
      "Art Deco": "art deco design, geometric patterns, gold and black, 1920s glamour, ornate details",
      "Ukiyo-e Japanese": "traditional ukiyo-e woodblock print, wave patterns, Japanese landscape, Hokusai style",
      "Graffiti Street Art": "urban graffiti art, spray paint texture, street wall, Banksy-style stencil, bold colors",
      "Collage Mixed Media": "mixed media collage, torn paper, magazine cutouts, layered textures, assemblage art",
      "Portrait Photography": "professional portrait, studio lighting, shallow depth of field, 85mm lens, sharp focus on face",
      "Street Photography": "candid street photography, urban environment, natural moment, Henri Cartier-Bresson style",
      "Fashion Editorial": "high fashion editorial, studio lighting, Vogue magazine quality, stylized poses, luxury aesthetic",
      "Sports Action": "high-speed sports photography, frozen motion, dramatic angles, 1/4000s shutter speed, intense action",
      "Macro Close-Up": "extreme macro photography, incredible detail, shallow DOF, microscopic textures revealed",
      "Aerial Photography": "aerial view photography, patterns from above, geographic perspective, satellite imagery style",
      "Black and White": "dramatic black and white photography, high contrast, Ansel Adams quality, timeless monochrome",
      "Polaroid Vintage": "instant Polaroid photo, white border, slightly faded colors, nostalgic vintage feel, soft vignette",
      "Tilt-Shift Miniature": "tilt-shift photography, miniature effect, selective focus, toy-like perspective, vibrant colors",
      "Long Exposure": "long exposure photography, light trails, silky smooth water, motion blur, nighttime cityscapes",
      "Dark Fantasy": "dark fantasy art, moody atmosphere, magical creatures, epic scale, Lord of the Rings aesthetic",
      "Gothic Horror": "gothic horror, dark cathedral, candlelight, fog, eerie atmosphere, Tim Burton style",
      "Dystopian": "dystopian world, bleak industrial landscape, oppressive atmosphere, muted colors, totalitarian",
      "Post-Apocalyptic": "post-apocalyptic wasteland, ruined buildings, overgrown nature, survival aesthetic, The Last of Us",
      "Sci-Fi Futuristic": "sleek sci-fi future, holographic displays, chrome surfaces, space-age technology, clean lines",
      "Cyberpunk 2077": "cyberpunk aesthetic, body augmentation, neon signs, dense urban sprawl, night city",
      "Vaporwave": "vaporwave aesthetic, pink/purple/teal gradients, Roman busts, palm trees, glitch effects, 90s internet",
      "Synthwave": "synthwave retro-futurism, neon grid, sunset gradient, chrome text, DeLorean aesthetic, 80s nostalgia",
      "Holographic": "holographic projection, transparent displays, iridescent light, futuristic AR/VR, prismatic colors",
      "National Geographic": "National Geographic quality, stunning nature photography, wildlife, breathtaking landscapes",
      "Luxury Lifestyle": "luxury lifestyle photography, high-end brands, marble and gold, champagne, premium aesthetic",
      "Minimalist Clean": "minimalist design, clean white space, simple composition, modern, uncluttered, zen aesthetic",
      "Vintage Sepia": "vintage sepia tone, antique photograph, aged paper texture, historical look, early 1900s",
    };

    const styleDesc = STYLE_MAP[visualStyle] || STYLE_MAP["Cinematic Documentary"];
    const aestheticRules = `CRITICAL AESTHETIC: You must write visual_prompts in the style of: ${styleDesc}. Every scene's visual_prompt MUST reflect this aesthetic consistently.`;

    // STEP 1: Generate a detailed visual reference sheet for all subjects
    console.log("Generating visual reference sheet...");
    const referencePrompt = `You are a visual reference expert. Given the following subject matter, identify EVERY real person, celebrity, athlete, brand, company, logo, product, location, or historical event mentioned or implied.

Subject: ${extractedText}
Angle: ${angle || "General"}

For EACH entity, write an extremely detailed physical/visual description that an AI image generator would need to create a photorealistic, accurate depiction. Be HYPER-SPECIFIC:

For PEOPLE: exact skin tone, face shape, hairstyle (specific to their most iconic look), facial hair, eye shape, build, height impression, signature expressions, what they're known for wearing. Reference their most iconic/recognizable appearance.

For BRANDS/LOGOS: exact colors (hex-level precision in words), font style, logo shape, iconic design elements, packaging details, store aesthetics.

For LOCATIONS: architectural style, notable features, lighting conditions, atmosphere.

Format as a simple reference list like:
PERSON - Michael Jordan: Dark brown skin, bald head (shaved clean), 6'6" tall with an extremely athletic muscular build, intense focused brown eyes, strong jawline, often seen in Chicago Bulls red #23 jersey, or in a fitted black suit. Signature: tongue-out expression while dunking. Gold hoop earring in left ear.

BRAND - Nike: Swoosh logo (curved checkmark shape), black or white on contrasting background...

Return ONLY the reference descriptions. No commentary.`;

    let visualReferenceSheet = "";
    try {
      visualReferenceSheet = await generateGeminiText(referencePrompt);
      // Clean thinking tags from reference sheet
      visualReferenceSheet = visualReferenceSheet.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      console.log("Visual reference sheet generated:", visualReferenceSheet.substring(0, 300));
    } catch (e) {
      console.warn("Reference sheet generation failed, continuing without it");
    }

    // STEP 2: Build the script generation prompt with reference sheet injected
    const prompt = `
You are an elite YouTube scriptwriter and viral content creator.
You specialize in creating HIGH-RETENTION scripts that keep viewers watching until the very last second.
Every script you write feels like it belongs on a channel with millions of subscribers.

Subject Matter: ${extractedText}
Angle: ${angle}

${narrativeInstructions}

UNIVERSAL WRITING RULES:
- Vary sentence length for rhythm and pacing
- Use short punchy lines during intense or dramatic moments
- Use longer sentences for storytelling and atmosphere
- Every 10-20 seconds must introduce new information, a question, or a twist
- NEVER use filler words or generic phrasing
- Use psychological triggers: curiosity, suspense, surprise, empathy, aspiration
- ALWAYS write in English unless the topic specifically involves other languages

VISUAL PROMPT RULES — EXTREME LIKENESS REQUIRED:
- Each scene's visual_prompt must describe EXACTLY what should appear on screen
- Be specific about: camera movement, mood, lighting, subject, composition
- Think cinematic B-roll, Ken Burns-style photography, atmospheric footage
- The visual must emotionally reinforce the narration

CRITICAL — PHOTOREALISTIC ACCURACY:
- Every person mentioned MUST be described with their EXACT physical appearance: specific skin tone, facial features, hairstyle, body type, clothing, and signature look
- Every brand/logo MUST include exact colors, font style, logo shape, and design details
- Every location MUST include specific architectural details, signage, and atmosphere
- Names and text shown in the image MUST be spelled correctly
- Do NOT use generic descriptions like "a man" or "a basketball player" — describe the EXACT person with unmistakable identifying features
- The viewer should be able to identify every person and brand INSTANTLY from the image alone
- Include the person's name in the prompt (e.g. "Michael Jordan, bald head, dark brown skin, athletic build, wearing Bulls #23 jersey")
${visualReferenceSheet ? `
VISUAL REFERENCE SHEET — USE THESE EXACT DESCRIPTIONS IN EVERY VISUAL PROMPT:
${visualReferenceSheet}

You MUST use the physical descriptions from the reference sheet above when writing visual_prompts. Copy key details directly into each prompt.` : ""}

${aestheticRules}

SCRIPT OUTPUT:
The target video duration is ${durationMinutes} minute(s) (${durationMinutes * 60} seconds total).
Generate approximately ${Math.ceil(durationMinutes * 60 / 8)} scenes to fill this duration.
Each scene should be roughly 6-12 seconds of narration.

Each scene must have:
- narration: The voiceover text (cinematic, immersive, emotionally engaging)
- visual_prompt: Detailed AI image generation prompt describing the exact visual moment (camera angle, lighting, mood, subject)
- duration_estimate_seconds: Duration based on narration length (typically 6-12 seconds per scene)

QUALITY CHECK BEFORE RESPONDING:
- Does the HOOK make you stop scrolling?
- Does the story have real emotional stakes?
- Is there genuine tension and progression?
- Does it feel like a Netflix documentary, not a Wikipedia article?
- Would this realistically get millions of views?
- Does the FINAL LINE leave a lasting impression?

Format your response as a JSON object with:
{
  "title": "Compelling, clickable video title",
  "angle": "The narrative angle/hook",
  "scenes": [
    {
      "narration": "The voiceover text",
      "visual_prompt": "Detailed visual description with camera movement, mood, lighting",
      "duration_estimate_seconds": 8
    }
  ]
}

CRITICAL JSON RULES:
- Return ONLY raw JSON. No markdown, no code blocks, no backticks, no explanations.
- All strings must be valid JSON — escape double quotes with backslash (\\").
- For heights, use feet-inches format without quote marks (e.g. "6 foot 6" not "6'6\\"").
- Do NOT wrap the response in \`\`\`json or \`\`\` code blocks.
`;

    // STEP 3: Generate the script
    console.log("Generating script via Groq...");
    const responseText = await generateGeminiText(prompt);
    console.log("Raw AI response (first 500 chars):", responseText.substring(0, 500));

    // Clean up response text: strip <think> tags, markdown fences, and extract JSON
    let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    let jsonStr = jsonMatch ? jsonMatch[0] : cleanText;

    let scriptData;
    try {
      scriptData = JSON.parse(jsonStr);
      console.log("Successfully parsed script with", scriptData.scenes?.length || 0, "scenes");
    } catch (e) {
      // Try to repair common JSON issues (unescaped quotes in strings like 5'9")
      try {
        // Fix unescaped double quotes inside string values (e.g. height measurements 5'9")
        const repaired = jsonStr.replace(/(?<=:\s*"[^"]*?)(\d+)'(\d+)"(?=[^"]*?")/g, "$1'$2\\'");
        scriptData = JSON.parse(repaired);
        console.log("Parsed script after repair with", scriptData.scenes?.length || 0, "scenes");
      } catch (e2) {
        // Last resort: try to eval-parse with relaxed JSON
        try {
          scriptData = (new Function('return ' + jsonStr))();
          console.log("Parsed script via eval with", scriptData.scenes?.length || 0, "scenes");
        } catch (e3) {
          console.error("JSON Parse failed for response:", responseText.substring(0, 1000));
          throw new Error("Failed to parse AI response as JSON.");
        }
      }
    }

    if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
      throw new Error("AI response missing required 'scenes' array");
    }

    // Ensure every scene has an id and scene_number (AI doesn't generate these)
    scriptData.scenes = scriptData.scenes.map((scene: any, index: number) => ({
      ...scene,
      id: scene.id ?? index + 1,
      scene_number: scene.scene_number ?? index + 1,
      duration_estimate_seconds: scene.duration_estimate_seconds || 8,
    }));

    return NextResponse.json(scriptData);
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
