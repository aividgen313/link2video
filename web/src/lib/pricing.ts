// Costs based on Runware API pricing research
// Video: Cost per second of generated video
// Image: Cost per generated image
// Audio: Cost per character (approx 15 chars/sec formula used later, or straight $ per sec)

export const RUNWARE_PRICING = {
  // --- VIDEO MODELS (Price per second of video) ---
  // Premium Tier
  "klingai:video-3-0-pro": 0.08, // ~$4.80 per minute
  
  // Medium Tier
  "klingai:video-3-0-standard": 0.012, // ~$0.72 per minute
  "klingai:5@3": 0.01, // ~$0.60 per minute

  // Basic/Budget Tier
  "lightricks:ltx-2.3": 0.005, // ~$0.30 per minute
  "lightricks:ltx-2.3-fast": 0.003, // ~$0.18 per minute

  // --- IMAGE MODELS (Price per single image) ---
  // Premium
  "alibaba:qwen-image-2-0": 0.005,
  // Medium
  "runware:101@1": 0.002, // FLUX.1 Dev
  // Basic
  "bytedance:seedream-5-0-lite": 0.001,

  // --- AUDIO MODELS (Estimated price per second of audio for simplicity) ---
  // ElevenLabs is typically ~$0.00015 per char. ~15 chars per sec = ~$0.00225/sec
  "elevenlabs:1@1": 0.00225,
  "google:tts-1": 0.0005, 
};

// Helper function to calculate cost securely
export function calculateModelCost(
  modelId: string, 
  type: "video" | "image" | "audio", 
  durationSeconds: number = 0
): number {
  const basePrice = RUNWARE_PRICING[modelId as keyof typeof RUNWARE_PRICING] || 0;
  
  if (type === "image") {
    return basePrice; // Flat rate per image
  }
  
  // Video and Audio are calculated per second 
  return basePrice * durationSeconds;
}
