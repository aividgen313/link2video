import React from "react";
import { QUALITY_TIERS, calculateTotalCost, QualityTier, useAppContext } from "@/context/AppContext";

interface CostCalculatorProps {
  currentTier: QualityTier;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({ currentTier }) => {
  const { targetDurationMinutes, setTargetDurationMinutes, scriptData } = useAppContext();
  const tier = QUALITY_TIERS[currentTier];
  
  // Refined range based on user feedback
  const durations = [1, 3, 5, 10, 12, 15];

  // Calculate current project breakdown if script exists
  const scenesCount = scriptData?.scenes.length || Math.ceil(targetDurationMinutes * 60 / 8);
  
  let videoSceneCount = 0;
  if (tier.useAIVideo) {
    if (tier.videoSceneStrategy === "all") {
      videoSceneCount = scenesCount;
    } else if (tier.videoSceneStrategy === "alternating") {
      const groupSize = (tier as any).alternatingGroupSize || 3;
      for (let i = 0; i < scenesCount; i++) {
        if (Math.floor(i / groupSize) % 2 === 0) videoSceneCount++;
      }
    }
  }

  const imageCost = (scenesCount * tier.pollenPerImageScene).toFixed(4);
  const videoCost = (videoSceneCount * tier.pollenPerVideoScene).toFixed(2);
  const ttsCost = (scenesCount * tier.pollenPerTTS).toFixed(3);
  const total = calculateTotalCost(currentTier, scenesCount).toFixed(2);
  
  return (
    <div className="space-y-6">
      {/* Duration Selector */}
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-outline/60 ml-1">Target Duration</label>
        <div className="grid grid-cols-3 gap-2">
          {durations.map(min => {
            const isActive = targetDurationMinutes === min;
            const cost = calculateTotalCost(currentTier, Math.ceil(min * 60 / 8), false).toFixed(2);
            
            return (
              <button 
                key={min} 
                onClick={() => setTargetDurationMinutes(min)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 group ${
                  isActive 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "glass-subtle border-white/5 text-outline hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <p className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1.5 ${isActive ? "text-white/70" : "text-outline/40 group-hover:text-primary/60"}`}>
                  {min} Min
                </p>
                <p className={`text-[13px] font-headline font-black ${isActive ? "text-white" : "text-on-surface"}`}>
                  ${cost}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Rate Breakdown */}
      <div className="glass-card p-5 rounded-3xl border border-white/5 space-y-4 bg-black/10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">API Model Estimates</h4>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{tier.label}</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-[11px]">
            <div className="flex flex-col">
              <span className="text-on-surface font-bold">Visuals (Flux.1 / LTX-2)</span>
              <span className="text-outline/50 text-[9px] font-medium">High-fidelity scene generation</span>
            </div>
            <span className="text-on-surface font-black">${tier.pollenPerImageScene}/img</span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <div className="flex flex-col">
              <span className="text-on-surface font-bold">Video (Wan AI / SVD)</span>
              <span className="text-outline/50 text-[9px] font-medium">Cinematic motion synthesis</span>
            </div>
            <span className="text-on-surface font-black">$0.05/sec</span>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <div className="flex flex-col">
              <span className="text-on-surface font-bold">Audio (ElevenLabs / Edge)</span>
              <span className="text-outline/50 text-[9px] font-medium">Professional TTS narration</span>
            </div>
            <span className="text-on-surface font-black">{tier.pollenPerTTS === 0 ? "FREE" : `$${tier.pollenPerTTS}/scene`}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-wider text-outline/40">
            <span>Project Math ({scenesCount} scenes)</span>
            <span className="material-symbols-outlined text-sm">calculate</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-outline">Images ({scenesCount})</span>
              <span className="text-on-surface font-mono">${imageCost}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-outline">AI Video ({videoSceneCount})</span>
              <span className="text-on-surface font-mono">${videoCost}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-outline">TTS Narration</span>
              <span className="text-on-surface font-mono">${ttsCost}</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
              <span className="text-primary font-black uppercase tracking-widest text-[10px]">Total Est.</span>
              <span className="text-primary font-black text-lg">${total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
