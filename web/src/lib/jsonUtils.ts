/**
 * Robust JSON extraction and repair utilities for AI-generated responses.
 * These helpers handle conversational text, markdown fences, and common AI formatting errors.
 */

/**
 * Repairs common JSON formatting issues produced by AI models.
 */
export function repairJson(str: string): string {
  // Fix Feet/Inches shorthand that breaks JSON (e.g. 6'2")
  let repaired = str.replace(/(\d+)'(\d+)"/g, '$1 foot $2');
  repaired = repaired.replace(/(\d+)'(\d+)\\"/g, '$1 foot $2');
  return repaired;
}

/**
 * Attempts to complete a truncated JSON string by balancing opening/closing brackets.
 */
export function tryCompleteJson(str: string): string {
  let s = str.trim();
  let stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '}') stack.pop();
    } else if (ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ']') stack.pop();
    }
  }
  if (inString) s += '"';
  while (stack.length > 0) {
    s += stack.pop();
  }
  return s;
}

/**
 * Extracts potential JSON blocks from string. 
 * Handles markdown fences and multiple potential blocks via balanced bracket counting.
 */
export function extractJsonFromText(text: string): string[] {
  const blocks: string[] = [];
  
  // 1. Try markdown blocks first
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  if (blocks.length > 0) return blocks;

  // 2. Balanced bracket extraction for raw blocks
  let stack: string[] = [];
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (char === '{' || char === '[') {
      if (stack.length === 0) startIdx = i;
      stack.push(char);
    } else if (char === '}' || char === ']') {
      if (stack.length > 0) {
        const last = stack.pop();
        if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
          if (stack.length === 0) {
            blocks.push(text.substring(startIdx, i + 1));
          }
        } else if (stack.length === 0) {
          startIdx = -1; 
        }
      }
    }
  }

  // Handle case where we find nothing but have a start point (try to recover)
  if (blocks.length === 0 && startIdx !== -1) {
    blocks.push(text.substring(startIdx).trim());
  }

  return blocks.length > 0 ? blocks : [text];
}

/**
 * Sanitizes JSON strings by escaping control characters and literal newlines.
 */
export function sanitizeJsonString(str: string): string {
  let result = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (esc) { esc = false; result += ch; continue; }
    if (ch === '\\') { esc = true; result += ch; continue; }
    if (ch === '"') { inStr = !inStr; result += ch; continue; }
    if (inStr) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      if (code < 32) { result += `\\u${code.toString(16).padStart(4, '0')}`; continue; }
    }
    result += ch;
  }
  return result;
}

/**
 * Strips untagged reasoning preambles that DeepSeek and similar models
 * often produce BEFORE the actual JSON output.
 * These are lines of natural language reasoning not wrapped in <think> tags.
 * Strategy: find the first `{` or `[` that starts a line (possibly with whitespace),
 * and discard everything before it.
 */
export function stripReasoningPreamble(text: string): string {
  // If text already starts with { or [, no preamble
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')) return trimmed;
  
  // Look for the first line that starts with { or [ (the JSON body)
  const jsonStartMatch = trimmed.match(/^\s*[{[]/m);
  if (jsonStartMatch && jsonStartMatch.index !== undefined && jsonStartMatch.index > 0) {
    const stripped = trimmed.substring(jsonStartMatch.index).trim();
    // Only strip if we removed a meaningful amount (>50 chars of reasoning)
    if (jsonStartMatch.index > 50) {
      console.log(`[jsonUtils] Stripped ${jsonStartMatch.index} chars of reasoning preamble`);
    }
    return stripped;
  }
  
  return trimmed;
}

/**
 * Deep-searches for JSON containing known structural keys.
 * Works when the JSON is deeply buried or when balanced-bracket extraction
 * fails due to the overall text structure being too messy.
 * 
 * @param text The raw text to search
 * @param targetKeys Keys that indicate the JSON we want (e.g. ["scenes", "narration"])
 */
export function extractJsonByKeySearch(text: string, targetKeys: string[] = ["scenes", "narration", "visual_prompt"]): string[] {
  const results: string[] = [];
  
  for (const key of targetKeys) {
    const pattern = new RegExp(`"${key}"\\s*:\\s*[\\[{]`, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Walk backwards from match to find the containing `{`
      let depth = 0;
      let objStart = match.index;
      for (let i = match.index - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '}' || ch === ']') depth++;
        else if (ch === '{' || ch === '[') {
          if (depth === 0) { objStart = i; break; }
          depth--;
        }
      }
      
      // Now walk forward from objStart to find balanced close
      let stack: string[] = [];
      let inString = false;
      let escape = false;
      for (let i = objStart; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
            if (stack.length === 0) {
              const candidate = text.substring(objStart, i + 1);
              if (!results.includes(candidate)) results.push(candidate);
              break;
            }
          }
        }
      }
      
      // If unbalanced, try to complete it
      if (stack.length > 0) {
        const candidate = text.substring(objStart);
        if (!results.includes(candidate)) results.push(candidate);
      }
    }
    if (results.length > 0) break; // Found something with this key, stop
  }
  
  return results;
}

