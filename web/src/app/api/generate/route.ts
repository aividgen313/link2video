import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText } from "@/lib/gemini";

// Script generation can take 2+ minutes for large scene counts
export const maxDuration = 180;

function repairJson(str: string): string {
  let repaired = str.replace(/(\d+)'(\d+)"/g, '$1 foot $2');
  repaired = repaired.replace(/(\d+)'(\d+)\\"/g, '$1 foot $2');
  return repaired;
}

function tryCompleteJson(str: string): string {
  let s = str.trim();
  let braces = 0, brackets = 0, inString = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }
  if (inString) s += '"';
  for (let i = 0; i < brackets; i++) s += ']';
  for (let i = 0; i < braces; i++) s += '}';
  return s;
}

function parseScriptData(responseText: string): any {
  console.log("Raw AI response (first 500 chars):", responseText.substring(0, 500));

  let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, '').trim();
  const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  let jsonStr = jsonMatch ? jsonMatch[0] : cleanText;

  let scriptData;
  try {
    scriptData = JSON.parse(repairJson(jsonStr));
    console.log("Successfully parsed script with", scriptData.scenes?.length || 0, "scenes");
  } catch (e) {
    try {
      const completed = tryCompleteJson(repairJson(jsonStr));
      scriptData = JSON.parse(completed);
      console.log("Parsed script after completion with", scriptData.scenes?.length || 0, "scenes");
    } catch (e2) {
      // Last resort: try stripping trailing commas and re-parsing
      try {
        let cleaned = repairJson(jsonStr);
        // Remove trailing commas before ] or }
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
        // Try completing again after comma cleanup
        cleaned = tryCompleteJson(cleaned);
        scriptData = JSON.parse(cleaned);
        console.log("Parsed script after deep cleanup with", scriptData.scenes?.length || 0, "scenes");
      } catch (e3) {
        console.error("JSON Parse failed for response:", responseText.substring(0, 1000));
        throw new Error("Failed to parse AI response as JSON.");
      }
    }
  }

  if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
    throw new Error("AI response missing required 'scenes' array");
  }

  scriptData.scenes = scriptData.scenes.map((scene: any, index: number) => ({
    ...scene,
    id: scene.id ?? index + 1,
    scene_number: scene.scene_number ?? index + 1,
    duration_estimate_seconds: scene.duration_estimate_seconds || 8,
  }));

  return scriptData;
}

function parseAndReturnScript(responseText: string): NextResponse {
  return NextResponse.json(parseScriptData(responseText));
}

