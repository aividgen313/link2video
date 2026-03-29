"use client";
import { useState } from "react";
import { recoverOrphanedProjects, VideoHistoryItem } from "@/lib/videoHistory";

interface DeepRecoveryToolProps {
  onRecovered?: (items: VideoHistoryItem[]) => void;
}

export function DeepRecoveryTool({ onRecovered }: DeepRecoveryToolProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{ count: number; items: VideoHistoryItem[] } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResult(null);
    try {
      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 1200));
      const recovered = await recoverOrphanedProjects();
      const currentCount = Number(localStorage.getItem("link2video_history_count") || "0");
      const newItems = recovered.filter((_, idx) => idx < recovered.length - currentCount);
      
      setResult({ count: newItems.length, items: newItems });
      if (onRecovered) onRecovered(recovered);
    } catch (err) {
      console.error("Recovery failed", err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 border border-primary/20 bg-primary/5 shadow-xl shadow-primary/5 max-w-lg mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <span className={`material-symbols-outlined text-primary text-2xl ${isScanning ? 'animate-spin' : ''}`}>
            {isScanning ? 'sync' : 'database_search'}
          </span>
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-headline font-black text-lg text-on-surface tracking-tight">Deep Project Recovery</h3>
          <p className="text-xs text-outline leading-relaxed">
            Can't find a project (like <strong>SCP-1733</strong>)? It might still be in your browser's persistent storage. This tool scans IndexedDB for orphaned project data and restores it to your history.
          </p>
          
          {result ? (
            <div className="pt-2 animate-in zoom-in-95 duration-300">
              {result.count > 0 ? (
                <div className="flex items-center gap-2 text-green-500 font-bold text-xs bg-green-500/10 px-3 py-2 rounded-xl border border-green-500/20">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Found and restored {result.count} project(s)! Refresh to see them.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-outline font-bold text-xs bg-surface-variant/30 px-3 py-2 rounded-xl border border-outline/10">
                  <span className="material-symbols-outlined text-sm">info</span>
                  No new orphaned projects found in storage.
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">search_check</span>
              {isScanning ? 'Scanning Browser Storage...' : 'Scan for Missing Projects'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
