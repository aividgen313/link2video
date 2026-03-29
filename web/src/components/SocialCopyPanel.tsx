"use client";

import { useState, useEffect } from "react";
import type { ScriptData } from "@/context/AppContext";

type SocialData = {
  youtube?: { title: string; description: string; tags: string[] };
  tiktok?: { caption: string; hashtags: string[] };
  instagram?: { caption: string };
  twitter?: { tweet: string };
};

type Tab = "youtube" | "tiktok" | "instagram" | "twitter";

const TAB_ICONS: Record<Tab, string> = {
  youtube: "smart_display",
  tiktok: "theater_comedy",
  instagram: "camera_roll",
  twitter: "chat_bubble",
};

export default function SocialCopyPanel({
  scriptData,
  dimension,
}: {
  scriptData: ScriptData | null;
  dimension: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<SocialData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("youtube");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scriptData) return;
    generateCopy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCopy = async () => {
    if (!scriptData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scriptData.title,
          angle: scriptData.angle,
          scenes: scriptData.scenes,
          dimension,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate copy");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copyToClipboard(text, id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copiedKey === id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "glass text-outline hover:text-on-surface"}`}
    >
      <span className="material-symbols-outlined text-sm">{copiedKey === id ? "check" : "content_copy"}</span>
      {copiedKey === id ? "Copied!" : "Copy"}
    </button>
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">share</span>
          <h3 className="font-headline font-bold text-base">Social Media Copy</h3>
        </div>
        <button
          onClick={generateCopy}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold glass text-outline hover:text-primary transition-all disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-sm ${isLoading ? "animate-spin" : ""}`}>
            {isLoading ? "progress_activity" : "refresh"}
          </span>
          {isLoading ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/10">
        {(["youtube", "tiktok", "instagram", "twitter"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold capitalize transition-all ${activeTab === tab ? "text-primary border-b-2 border-primary" : "text-outline hover:text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-sm">{TAB_ICONS[tab]}</span>
            <span className="hidden sm:inline">{tab}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8 gap-3 text-outline">
            <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Crafting viral copy...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {data && !isLoading && (
          <>
            {activeTab === "youtube" && data.youtube && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest">Title</label>
                    <CopyBtn text={data.youtube.title} id="yt-title" />
                  </div>
                  <p className="text-sm font-semibold text-on-surface bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10">{data.youtube.title}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest">Description</label>
                    <CopyBtn text={data.youtube.description} id="yt-desc" />
                  </div>
                  <p className="text-xs text-on-surface/80 bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10 whitespace-pre-wrap leading-relaxed">{data.youtube.description}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest">Tags</label>
                    <CopyBtn text={data.youtube.tags.join(", ")} id="yt-tags" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.youtube.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tiktok" && data.tiktok && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest">Caption</label>
                    <CopyBtn text={data.tiktok.caption} id="tt-cap" />
                  </div>
                  <p className="text-sm font-semibold text-on-surface bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10">{data.tiktok.caption}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-label text-outline uppercase tracking-widest">Hashtags</label>
                    <CopyBtn text={data.tiktok.hashtags.map(h => `#${h}`).join(" ")} id="tt-hash" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tiktok.hashtags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-xs font-medium border border-tertiary/20">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "instagram" && data.instagram && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-label text-outline uppercase tracking-widest">Caption + Hashtags</label>
                  <CopyBtn text={data.instagram.caption} id="ig-cap" />
                </div>
                <p className="text-sm text-on-surface/80 bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10 whitespace-pre-wrap leading-relaxed">{data.instagram.caption}</p>
              </div>
            )}

            {activeTab === "twitter" && data.twitter && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-label text-outline uppercase tracking-widest">Tweet</label>
                  <CopyBtn text={data.twitter.tweet} id="tw-tweet" />
                </div>
                <p className="text-sm font-semibold text-on-surface bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10">{data.twitter.tweet}</p>
                <p className="text-[10px] text-outline text-right">{data.twitter.tweet.length}/280 chars</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
