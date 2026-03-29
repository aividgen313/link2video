import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { generateGeminiText, sanitizeForContentFilter } from "@/lib/gemini";
import { 
  extractJsonFromText, 
  parseAIResponse,
  repairJson,
  sanitizeJsonString, 
  tryCompleteJson 
} from "@/lib/jsonUtils";

// Script generation can take many minutes for large scene counts
export const maxDuration = 900; // 15 minutes to support long (20min) video generation

function parseScriptData(responseText: string): any {
  console.log("Raw AI response (first 500 chars):", responseText.substring(0, 500));
  console.log("Raw AI response length:", responseText.length);

  try {
    return parseAIResponse(
      responseText,
      (parsed: any) => {
        // Validation: Is it a script container, a scenes array, or a single scene?
        return !!(
          (parsed && parsed.scenes && Array.isArray(parsed.scenes)) ||
          (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].narration || parsed[0].visual_prompt)) ||
          (parsed && (parsed.narration || parsed.visual_prompt))
        );
      },
      (validObjects: any[]) => {
        let title = "Untitled";
        let angle = "General";
        let character_identities = {};
        const collectedScenes: any[] = [];

        for (const obj of validObjects) {
          if (obj.scenes && Array.isArray(obj.scenes)) {
            if (title === "Untitled") title = obj.title || title;
            if (angle === "General") angle = obj.angle || angle;
            if (Object.keys(character_identities).length === 0) character_identities = obj.character_identities || character_identities;
            collectedScenes.push(...obj.scenes);
          } else if (Array.isArray(obj)) {
            collectedScenes.push(...obj);
          } else {
            collectedScenes.push(obj);
          }
        }

        return {
          title,
          angle,
          character_identities,
          scenes: collectedScenes.map((scene: any, index: number) => ({
            ...scene,
            id: scene.id ?? index + 1,
            scene_number: scene.scene_number ?? index + 1,
            duration_estimate_seconds: Math.min(scene.duration_estimate_seconds || 7, 12),
          }))
        };
      }
    );
  } catch (err) {
    // Final desperate fallback if nothing collected from blocks: search for "scenes": [ in the raw text
    console.warn("parseAIResponse failed. Attempting desperate raw extraction...");
    const cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const scenesMatch = cleanText.match(/"scenes"\s*:\s*\[/);
    if (scenesMatch && scenesMatch.index !== undefined) {
      const fromScenes = cleanText.substring(scenesMatch.index + '"scenes":'.length);
      const blocksAfter = extractJsonFromText(fromScenes.replace(/^\s*/, ''));
      if (blocksAfter.length > 0) {
        try {
          const arr = JSON.parse(tryCompleteJson(repairJson(blocksAfter[0])));
          if (Array.isArray(arr) && arr.length > 0) {
            console.log(`Desperate fallback extracted ${arr.length} scenes`);
            return {
              title: "Untitled",
              angle: "General",
              character_identities: {},
              scenes: arr.map((scene: any, index: number) => ({
                ...scene,
                id: scene.id ?? index + 1,
                scene_number: scene.scene_number ?? index + 1,
                duration_estimate_seconds: Math.min(scene.duration_estimate_seconds || 7, 12),
              }))
            };
          }
        } catch { /* fail */ }
      }
    }
    throw err;
  }
}

/**
 * Generate script with retry + prompt sanitization. Used for all single-call modes.
 * Retries up to 2 times: first with original prompt, then with sanitized prompt.
 */
