import React from "react";
import { useAppContext } from "@/context/AppContext";

export const PollensBalanceWidget: React.FC = () => {
  const { pollenBalance, pollenTier, pollenResetAt, isFetchingBalance, hasMounted } = useAppContext();

  if (!hasMounted) return null;

  if (isFetchingBalance) {
    return (
      <div className="shrink-0 animate-fade-in-up">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-outline/5 shadow-sm">
          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Syncing...</span>
        </div>
      </div>
    );
  }

  if (pollenBalance === null) return null;

  const isLow = pollenBalance <= 0;

  return (
    <div className="shrink-0 animate-fade-in-up">
      <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all shadow-sm ${!isLow ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5" : "bg-red-500/5 border-red-500/20 shadow-red-500/5"}`}>
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${!isLow ? "text-emerald-400" : "text-red-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {!isLow ? "eco" : "warning"}
          </span>
          <div className="flex flex-col">
            <span className={`text-sm font-black font-headline tabular-nums leading-none mb-0.5 ${!isLow ? "text-emerald-400" : "text-red-400"}`}>
              {pollenBalance.toFixed(4)} <span className="text-[9px] font-bold uppercase opacity-60 ml-0.5">pollen</span>
            </span>
            <div className="flex items-center gap-1.5 leading-none">
              {pollenTier && (
                <span className="text-[9px] uppercase font-black tracking-widest text-outline/50">
                  {pollenTier}
                </span>
              )}
              {pollenResetAt && (
                <span className="text-[9px] text-outline/30 font-bold">
                  · resets {new Date(pollenResetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
        {isLow && (
          <a
            href="https://pollinations.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-black text-primary hover:text-primary/70 transition-colors uppercase tracking-wider pl-2 border-l border-outline/10 h-6 flex items-center"
          >
            Refill →
          </a>
        )}
      </div>
    </div>
  );
};