export async function POST(req: NextRequest) {
  try {
    const { topic, url, angle, visualStyle = "Cinematic Documentary", durationMinutes = 3, continueFrom, endStory, existingTitle, mode, storyText, characterProfiles, lyrics, musicSegments, youtubeStyleSuffix, activeStyle, settingText } = await req.json();

    // Short Story, Music Video, and Notepad modes don't need topic/url
    if (!topic && !url && mode !== "short-story" && mode !== "music-video" && mode !== "notepad" && mode !== "extract-characters" && mode !== "extract-subjects") {
      return NextResponse.json({ error: "URL or Topic is required" }, { status: 400 });
    }

    // ========== EXTRACT SUBJECTS MODE (for reference image search) ==========
    if (mode === "extract-subjects" && storyText) {
      console.log("Extracting subjects for reference image search...");
      const subjectPrompt = `Read this text and identify the key REAL subjects that would need reference images for accurate visual generation.

TEXT:
${storyText.substring(0, 3000)}

Extract REAL people (celebrities, historical figures, public figures), REAL locations (specific buildings, cities, landmarks), and REAL brands/products.
Do NOT include generic descriptions or fictional elements.

Return ONLY raw JSON (no markdown fences):
{ "subjects": [ { "name": "Full Name", "type": "person" }, { "name": "Location Name", "type": "location" }, { "name": "Brand Name", "type": "brand" } ] }

Keep to the most important 5-8 subjects max.`;

      try {
        const responseText = await generateGeminiText(subjectPrompt);
        let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json(parsed);
        }
      } catch (err) {
        console.warn("Subject extraction failed:", err);
      }
      return NextResponse.json({ subjects: [] });
    }

    // ========== EXTRACT CHARACTERS MODE ==========
    if (mode === "extract-characters" && storyText) {
      console.log("Extracting characters from story...");
      const charPrompt = `You are a character analyst. Read this story and extract all characters with detailed visual descriptions for AI image generation.

STORY:
${storyText.substring(0, 5000)}

For each character, provide:
- id: a unique ID like "char_001"
- name: the character's name
- appearance: extremely detailed physical description (skin tone, hair color/style, eye color, face shape, body build, height, distinguishing features)
- age: approximate age
- gender: male/female/other
- clothing: typical outfit described in detail
- role: protagonist/antagonist/supporting

Return ONLY raw JSON (no markdown fences):
{ "characters": [ { "id": "char_001", "name": "...", "appearance": "...", "age": "...", "gender": "...", "clothing": "...", "role": "protagonist" } ] }`;

      const responseText = await generateGeminiText(charPrompt);
      let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      cleanText = cleanText.replace(/```(?:json)?\s*\r?\n?/gi, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json(parsed);
        } catch {
          return NextResponse.json({ characters: [] });
        }
      }
      return NextResponse.json({ characters: [] });
    }

    let extractedText = "";
    if (mode === "notepad" && storyText) {
      extractedText = storyText.substring(0, 12000);
    } else if (mode === "short-story" && storyText) {
      extractedText = storyText.substring(0, 8000);
    } else if (mode === "music-video" && lyrics) {
      extractedText = lyrics.substring(0, 5000);
    } else if (topic) {
      extractedText = topic;
    } else if (url) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Link2Video/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, nav, footer, ads
        $("script, style, nav, footer, header, .sidebar, .ad, .advertisement, #comments, .mw-jump-link, .mw-editsection").remove();

        // For Wikipedia, extract the main content area
        let mainContent = "";
        const wikiBody = $("#mw-content-text .mw-parser-output").first();
        if (wikiBody.length) {
          // Get all paragraphs from the wiki article
          mainContent = wikiBody.find("p, h2, h3, li").map((_i: number, el: any) => $(el).text().trim()).get().join("\n");
        } else {
          // Generic: try article/main tags first, then body
          const article = $("article, main, [role='main'], .content, .post-content, .entry-content").first();
          if (article.length) {
            mainContent = article.text();
          } else {
            mainContent = $("body").text();
          }
        }

        // Clean up whitespace
        mainContent = mainContent.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

        // Use up to 12000 chars to get the FULL story
        extractedText = mainContent.slice(0, 12000);
        console.log(`URL content extracted: ${extractedText.length} chars from ${url}`);
      } catch (e) {
        console.error("Failed to fetch URL, falling back to URL text only");
        extractedText = `Topic: ${url}`;
      }
    }

    // Detect narrative style from activeStyle or USER'S ORIGINAL INPUT
    const userInput = ((topic || "") + " " + (angle || "")).toLowerCase().trim();
    let narrativeStyle = "documentary";

    if (activeStyle) {
      const styleMap: Record<string, string> = {
        "POV Scenario": "pov_scenario",
        "POV Levels": "pov_levels",
        "Every Level": "every_level",
        "Origin Story": "rich_story",
        "Quit Your Job": "quit_job",
        "Dark Truth": "dark_truth",
        "Explainer": "explainer",
        "Documentary": "documentary"
      };
      narrativeStyle = styleMap[activeStyle] || "documentary";
    } else {
      if (userInput.startsWith("pov:") || userInput.startsWith("pov |") || userInput.startsWith("pov:")) {
        if (userInput.includes("every") || userInput.includes("level") || userInput.includes("tier")) {
          narrativeStyle = "pov_levels";
        } else {
          narrativeStyle = "pov_scenario";
        }
      } else if (userInput.includes("every level") || userInput.includes("every tier") || userInput.includes("every type")) {
        narrativeStyle = "every_level";
      } else if (userInput.startsWith("simply explaining") || userInput.startsWith("explain") || userInput.includes("questions everyone") || userInput.includes("q&a")) {
        narrativeStyle = "explainer";
      } else if ((userInput.includes("how") && (userInput.includes("billionaire") || userInput.includes("millionaire") || userInput.includes("empire") || userInput.includes("rich") || userInput.includes("wealthy") || userInput.includes("built"))) ||
                 (userInput.includes("broke") && userInput.includes("billion"))) {
        narrativeStyle = "rich_story";
      } else if (userInput.includes("dark truth") || userInput.includes("dark side") || userInput.includes("secretly") || userInput.includes("exposé") || userInput.includes("no one talks about")) {
        narrativeStyle = "dark_truth";
      } else if (userInput.includes("quit") || userInput.includes("9-5") || userInput.includes("9 to 5") || userInput.includes("side hustle") || userInput.includes("passive income") || userInput.includes("from home") || userInput.includes("fire your boss")) {
        narrativeStyle = "quit_job";
      }
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
    const suffixRule = youtubeStyleSuffix ? `\nADDITIONAL STYLE SUFFIX — Append the following to EVERY visual_prompt: "${youtubeStyleSuffix}"` : "";
    const activeStyleModifier = activeStyle ? `\nThe visual mood and framing should also strongly reflect a "${activeStyle}" narrative format.` : "";
    const settingRules = settingText ? `\nCRITICAL SETTING / LOCATION: The user has specified the following setting/location for the story: "${settingText}". You MUST use this setting prominently in the visual_prompts and adapt the narrative to fit this environment.` : "";
    const aestheticRules = `CRITICAL AESTHETIC: You must write visual_prompts in the style of: ${styleDesc}.${activeStyleModifier}\nEvery scene's visual_prompt MUST reflect this aesthetic consistently.${suffixRule}${settingRules}`;

    // ========== SHORT STORY MODE ==========
    if (mode === "short-story") {
      console.log("Generating script from short story...");

      // Build character reference sheet from profiles
      let characterSheet = "";
      if (characterProfiles && characterProfiles.length > 0) {
        characterSheet = `\nCHARACTER REFERENCE SHEET — USE THESE EXACT DESCRIPTIONS IN EVERY VISUAL PROMPT WHERE THE CHARACTER APPEARS:\n`;
        for (const cp of characterProfiles) {
          characterSheet += `${cp.role.toUpperCase()} - ${cp.name}: ${cp.appearance}`;
          if (cp.age) characterSheet += `, age ${cp.age}`;
          if (cp.clothing) characterSheet += `, wearing ${cp.clothing}`;
          characterSheet += `\n`;
        }
        characterSheet += `\nYou MUST copy key physical details from each character profile into every visual_prompt where that character appears. The viewer should recognize the same character across ALL scenes.\n`;
      }

      const storyPrompt = `
You are an elite cinematographer and screenwriter who has directed award-winning short films. Convert the following short story into a cinematic video script.

SHORT STORY:
${extractedText}

INSTRUCTIONS:
- Parse the story into a series of visual scenes following a clear dramatic arc: HOOK → Setup → Rising Tension → Climax → Resolution
- Scene 1 MUST be a cold open — drop viewers into the most dramatic or intriguing moment
- Each scene should be 12-16 seconds of dense narration (approx. 3-4 sentences per scene)
- Screenwriting rule: 1 page = 1 minute. Ensure you write ENOUGH dialogue for each scene!
- The narration should be adapted from the story — rewrite as compelling cinematic voiceover (not word-for-word copy)
- Vary the emotional tempo: tense → reflective → explosive → quiet → revelation
- Include "breathing room" — not every scene should be high-intensity
- The final 2-3 scenes must build to a satisfying climax and memorable conclusion
- Target approximately ${Math.ceil(durationMinutes * 60 / 8)} scenes for a ${durationMinutes}-minute video
${characterSheet}

VISUAL PROMPT RULES:
- Each visual_prompt describes exactly what appears on screen: camera angle, lighting, mood, characters, setting, color palette
- VARY camera angles across scenes: wide establishing → medium → close-up → extreme close-up → aerial → tracking → POV
- NEVER use the same camera angle for 3+ consecutive scenes
- Use camera movement to match emotion: slow push-in for tension, pull-back for revelation, handheld for chaos
- Include specific lighting: "golden hour warmth", "harsh fluorescent", "neon-soaked", "candlelit intimacy", "overcast gray"
- visual_prompt must be a PURE CINEMATIC DESCRIPTION — NEVER include metadata like "Name:", "Height:", "Age:", "Role:", character stats, or text overlays
- Write visual_prompt like a movie shot description, NOT a character profile sheet

ABSOLUTE RULE — CHARACTER IDENTITY LOCK (NON-NEGOTIABLE):
- The MAIN CHARACTER must look IDENTICAL in EVERY SINGLE scene — same skin tone, same face, same hair, same build
- COPY-PASTE the same physical description into every visual_prompt where a character appears
- NEVER change a character's race, skin tone, or physical features between scenes
- If Scene 1 has "a young Black woman with box braids, dark brown skin, athletic build" then EVERY later scene with that character MUST repeat that exact description
- Each visual_prompt MUST start with the character's full physical description before describing the scene
- Think of it like a movie — the same actor plays the role from beginning to end

${aestheticRules}

Format as JSON:
{
  "title": "Video title based on the story",
  "angle": "The narrative perspective",
  "character_identities": {
    "Character Name": "LOCKED physical description that appears verbatim in every visual_prompt featuring this character"
  },
  "scenes": [
    {
      "narration": "Voiceover text adapted from the story. Must be 3-4 sentences (approx 12-16 seconds worth) to ensure the scene has enough dialogue.",
      "visual_prompt": "MUST START with the character's full physical description, then camera angle, lighting, mood, setting",
      "duration_estimate_seconds": 15,
      "camera_angle": "medium wide shot",
      "lighting": "warm afternoon light",
      "mood": "contemplative",
      "characters": ["character_name"]
    }
  ]
}

CRITICAL JSON RULES:
- Return ONLY raw JSON. No markdown, no code blocks, no backticks.
- All strings must be valid JSON — escape double quotes with backslash.
- For heights, use "6 foot 2" not "6'2\\"".
`;

      const responseText = await generateGeminiText(storyPrompt);
      return parseAndReturnScript(responseText);
    }

    // ========== MUSIC VIDEO MODE ==========
    if (mode === "music-video") {
      console.log("Generating music video script...");

      let segmentInstructions = "";
      if (musicSegments && musicSegments.length > 0) {
        segmentInstructions = `\nSONG STRUCTURE (pre-analyzed segments):\n`;
        for (const seg of musicSegments) {
          segmentInstructions += `Segment ${seg.id} [${seg.type}] ${seg.startTime}s - ${seg.endTime}s: ${seg.lyrics || "(instrumental)"}\n`;
        }
        segmentInstructions += `\nGenerate exactly ONE scene per segment. Each scene's duration_estimate_seconds MUST match the segment duration (endTime - startTime).\n`;
      }

      // Build character reference from profiles if provided
      let characterSheet = "";
      if (characterProfiles && characterProfiles.length > 0) {
        characterSheet = `\nCHARACTER/ARTIST REFERENCE:\n`;
        for (const cp of characterProfiles) {
          characterSheet += `${cp.role.toUpperCase()} - ${cp.name}: ${cp.appearance}`;
          if (cp.clothing) characterSheet += `, wearing ${cp.clothing}`;
          characterSheet += `\n`;
        }
      }

      const musicPrompt = `
You are a creative director for music videos. Create a visual script for a music video.

${lyrics ? `SONG LYRICS:\n${extractedText}` : "INSTRUMENTAL TRACK (no lyrics)"}
${segmentInstructions}
${characterSheet}

INSTRUCTIONS:
- Create visually striking, music-video-worthy scenes
- Match visual energy to the music structure:
  * Intro: atmospheric, establishing shots, mood setting
  * Verse: narrative, storytelling, character-focused
  * Chorus: high energy, dramatic visuals, wide shots, dynamic movement
  * Bridge: transition, ethereal, different mood/location
  * Outro: resolution, fade-out, emotional conclusion
- The "narration" field should contain the lyrics for that segment (these become subtitles, NOT voiceover)
- If a segment has no lyrics, set narration to a brief description for subtitle display
- Visual prompts should be cinematic and dynamic — think real music video production

VISUAL PROMPT RULES:
- Include camera_angle (tracking shot, crane shot, close-up, dolly zoom, etc.)
- Include lighting (neon, strobe, golden hour, spotlight, etc.)
- Include mood (energetic, melancholic, triumphant, mysterious, etc.)
- Music videos use MORE dynamic camera work than documentaries — be creative!
- Include choreography or movement descriptions where appropriate
- visual_prompt must be a PURE CINEMATIC DESCRIPTION — NEVER include metadata like "Name:", "Height:", "Age:", character stats, or text overlays
- Write visual_prompt like a music video director's shot description, NOT a character sheet

ABSOLUTE RULE — ARTIST/CHARACTER IDENTITY LOCK (NON-NEGOTIABLE):
- The artist/main character must look IDENTICAL in EVERY SINGLE scene — same skin tone, same face, same hair, same build
- COPY-PASTE the same physical description into every visual_prompt where they appear
- NEVER change a character's race, skin tone, or physical features between scenes
- Every visual_prompt featuring a character MUST start with their full physical description
- Think of it like a real music video — the same person performs throughout

${aestheticRules}

Format as JSON:
{
  "title": "Music Video Title",
  "angle": "Visual concept / theme",
  "character_identities": {
    "Artist Name": "LOCKED physical description: skin tone, face, hair, build, style — appears verbatim in every visual_prompt"
  },
  "scenes": [
    {
      "narration": "Lyrics for this segment (shown as subtitles)",
      "visual_prompt": "MUST START with artist's full physical description, then camera angle, action, setting, lighting, mood",
      "duration_estimate_seconds": 30,
      "camera_angle": "tracking shot moving through crowd",
      "lighting": "neon lights, strobing",
      "mood": "energetic",
      "characters": ["Artist Name"]
    }
  ]
}

CRITICAL JSON RULES:
- Return ONLY raw JSON. No markdown, no code blocks, no backticks.
- All strings must be valid JSON — escape double quotes with backslash.
`;

      const responseText = await generateGeminiText(musicPrompt);
      return parseAndReturnScript(responseText);
    }

    // ========== LINK/TOPIC MODE (original) ==========
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
- Vary sentence length for rhythm and pacing — SHORT. Then longer, more reflective beats.
- Use short punchy lines during intense or dramatic moments
- Use longer sentences for storytelling and atmosphere
- Every 10-20 seconds must introduce new information, a question, or a twist
- NEVER use filler words or generic phrasing ("In a world where...", "Little did he know...", "But that's not all...")
- Use psychological triggers: curiosity, suspense, surprise, empathy, aspiration
- ALWAYS write in English unless the topic specifically involves other languages
- The narration must tell the ACTUAL STORY from the source material — stick to the REAL facts, events, and people
- NEVER narrate physical descriptions of characters — that's what the visual_prompt is for
- The narration should NEVER say things like "He stands 6 foot 2 with a muscular frame" — instead, TELL THE STORY
- Narration = storytelling voiceover. Visual_prompt = what the camera sees. Keep them separate.

PACING AND NARRATIVE ARC:
- Scene 1 MUST be a cold open hook — drop the viewer into the most dramatic, surprising, or emotional moment FIRST
- Follow a clear dramatic arc: Hook → Setup → Rising Tension → Climax → Resolution/Twist
- Vary the emotional tempo: tense → reflective → explosive → quiet → revelation
- Include "breathing room" scenes — not every scene should be high-intensity; quiet moments make loud ones hit harder
- Plant questions early and answer them later — create micro-mysteries that keep viewers watching
- Use cliffhanger transitions between scenes: end one scene with a question, start the next with a partial answer
- The last 2-3 scenes must build to a climactic payoff or satisfying twist — NEVER let the ending fizzle out

CAMERA AND CINEMATIC LANGUAGE:
- Vary camera angles across scenes: wide establishing → medium → close-up → extreme close-up → aerial → tracking → POV
- NEVER use the same camera angle for 3+ consecutive scenes
- Use camera movement to match emotion: slow push-in for tension, pull-back for revelation, handheld for chaos, steady for authority
- Include specific shot descriptions: "low angle looking up", "over-the-shoulder", "bird's-eye view", "Dutch angle"
- Lighting should evolve with the story mood: warm golden for hope, cold blue for isolation, harsh contrast for conflict, soft diffused for intimacy

VISUAL PROMPT RULES — EXTREME LIKENESS REQUIRED:
- Each scene's visual_prompt must describe EXACTLY what should appear on screen
- Be specific about: camera movement, mood, lighting, subject, composition
- Think cinematic B-roll, Ken Burns-style photography, atmospheric footage
- The visual must emotionally reinforce the narration

CRITICAL — PHOTOREALISTIC ACCURACY AND CHARACTER CONSISTENCY:
- Every person mentioned MUST be described with their EXACT physical appearance: specific skin tone, facial features, hairstyle, body type, clothing, and signature look
- Every brand/logo MUST include exact colors, font style, logo shape, and design details
- Every location MUST include specific architectural details, signage, and atmosphere
- Do NOT use generic descriptions like "a man" or "a basketball player" — describe the EXACT person with unmistakable identifying features
- The viewer should be able to identify every person and brand INSTANTLY from the image alone
- Include the person's name naturally in the prompt (e.g. "Michael Jordan, bald head, dark brown skin, athletic build, wearing Bulls #23 jersey")

ABSOLUTE RULE — CHARACTER IDENTITY LOCK (THIS IS NON-NEGOTIABLE):
- The MAIN CHARACTER must look IDENTICAL in EVERY SINGLE scene from first to last
- Copy-paste the SAME physical description for the main character into every visual_prompt: same skin tone, same face shape, same hairstyle, same build, same clothing style
- NEVER change a character's race, skin tone, facial features, or body type between scenes
- If Scene 1 shows "a young Black man with short dreads, medium brown skin, lean build, wearing a black hoodie" then Scene 8 MUST also describe "a young Black man with short dreads, medium brown skin, lean build" — NOT "a man" or "a figure" or someone who looks different
- EVERY scene featuring a character must repeat their FULL physical description (skin tone + hair + build + clothing minimum)
- Think of it like a movie — the same actor plays the role in every scene. The appearance NEVER changes.
- Add a "characters" array to each scene listing which characters appear, so the system can enforce consistency

CRITICAL — VISUAL PROMPTS MUST BE PURE IMAGE DESCRIPTIONS:
- visual_prompt must ONLY describe what the camera sees — like a cinematographer's shot description
- NEVER include metadata, labels, stats, character sheets, or text overlays in visual_prompt
- NEVER include things like "Name: John", "Height: 6'2"", "Age: 35", "Role: protagonist" in visual_prompt
- NEVER include the word "prompt" or any meta-instructions in visual_prompt
- DO NOT list character attributes as bullet points or key-value pairs in visual_prompt
- The visual_prompt should read like a movie scene description, NOT a character profile
- WRONG: "John Smith, male, age 30, height 6 foot 2, muscular build, role: protagonist, wearing blue suit"
- RIGHT: "A tall muscular man in a tailored navy blue suit walks through a rain-soaked city street at night, neon signs reflecting off wet pavement, medium tracking shot, moody blue lighting"
${visualReferenceSheet ? `
VISUAL REFERENCE SHEET — USE THESE EXACT DESCRIPTIONS IN EVERY VISUAL PROMPT:
${visualReferenceSheet}

You MUST use the physical descriptions from the reference sheet above when writing visual_prompts. Copy key details directly into each prompt.` : ""}
${characterProfiles && characterProfiles.length > 0 ? `
USER-PROVIDED CHARACTER REFERENCES (these take priority over auto-generated descriptions):
${characterProfiles.map((cp: any) => `${(cp.role || "CHARACTER").toUpperCase()} - ${cp.name}: ${cp.appearance}${cp.clothing ? `, wearing ${cp.clothing}` : ""}`).join("\n")}
IMPORTANT: Use these user-provided character descriptions for EVERY visual_prompt that features these characters. Their appearance details are authoritative.` : ""}

${aestheticRules}

SCRIPT OUTPUT:
The target video duration is ${durationMinutes} minute(s) (${durationMinutes * 60} seconds total).
Generate approximately ${"SCENE_COUNT_PLACEHOLDER"} scenes to fill this duration.
Each scene MUST have 12-18 seconds of dense narration (approx. 3-5 sentences). 
Screenwriting rule: 1 page = 1 minute. Write thick, detailed dialogue paragraphs so the scenes are substantial!

Each scene must have:
- narration: The voiceover text (cinematic, immersive, emotionally engaging, 3-5 sentences long!)
- visual_prompt: Detailed AI image generation prompt describing the exact visual moment (camera angle, lighting, mood, subject). MUST include the FULL physical description of any character who appears.
- duration_estimate_seconds: Duration based on narration length (typically 12-18 seconds per scene)
- characters: Array of character names that appear in this scene

The JSON response must also include a top-level "character_identities" object mapping each character name to their LOCKED physical description. Example:
"character_identities": {
  "Marcus": "young Black man, dark brown skin, short dreadlocks, lean athletic build, angular jawline, brown eyes, wearing black hoodie and jeans",
  "Detective Garcia": "Latina woman, olive skin, shoulder-length dark hair pulled back, mid-40s, sharp features, wearing gray blazer"
}
This identity string MUST be embedded verbatim in EVERY visual_prompt where that character appears. No exceptions.

QUALITY CHECK BEFORE RESPONDING:
- Does the HOOK make you stop scrolling? (If not, rewrite scene 1)
- Does the story have real emotional stakes — can you FEEL something?
- Is there genuine tension, escalation, and progression — not just a list of facts?
- Does it feel like a Netflix documentary, not a Wikipedia article or school report?
- Are camera angles varied? (No 3 consecutive scenes with same angle)
- Does the emotional tempo shift — tense, then quiet, then explosive?
- Is every scene visually distinct? Can you picture each one as a unique, striking image?
- Would this realistically get millions of views?
- Does the FINAL LINE leave a lasting impression — a mic-drop moment?

Format your response as a JSON object with:
{
  "title": "Compelling, clickable video title",
  "angle": "The narrative angle/hook",
  "character_identities": {
    "Character Name": "LOCKED physical description: skin tone, face shape, hair, build, clothing — this exact string appears in every visual_prompt featuring this character"
  },
  "scenes": [
    {
      "narration": "The voiceover text — cinematic, emotionally engaging, tells the story. MUST be 3-5 sentences long to fill 12-18 seconds of screen time.",
      "visual_prompt": "MUST START with the character's full physical description from character_identities, then camera angle, action, setting, lighting, mood, color palette",
      "duration_estimate_seconds": 15,
      "camera_angle": "e.g. wide establishing, close-up, tracking shot, aerial, low angle, over-the-shoulder",
      "lighting": "e.g. golden hour, harsh fluorescent, neon-lit, candlelight, overcast",
      "mood": "e.g. tense, hopeful, chaotic, melancholic, triumphant",
      "characters": ["Character Name"]
    }
  ]
}

CRITICAL JSON RULES:
- Return ONLY raw JSON. No markdown, no code blocks, no backticks, no explanations.
- All strings must be valid JSON — escape double quotes with backslash (\\").
- For heights, use feet-inches format without quote marks (e.g. "6 foot 6" not "6'6\\"").
- Do NOT wrap the response in \`\`\`json or \`\`\` code blocks.
${"CONTINUATION_PLACEHOLDER"}
`;

    // STEP 3: Generate the script — chunked for long durations
    // Adjusted math: 15 seconds per scene means ~4 scenes per minute
    const totalScenesTarget = Math.ceil(durationMinutes * 60 / 15);
    const CHUNK_SIZE = 25; // max scenes per AI call — keeps response reliable

    if (continueFrom || endStory) {
      // Continuation/ending modes — single shot, small output
      const continuationNote = endStory
        ? `\nENDING MODE: You are writing the FINAL scene to conclude this story. The previous scenes ended with:\n"${continueFrom}"\nWrite a powerful, memorable conclusion. Generate only 1-2 scenes. Keep title: "${existingTitle || "Untitled"}"\n`
        : `\nCONTINUATION MODE: Continuing an existing script. Previous scenes ended with:\n"${continueFrom}"\nContinue naturally. Keep title: "${existingTitle || "Untitled"}"\n`;
      const singlePrompt = prompt
        .replace("SCENE_COUNT_PLACEHOLDER", String(Math.min(totalScenesTarget, CHUNK_SIZE)))
        .replace("CONTINUATION_PLACEHOLDER", continuationNote);
      console.log("Generating continuation/ending...");
      const responseText = await generateGeminiText(singlePrompt);
      return parseAndReturnScript(responseText);
    }

    if (totalScenesTarget <= CHUNK_SIZE) {
      // Short video — single generation call
      const singlePrompt = prompt
        .replace("SCENE_COUNT_PLACEHOLDER", String(totalScenesTarget))
        .replace("CONTINUATION_PLACEHOLDER", "");
      console.log(`Generating script (${totalScenesTarget} scenes, single call)...`);
      const responseText = await generateGeminiText(singlePrompt);
      return parseAndReturnScript(responseText);
    }

    // ========== CHUNKED GENERATION for long videos ==========
    console.log(`Long video: ${totalScenesTarget} scenes total, generating in chunks of ${CHUNK_SIZE}...`);
    const totalChunks = Math.ceil(totalScenesTarget / CHUNK_SIZE);
    let allScenes: any[] = [];
    let title = "";
    let angleResult = "";

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const scenesRemaining = totalScenesTarget - allScenes.length;
      const scenesThisChunk = Math.min(CHUNK_SIZE, scenesRemaining);
      const isFirstChunk = chunk === 0;
      const isLastChunk = chunk === totalChunks - 1;

      let chunkNote = "";
      if (!isFirstChunk) {
        // Summarize previous scenes for continuity context
        const lastFewScenes = allScenes.slice(-3);
        const prevSummary = lastFewScenes.map(s => s.narration).join(" ... ");
        chunkNote = `
CONTINUATION — CHAPTER ${chunk + 1} of ${totalChunks}:
You are writing scenes ${allScenes.length + 1}-${allScenes.length + scenesThisChunk} of a ${totalScenesTarget}-scene script.
The story so far ended with: "${prevSummary.substring(0, 500)}"
Continue the story seamlessly. Do NOT repeat the hook or introduction.
Keep the same title: "${title}"
${isLastChunk ? "This is the FINAL chapter — build to a powerful, memorable conclusion." : "Build tension and progress the narrative forward."}
`;
      } else {
        chunkNote = `
This is chapter 1 of ${totalChunks} (scenes 1-${scenesThisChunk} of ${totalScenesTarget} total).
Write a gripping opening that hooks viewers immediately. Set up the story arc that will unfold across all chapters.
`;
      }

      const chunkPrompt = prompt
        .replace("SCENE_COUNT_PLACEHOLDER", String(scenesThisChunk))
        .replace("CONTINUATION_PLACEHOLDER", chunkNote);

      console.log(`Generating chunk ${chunk + 1}/${totalChunks} (${scenesThisChunk} scenes)...`);
      const responseText = await generateGeminiText(chunkPrompt);
      const chunkData = parseScriptData(responseText);

      if (isFirstChunk) {
        title = chunkData.title || "Untitled";
        angleResult = chunkData.angle || angle;
      }

      // Re-number scenes to be sequential across chunks
      const offset = allScenes.length;
      for (const scene of chunkData.scenes) {
        scene.id = offset + scene.id;
        scene.scene_number = offset + scene.scene_number;
      }

      allScenes = allScenes.concat(chunkData.scenes);
      console.log(`Chunk ${chunk + 1} done: ${chunkData.scenes.length} scenes (${allScenes.length}/${totalScenesTarget} total)`);
    }

    return NextResponse.json({ title, angle: angleResult, scenes: allScenes });
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