async function generateScriptWithRetry(prompt: string): Promise<NextResponse> {
  const MAX_RETRIES = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const promptToUse = attempt >= MAX_RETRIES
        ? sanitizeForContentFilter(prompt)
        : prompt;

      if (attempt > 0) {
        console.log(`Script generation retry ${attempt}/${MAX_RETRIES}${attempt >= MAX_RETRIES ? " (sanitized)" : ""}...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      const responseText = await generateGeminiText(promptToUse);
      return NextResponse.json(parseScriptData(responseText));
    } catch (err: any) {
      lastError = err;
      console.warn(`Script generation attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  
  throw lastError;
}

export async function POST(req: NextRequest) {
  try {
    const { topic, url, angle, visualStyle = "Cinematic Documentary", durationMinutes = 3, continueFrom, endStory, existingTitle, mode, storyText, characterProfiles, lyrics, musicSegments, youtubeStyleSuffix, activeStyle, settingText, action, narration, visual_prompt, mood, directorMode } = await req.json();

    // ========== REWRITE NARRATION ACTION ==========
    if (action === "rewrite_narration" && narration) {
      console.log("Rewriting narration for visual prompt:", visual_prompt);
      const rewritePrompt = `Rewrite the following narration to be more engaging and fit a ${mood || "cinematic"} mood. 
Keep it roughly the same length. The narration accompanies this visual scene: "${visual_prompt || "N/A"}".

CURRENT NARRATION:
${narration}

Return ONLY the new narration text. Do not include any JSON, prefixes, or explanations.`;
      const responseText = await generateGeminiText(rewritePrompt);
      const newNarration = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return NextResponse.json({ narration: newNarration });
    }

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
        try {
          const parsed = parseAIResponse<any>(
            responseText,
            (p: any) => !!(p && p.subjects && Array.isArray(p.subjects))
          );
          return NextResponse.json(parsed);
        } catch {
          console.warn("Subject extraction parse failed, returning empty");
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
      try {
        const parsed = parseAIResponse<any>(
          responseText,
          (p: any) => !!(p && p.characters && Array.isArray(p.characters))
        );
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ characters: [] });
      }
    }

    let extractedText = "";
    if (mode === "notepad" && storyText) {
      // Wrap synthesis text to prevent the AI from interpreting treatment formatting as output instructions
      extractedText = `[BEGIN RESEARCH NOTES — use these facts as source material for the script]\n${storyText.substring(0, 12000)}\n[END RESEARCH NOTES]`;
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
          signal: AbortSignal.timeout(900000), // 15 min for long video scripting
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

    // For documentary/notepad modes, force photorealistic style unless user explicitly chose an artistic style
    const isArtisticStyle = ["Animated Storytime", "3D Render", "Anime", "Manga Panel", "Comic Book", "Graphic Novel", "Flat Vector", "Chibi Cartoon", "Pixel Art", "Retro Game", "Low Poly 3D", "Storybook Illustration", "Claymation", "Stop Motion", "Papercraft"].includes(visualStyle);
    const realisticEnforcement = !isArtisticStyle ? `\nABSOLUTE RULE: ALL visual_prompts MUST be PHOTOREALISTIC. NEVER use words like "illustration", "cartoon", "watercolor", "painting", "drawing", "sketch", "animated", "whimsical", "storybook" in visual_prompts. Every scene must look like a real photograph or cinematic film still. Think Netflix documentary B-roll, not children's book art.` : "";

    const aestheticRules = `CRITICAL AESTHETIC — ${visualStyle.toUpperCase()} STYLE:
- Every single visual_prompt MUST start by reinforcing the style: "In the style of ${visualStyle}, ...".
- The overall aesthetic is: ${styleDesc}.${activeStyleModifier}
- Consistency is non-negotiable. Every scene's visual_prompt MUST reflect this aesthetic perfectly.
- NEVER drift into standard photorealism if an artistic style is selected.
${suffixRule}${settingRules}${realisticEnforcement}`;

    // ========== DIRECTOR MODE (Dialogue-Heavy) ==========
    if (mode === "director") {
      console.log("Generating script in Director Mode...");
      const directorPrompt = `
You are a world-class film director and screenwriter. Your goal is to convert the following input into a character-driven, dialogue-heavy cinematic script.

INPUT:
${extractedText}

DIRECTOR MODE RULES:
- FOCUS ON DIALOGUE: At least 70% of the scenes should feature spoken dialogue between characters in the narration.
- DIALOGUE FORMAT: In the 'narration' field, use the format: CHARACTER NAME: "Spoken dialogue line."
- INTERNAL MONOLOGUE: Use [NAME] (V.O.): "Internal thoughts" for non-spoken narration.
- CHARACTER DYNAMICS: Focus on the tension, emotion, and relationship between characters.
- CINEMATIC SHOTS: Use sophisticated camera language (tracking, orbital, extreme close-up, Dutch angle).
- VISUAL SUBTEXT: The visual_prompt should show the character's emotion, reaction, or a meaningful object that complements the dialogue.

${aestheticRules}

INSTRUCTIONS:
- Break the story into ${Math.ceil(durationMinutes * 60 / 6)} scenes. Each scene should be 4-8 seconds.
- Scene 1 is a cold open — drop us into the middle of a conversation or a dramatic character moment.
- Every visual_prompt MUST describe a specific kinetic action — characters are never standing still.
- Ensure the character looks IDENTICAL in every scene by repeating their full physical description.

Format as JSON:
{
  "title": "A compelling film title",
  "angle": "The director's vision / theme",
  "character_identities": {
    "NAME": "LOCKED physical description: skin tone, hair, eyes, build, clothing style"
  },
  "scenes": [
    {
      "narration": "CHARACTER: \\"Dialogue line that tells the story.\\"",
      "visual_prompt": "In the style of ${visualStyle}, [SHOT TYPE] of [CHARACTER DESCRIPTION] [ACTING/MOVING] [SETTING] [LIGHTING]. Example: 'In the style of Wes Anderson, centered medium shot of ARTHUR, a man with a thin mustache and red bowtie, adjusted his glasses while looking skeptically at a map in a dusty library...'",
      "duration_estimate_seconds": 6,
      "camera_angle": "medium shot",
      "lighting": "moody",
      "mood": "tense",
      "characters": ["NAME"]
    }
  ]
}

Return ONLY raw JSON. No markdown.`;
      return await generateScriptWithRetry(directorPrompt);
    }

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

${directorMode ? `
DIRECTOR MODE: CINEMATIC AUTEUR
- Use unconventional camera angles and rhythmic cuts.
- ELIMINATE STATIC SHOTS: Every character must be walking, running, or in physical motion.
- High-motion camera work: orbital shots, low-angle tracking, Dutch tilts.
- Emphasize atmosphere and visual subtext.
- Use a bold, curated color palette.
- The tone should be sophisticated and evocative.
` : ""}

INSTRUCTIONS:
- Parse the story into a series of visual scenes following a clear dramatic arc: HOOK → Setup → Rising Tension → Climax → Resolution
- Scene 1 MUST be a cold open — drop viewers into the most dramatic or intriguing moment
- Each scene should be 3-6 seconds with 1 sentence of narration — like quick documentary cuts
- PACING IS CRITICAL: Think like a real documentary editor — fast cuts, every sentence gets a NEW visual
- SCENE DIVERSITY: For every 15 seconds of story, you MUST generate at least 3-4 distinct scenes with different visual_prompts.
- EVERY SCENE MUST BE IN MOTION: No characters standing still. Every scene must have physical action.
- The narration should be adapted from the story — rewrite as compelling cinematic voiceover (not word-for-word copy)
- Use active verbs in narration to drive the story forward
- Vary the emotional tempo: tense → reflective → explosive → quiet → revelation
- Include "breathing room" — not every scene should be high-intensity
- The final 2-3 scenes must build to a satisfying climax and memorable conclusion
- Target approximately ${Math.ceil(durationMinutes * 60 / 4)} scenes for a ${durationMinutes}-minute video (one scene per 4 seconds = fast-paced cuts like a real documentary)
${characterSheet}

VISUAL PROMPT RULES — MANDATORY SHOT VARIETY:
- EVERY SCENE MUST BE IN MOTION: No characters standing still. Every scene must have physical action (walking, reaching, turning, etc.).
- B-ROLL DIVERSITY: At least 30% of scenes must NOT feature the main subject — show environments, objects, or cinematic cutaways.
- NARRATIVE SYNCHRONIZATION: Every visual_prompt MUST be a direct visual representation of the specific action described in the narration for that scene.
- VISUAL NARRATIVE EVOLUTION: NEVER repeat the same camera angle, same pose, or same visual concept twice in a row.
- visual_prompt must be a PURE CINEMATIC DESCRIPTION — NEVER include metadata like "Name:", "Height:", "Age:", "Role:", character stats, or text overlays.
- Write visual_prompt like a movie shot description, NOT a character profile sheet.

ABSOLUTE RULE — CHARACTER IDENTITY LOCK (NON-NEGOTIABLE):
- The MAIN CHARACTER must look IDENTICAL in EVERY SINGLE scene — same skin tone, same face, same hair, same build
- COPY-PASTE the same physical description into every visual_prompt where a character appears
- NEVER change a character's race, skin tone, or physical features between scenes
- If Scene 1 has "a young Black woman with box braids, dark brown skin, athletic build" then EVERY later scene with that character MUST repeat that exact description
- Each visual_prompt MUST start with the style ("In the style of ${visualStyle}") followed by the character's full physical description before describing the specific scene action.
- Think of it like a movie — the same actor plays the role from beginning to end

${aestheticRules}

Format as JSON:
{
  "title": "Video title based on the story",
  "angle": "The narrative perspective",
  "character_identities": {
    "Character Name": "LOCKED physical description: skin tone, hair, eyes, build, clothing style"
  },
  "scenes": [
    {
      "narration": "1 sentence of punchy narration for this quick cut (3-6 seconds).",
      "visual_prompt": "MUST START with 'In the style of ${visualStyle}, [Shot Type] of [Kinetic Action], featuring [Character Description], [Lighting], [Mood], [Setting]'. Example: 'In the style of Cinematic Documentary, extreme close-up of hands trembling while holding an old letter, featuring a man with weathered skin and grey hair...'",
      "duration_estimate_seconds": 4,
      "camera_angle": "medium wide shot",
      "lighting": "warm afternoon light",
      "mood": "contemplative",
      "characters": ["Character Name"]
    }
  ]
}

CRITICAL JSON RULES:
- Return ONLY raw JSON. No markdown, no code blocks, no backticks.
- All strings must be valid JSON — escape double quotes with backslash.
`;

      return await generateScriptWithRetry(storyPrompt);
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

${directorMode ? `
DIRECTOR MODE: CINEMATIC AUTEUR
- Use rhythmic, dynamic cuts that match the beat.
- MAXIMUM DYNAMISM: Characters must be in high-energy motion (dancing, running, performance art).
- Unconventional, high-concept visual metaphors.
- Bold lighting and stylized color grading.
` : ""}

INSTRUCTIONS:
- Create visually striking, music-video-worthy scenes
- Match visual energy to the music structure:
  * Intro: atmospheric, establishing shots, mood setting
  * Verse: narrative, storytelling, character-focused
  * Chorus: high energy, dramatic visuals, wide shots, dynamic movement
  * Bridge: transition, ethereal, different mood/location
  * Outro: resolution, fade-out, emotional conclusion
- The "narration" field should contain the lyrics for that segment (these become subtitles, NOT voiceover)
- SCENE DIVERSITY: For long segments (> 6s), split them into multiple sequential scenes to provide visual variety. Each scene should be 3-5s.
- If a segment has no lyrics, set narration to a brief description for subtitle display
- Visual prompts should be cinematic and dynamic — think real music video production

VISUAL PROMPT RULES — MAXIMUM DYNAMISM:
- Music videos use HIGH-ENERGY dynamic camera work — dolly zooms, fast pans, handheld chaos, crane sweeps.
- VARY SHOTS: Alternate between artist performance, high-concept visual metaphors, and environmental B-roll.
- EVERY SCENE MUST HAVE MOTION: Dancing, running, performance, or atmospheric movements. No posing.
- B-ROLL DIVERSITY: Show abstract visuals, objects, or locations for at least 30% of the video to keep it cinematic.
- NARRATIVE SYNCHRONIZATION: The visual concept MUST directly reflect the emotional tone and context of the lyrics/narration for this specific scene.
- VISUAL NARRATIVE EVOLUTION: Every shot must feel like a new perspective. NEVER repeat a shot's framing or pose in consecutive scenes.
- visual_prompt must be a PURE CINEMATIC DESCRIPTION — NEVER include metadata like "Name:", "Height:", "Age:", character stats, or text overlays.
- Write visual_prompt like a movie director's shot description, NOT a character sheet.

ABSOLUTE RULE — ARTIST/CHARACTER IDENTITY LOCK (NON-NEGOTIABLE):
- The artist/main character must look IDENTICAL in EVERY SINGLE scene — same skin tone, same face, same hair, same build
- COPY-PASTE the same physical description into every visual_prompt where they appear
- NEVER change a character's race, skin tone, or physical features between scenes
- Every visual_prompt featuring a character MUST start with the style ("In the style of ${visualStyle}") followed by their full physical description
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
      "visual_prompt": "MUST START with 'In the style of ${visualStyle}, [Shot Type] of [High Energy Action], featuring [Artist Physical Description], [Setting], [Lighting], [Mood]'. Example: 'In the style of Anime, low angle tracking shot of the artist running through a neon-lit rainstorm, featuring a woman with blue hair and a silver jacket...'",
      "duration_estimate_seconds": 4,
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

      return await generateScriptWithRetry(musicPrompt);
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

    // COMPREHENSIVE STYLE SYSTEM
    const styleManual = `${aestheticRules}

UNIVERSAL WRITING RULES:
- Vary sentence length for rhythm and pacing — SHORT. Then longer, more reflective beats.
- Use short punchy lines during intense or dramatic moments
- Use longer sentences for storytelling and atmosphere
- Every 10-20 seconds must introduce new information, a question, or a twist
- NEVER use filler words or generic phrasing ("In a world where...", "Little did he know...", "But that's not all...")
- Use psychological triggers: curiosity, suspense, surprise, empathy, aspiration
- ALWAYS write in English unless the topic specifically involves other languages
- The narration must tell the ACTUAL STORY from the source material — stick to the REAL facts, events, and people
- Narration = storytelling voiceover. Visual_prompt = what the camera sees. Keep them separate.

CAMERA AND CINEMATIC LANGUAGE:
- Vary camera angles across scenes: wide establishing → medium → close-up → extreme close-up → aerial → tracking → POV
- NEVER use the same camera angle for 3+ consecutive scenes
- Use camera movement to match emotion: slow push-in for tension, pull-back for revelation, handheld for chaos, steady for authority
- Include specific shot descriptions: "low angle looking up", "over-the-shoulder", "bird's-eye view", "Dutch angle"

MANDATORY SHOT VARIETY — Rotate between these every 2-3 scenes:
1. ACTION: Subject actively moving/doing something.
2. ENVIRONMENT: Atmosphere only, no people.
3. DETAIL: Extreme close-up of object/texture.
4. CROWD: Groups in motion.
5. REACTION: Close-up of face showing emotion.
6. ARTISTIC: Montage, time-lapse, or abstract.

ABSOLUTE BANS — NEVER DO THESE:
- NEVER write "standing", "posing", "looking at camera", "staring", "facing forward", "standing in front of"
- NEVER have the main subject simply standing in a location doing nothing
- NEVER show the same subject in the same pose, setting, or composition twice
- NEVER have more than 3 consecutive scenes featuring the main subject — you MUST cut away to environment, objects, or other people
- NEVER describe a generic "portrait" — every scene must have MOTION, ACTION, or a specific visual story

B-ROLL DIVERSITY: At least 30% of scenes must NOT feature the main subject. Show environments, objects, or crowds instead.

VISUAL NARRATIVE EVOLUTION:
- Each scene's visual MUST feel like a meaningful progression from the previous one.
- NEVER repeat the same camera angle, same pose, or same visual concept for the same subject in two consecutive scenes.
- If Scene N is a close-up of the subject, Scene N+1 MUST be either a wide shot, a B-roll cutaway, or an action shot in a different setting.

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
- EVERY scene featuring a character must start with the style ("In the style of ${visualStyle}") followed by the SHOT TYPE and ACTION, then the character's FULL physical description (skin tone + hair + build + clothing minimum)
- Think of it like a movie — the same actor plays the role in every scene. The appearance NEVER changes.
- Add a "characters" array to each scene listing which characters appear, so the system can enforce consistency
- DYNAMIC ACTION RULE: Every prompt MUST lead with a kinetic action verb (e.g. "walking", "running", "grasping", "turning", "reaching", "shouting").
- NO POSED SHOTS: Never use "standing", "sitting", "looking at camera". Use active verbs that imply movement or mid-action.

CRITICAL — VISUAL PROMPTS MUST BE PURE IMAGE DESCRIPTIONS:
- visual_prompt must ONLY describe what the camera sees — like a cinematographer's shot description
- NEVER include metadata, labels, stats, character sheets, or text overlays in visual_prompt
- NEVER include things like "Name: John", "Height: 6'2"", "Age: 35", "Role: protagonist" in visual_prompt
- NEVER include the word "prompt" or any meta-instructions in visual_prompt
- DO NOT list character attributes as bullet points or key-value pairs in visual_prompt
- The visual_prompt should read like a movie scene description, NOT a character profile
- WRONG: "John Smith, male, age 30, height 6 foot 2, muscular build, role: protagonist, wearing blue suit"
- RIGHT: "A tall muscular man in a tailored navy blue suit walks through a rain-soaked city street at night, neon signs reflecting off wet pavement, medium tracking shot, moody blue lighting"
${visualReferenceSheet ? `VISUAL REFERENCE SHEET: ${visualReferenceSheet}` : ""}
${characterProfiles && characterProfiles.length > 0 ? `USER-PROVIDED CHARACTER REFERENCES: ${characterProfiles.map((cp: any) => `${cp.name}: ${cp.appearance}`).join(", ")}` : ""}
`;

    const prompt = `
You are an elite YouTube scriptwriter and viral content creator.
You specialize in creating HIGH-RETENTION scripts that keep viewers watching until the very last second.

Subject Matter: ${extractedText}
Angle: ${angle}

${directorMode ? `
DIRECTOR MODE: CINEMATIC AUTEUR
You are in "Director Mode". Your goal is to create a masterpiece of cinematic storytelling.
- ELIMINATE STATIC SHOTS: Characters must NEVER just stand there. They must be moving, acting, and in motion.
- Use unconventional camera angles. Include circular dollies and tracking shots.
` : ""}

${styleManual}

PACING AND NARRATIVE ARC:
- Scene 1 MUST be a cold open hook — drop the viewer into the most dramatic, surprising, or emotional moment FIRST.
- Follow a clear dramatic arc: Hook → Setup → Rising Tension → Climax → Resolution/Twist.
- The last 2-3 scenes must build to a climactic payoff or satisfying twist.

FORMAT:
Generate exactly SCENE_COUNT_PLACEHOLDER scenes for this chapter.
Return ONLY raw JSON with "title", "angle", "character_identities", and "scenes" array.
- Return ONLY raw JSON. No markdown, no code blocks, no backticks, no explanations.
- All strings must be valid JSON — escape double quotes with backslash (\\").
- For heights, use feet-inches format without quote marks (e.g. "6 foot 6" not "6'6\\"").
- Do NOT wrap the response in \`\`\`json or \`\`\` code blocks.
${"CONTINUATION_PLACEHOLDER"}
`;

    // STEP 3: Generate the script — chunked for long durations
    // Fast-paced cuts: ~5 seconds per scene = ~12 scenes per minute
    const totalScenesTarget = Math.ceil(durationMinutes * 60 / 5);
    const CHUNK_SIZE = 10; // Reduced to 10 for maximum reliability against model truncation

    if (continueFrom || endStory) {
      // Continuation/ending modes — single shot, small output
      const continuationNote = endStory
        ? `\nENDING MODE: You are writing the FINAL scene to conclude this story. The previous scenes ended with:\n"${continueFrom}"\nWrite a powerful, memorable conclusion. Generate only 1-2 scenes. Keep title: "${existingTitle || "Untitled"}"\n`
        : `\nCONTINUATION MODE: Continuing an existing script. Previous scenes ended with:\n"${continueFrom}"\nContinue naturally. Keep title: "${existingTitle || "Untitled"}"\n`;
      const singlePrompt = prompt
        .replace("SCENE_COUNT_PLACEHOLDER", String(Math.min(totalScenesTarget, CHUNK_SIZE)))
        .replace("CONTINUATION_PLACEHOLDER", continuationNote);
      console.log("Generating continuation/ending...");
      return await generateScriptWithRetry(singlePrompt);
    }

    if (totalScenesTarget <= CHUNK_SIZE) {
      // Short video — single generation call
      const singlePrompt = prompt
        .replace("SCENE_COUNT_PLACEHOLDER", String(totalScenesTarget))
        .replace("CONTINUATION_PLACEHOLDER", "");
      console.log(`Generating script (${totalScenesTarget} scenes, single call)...`);
      return await generateScriptWithRetry(singlePrompt);
    }

    // ========== CHUNKED GENERATION for long videos ==========
    console.log(`Long video: ${totalScenesTarget} scenes total, generating in chunks of ${CHUNK_SIZE}...`);
    const totalChunks = Math.ceil(totalScenesTarget / CHUNK_SIZE);
    let allScenes: any[] = [];
    let title = "";
    let angleResult = "";
    let characterIdentities = {};

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

      const chunkPrompt = isFirstChunk 
        ? prompt
            .replace("SCENE_COUNT_PLACEHOLDER", String(scenesThisChunk))
            .replace("CONTINUATION_PLACEHOLDER", chunkNote)
        : `
You are continuing the Link2Video script for chapter ${chunk + 1}.

Subject: ${extractedText.substring(0, 500)}...
Original Angle: ${angle}

${chunkNote}

SLIM CORE RULES:
- Return exactly ${scenesThisChunk} scenes in the JSON.
- Maintain character identity: ${JSON.stringify(characterIdentities)}
- Use the visual style: ${visualStyle}
- Cinematic Documentary mood, focus on kinetic action verbs.
- No static shots, no posing.
- Return ONLY raw JSON with a "scenes" array.
`;

      console.log(`Generating chunk ${chunk + 1}/${totalChunks} (${scenesThisChunk} scenes)...`);
      
      // Per-chunk retry with prompt sanitization on failure
      let chunkData: any = null;
      const MAX_CHUNK_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
        try {
          const promptToUse = attempt >= MAX_CHUNK_RETRIES 
            ? sanitizeForContentFilter(chunkPrompt) // Last attempt: sanitize for content filters
            : chunkPrompt;
          
          if (attempt > 0) {
            console.log(`Chunk ${chunk + 1} retry ${attempt}/${MAX_CHUNK_RETRIES}${attempt >= MAX_CHUNK_RETRIES ? " (sanitized)" : ""}...`);
            await new Promise(r => setTimeout(r, 2000)); // Brief pause between retries
          }
          
          const responseText = await generateGeminiText(promptToUse);
          chunkData = parseScriptData(responseText);
          break; // Success — exit retry loop
        } catch (retryErr: any) {
          console.warn(`Chunk ${chunk + 1} attempt ${attempt + 1} failed: ${retryErr.message}`);
          if (attempt >= MAX_CHUNK_RETRIES) {
            // All retries exhausted for this chunk
            console.error(`Chunk ${chunk + 1} failed after ${MAX_CHUNK_RETRIES + 1} attempts. Generating minimal fallback scenes.`);
            // Generate minimal placeholder scenes so the video can still complete
            const fallbacks = [
              "Cinematic wide shot of a vast landscape at golden hour, dramatic clouds, volumetric lighting, photorealistic 4k",
              "Close up of an open book on a wooden table, sunlight streaming through a window, dust motes dancing in the air, macro photography",
              "A bustling city street at night, neon lights reflecting on wet pavement, cinematic bokeh, 8k resolution",
              "Abstract cinematic shot of light and shadow playing across a textured wall, moody atmosphere, high contrast",
              "Aerial drone shot of ocean waves crashing against rugged cliffs, turquoise water, white foam, epic scale"
            ];
            const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            
            chunkData = {
              title: title || "Untitled",
              angle: angleResult || angle,
              character_identities: characterIdentities,
              scenes: Array.from({ length: Math.min(scenesThisChunk, 3) }, (_, i) => ({
                id: i + 1,
                scene_number: i + 1,
                narration: i === 0 
                  ? "The story continues, weaving through unexpected turns."
                  : i === 1
                    ? "Every chapter reveals new layers of complexity and depth."
                    : "And so the narrative unfolds, leading us to what comes next.",
                visual_prompt: randomFallback,
                duration_estimate_seconds: 5,
                mood: "contemplative",
              }))
            };
          }
        }
      }

      if (isFirstChunk) {
        title = chunkData.title || "Untitled";
        angleResult = chunkData.angle || angle;
        characterIdentities = chunkData.character_identities || {};
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

    return NextResponse.json({ title, angle: angleResult, character_identities: characterIdentities, scenes: allScenes });
  } catch (error: any) {
    console.error("Script generation error:", error);
    const msg = error.message || "";
    
    // Pass through specific error codes from Pollinations
    if (msg.includes("402")) {
      return NextResponse.json(
        { error: "Insufficient balance to generate script. Please top up your Pollinations credits." },
        { status: 402 }
      );
    }
    if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
      return NextResponse.json(
        { error: "AI service is temporarily overloaded. Please try again in a few seconds." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg || "Failed to generate script" }, { status: 500 });
  }
}
