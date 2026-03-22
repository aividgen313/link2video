"use client";
import { useState, useRef } from "react";
import { useEditorContext } from "@/context/EditorContext";

interface Props {
  totalWidth: number;
}

export default function MusicTrack({ totalWidth }: Props) {
  const { musicTrack, setMusicTrack } = useEditorContext();
  const [isGenerating, setIsGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "cinematic background music for a documentary video", duration: 120 }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setMusicTrack({ url: data.audioUrl, name: "Generated Music", duration: 120, volume: 0.15 });
      }
    } catch (err) {
      console.error("Music generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const audio = new Audio(reader.result as string);
      audio.onloadedmetadata = () => {
        setMusicTrack({
          url: reader.result as string,
          name: file.name,
          duration: audio.duration,
          volume: 0.15,
        });
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-10 flex items-center gap-2 px-2 border-t border-outline-variant/10">
      <span className="material-symbols-outlined text-sm text-outline/50">music_note</span>

      {musicTrack ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Music bar visualization */}
          <div
            className="h-5 bg-tertiary/20 border border-tertiary/30 rounded flex items-center px-2 relative overflow-hidden"
            style={{ width: Math.min(totalWidth, 600) }}
          >
            <span className="text-[9px] text-tertiary truncate">{musicTrack.name}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-tertiary/10 to-transparent pointer-events-none" />
          </div>

          {/* Volume */}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(musicTrack.volume * 100)}
            onChange={e => setMusicTrack({ ...musicTrack, volume: Number(e.target.value) / 100 })}
            className="w-16 h-0.5 accent-tertiary"
            title={`Volume: ${Math.round(musicTrack.volume * 100)}%`}
          />
          <span className="text-[8px] text-outline/40 w-6">{Math.round(musicTrack.volume * 100)}%</span>

          {/* Remove */}
          <button onClick={() => setMusicTrack(null)} className="text-outline/40 hover:text-red-400">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="text-[10px] text-outline/60 hover:text-primary px-2 py-0.5 rounded border border-outline-variant/10 hover:border-primary/30 transition-all"
          >
            {isGenerating ? "Generating..." : "Generate Music"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[10px] text-outline/60 hover:text-primary px-2 py-0.5 rounded border border-outline-variant/10 hover:border-primary/30 transition-all"
          >
            Upload
          </button>
          <input ref={fileRef} type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
        </div>
      )}
    </div>
  );
}
