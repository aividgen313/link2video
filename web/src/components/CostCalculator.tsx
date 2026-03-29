import React from "react";
import { QUALITY_TIERS, calculateTotalCost, QualityTier } from "@/context/AppContext";

interface CostCalculatorProps {
  currentTier: QualityTier;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({ currentTier }) => {
  const tier = QUALITY_TIERS[currentTier];
  
  // Estimates based on ~8s per scene (7.5 scenes per minute)
  const durations = [1, 2, 3, 4];
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {durations.map(min => {
          const scenes = Math.ceil(min * 60 / 8);
          const cost = calculateTotalCost(currentTier, scenes, false).toFixed(2);
          return (
            <div key={min} className="glass p-2 rounded-xl text-center border border-outline/10">
              <p className="text-[10px] text-outline font-black uppercase tracking-wider">{min} Min</p>
              <p className="text-sm font-headline font-black text-on-surface">${cost}</p>
            </div>
          );
        })}
      </div>
      
      <div className="glass-subtle p-3 rounded-xl border border-outline/5 space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">API Rates ({tier.label})</h4>
        <div className="grid grid-cols-3 gap-2 text-[11px] font-bold text-outline">
          <div className="flex flex-col">
            <span className="opacity-60 text-[9px]">Image Scene</span>
            <span className="text-on-surface">${tier.pollenPerImageScene}</span>
          </div>
          <div className="flex flex-col">
            <span className="opacity-60 text-[9px]">Video Scene</span>
            <span className="text-on-surface">${tier.pollenPerVideoScene}</span>
          </div>
          <div className="flex flex-col">
            <span className="opacity-60 text-[9px]">TTS / Narr.</span>
            <span className="text-on-surface">${tier.pollenPerTTS === 0 ? "FREE" : `$${tier.pollenPerTTS}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