/**
 * A highly resilient, application-wide utility to parse and repair AI-generated JSON.
 * It handles the following:
 * 1. Thinking tag removal (<think>...</think>) AND untagged reasoning preambles
 * 2. Multi-block extraction (handles conversational text surrounding JSON)
 * 3. Key-based deep search as fallback (finds JSON by structural keys like "scenes")
 * 4. Multiple repair attempts (bracket balancing, trailing commas, height formatting)
 * 5. Cross-block aggregation (stitching together fragments if needed)
 * 
 * @param responseText The raw text from the AI model
 * @param validator A function to determine if a parsed object is "what we want"
 * @param aggregator Optional function to merge multiple valid blocks into one (useful for scenes/scripts)
 */
export function parseAIResponse<T>(
  responseText: string, 
  validator: (parsed: any) => boolean,
  aggregator?: (allParsed: any[]) => T
): T {
  // Phase 1: Strip all known wrapper formats
  let cleanText = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleanText = stripReasoningPreamble(cleanText);

  const validObjects: any[] = [];
  let lastError: string = "";

  const tryParseBlocks = (blocks: string[]) => {
    for (const rawBlock of blocks) {
      let jsonStr = sanitizeJsonString(rawBlock);
      
      const repairAttempts = [
        (s: string) => repairJson(s),
        (s: string) => tryCompleteJson(repairJson(s)),
        (s: string) => tryCompleteJson(repairJson(s).replace(/,\s*([\]}])/g, '$1'))
      ];

      for (const attempt of repairAttempts) {
        try {
          const parsed = JSON.parse(attempt(jsonStr));
          if (validator(parsed)) {
            validObjects.push(parsed);
            break;
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }
    }
  };

  // Phase 2: Standard extraction (markdown fences + balanced brackets)
  tryParseBlocks(extractJsonFromText(cleanText));

  // Phase 3: If standard extraction failed, try key-based deep search
  if (validObjects.length === 0) {
    console.log('[jsonUtils] Standard extraction failed, trying key-based deep search...');
    const keyBlocks = extractJsonByKeySearch(cleanText);
    if (keyBlocks.length > 0) {
      tryParseBlocks(keyBlocks);
    }
  }

  // Phase 4: If STILL nothing, try on the ORIGINAL text (preamble stripping might have been aggressive)
  if (validObjects.length === 0 && cleanText !== responseText) {
    console.log('[jsonUtils] Key search failed, retrying on raw response...');
    const rawBlocks = extractJsonByKeySearch(responseText, ["scenes", "narration", "title"]);
    if (rawBlocks.length > 0) {
      tryParseBlocks(rawBlocks);
    }
  }

  if (validObjects.length === 0) {
    throw new Error(`Failed to parse AI response. ${lastError || "No valid JSON blocks found."}`);
  }

  if (aggregator) {
    return aggregator(validObjects);
  }

  return validObjects[0] as T;
}
