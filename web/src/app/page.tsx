"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VOICES, VIDEO_DIMENSIONS, QUALITY_TIERS, QualityTier } from "@/context/AppContext";
import { getHistory, deleteFromHistory, type VideoHistoryItem } from "@/lib/videoHistory";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const TOPIC_TEMPLATES = [
  // Viral POV / immersive styles (top-performing YouTube format)
  { label: "Lottery Winner", icon: "casino", topic: "POV: Your life after winning the $500 million lottery", group: "POV" },
  { label: "NBA Levels", icon: "sports_basketball", topic: "POV: Your life as every NBA level — from benchwarmer to superstar", group: "POV" },
  { label: "Wealth Wake Up", icon: "hotel", topic: "Every level of wealth explained by how you wake up in the morning", group: "Levels" },
  { label: "Athlete Billions", icon: "emoji_events", topic: "How athletes actually become billionaires — the untold blueprint", group: "Finance" },
  { label: "Quit Your Job", icon: "work_off", topic: "POV: Your life one year after quitting your 9-5 to start a business with $0", group: "POV" },
  { label: "Income Levels", icon: "leaderboard", topic: "POV: Your life at every income level from dead broke to $1 billion", group: "POV" },
  // Documentary styles
  { label: "True Crime", icon: "policy", topic: "A shocking true crime case with an unexpected twist that changed everything", group: "Documentary" },
  { label: "Nature Doc", icon: "forest", topic: "The secret lives of the world's most mysterious deep ocean creatures", group: "Documentary" },
  { label: "History Mystery", icon: "history_edu", topic: "The fall of the Roman Empire and its eerie parallels to today's world", group: "Documentary" },
  { label: "Untold Story", icon: "star", topic: "The dark untold story behind a famous celebrity's rise and sudden downfall", group: "Documentary" },
  { label: "Science Shock", icon: "science", topic: "Scientists just discovered something that completely changes what we know about the universe", group: "Documentary" },
  // Finance & wealth styles
  { label: "Rich Story", icon: "attach_money", topic: "How a broke kid from nothing built a billion-dollar empire from scratch", group: "Finance" },
  { label: "Finance Q&A", icon: "quiz", topic: "Simply explaining the most confusing money questions everyone secretly has", group: "Finance" },
  { label: "Tech Explainer", icon: "memory", topic: "How artificial intelligence is silently reshaping every aspect of modern life", group: "Documentary" },
];

const VISUAL_STYLES = [
  { value: "Cinematic Documentary", label: "🎥 Cinematic Documentary" },
  { value: "Animated Storytime", label: "🎨 Animated Storytime" },
  { value: "3D Render", label: "🖼️ 3D Render (Pixar Style)" },
  { value: "Photorealistic", label: "📸 Photorealistic" },
  { value: "Anime", label: "🌸 Anime (Studio Ghibli)" },
];

export default function Home() {
  const router = useRouter();
  const {
    url, setUrl,
    qualityTier, setQualityTier,
    globalVisualStyle, setGlobalVisualStyle,
    videoDimension, setVideoDimension,
    selectedVoice, setSelectedVoice,
    musicEnabled, setMusicEnabled,
    captionsEnabled, setCaptionsEnabled,
    creditsUsed,
  } = useAppContext();

  const [inputValue, setInputValue] = useState(url || "");
  const [hasMounted, setHasMounted] = useState(false);
  const [recentVideos, setRecentVideos] = useState<VideoHistoryItem[]>([]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) setRecentVideos(getHistory());
  }, [hasMounted]);

  const handleGenerate = () => {
    if (!inputValue.trim()) return;
    setUrl(inputValue);
    router.push("/story");
  };

  const tier = QUALITY_TIERS[qualityTier];
  const sceneCount = 7; // Approx scenes for cost preview
  const estimatedCredits = (tier.creditsPerScene * sceneCount).toFixed(3);


  return (
    <>
      <div className="max-w-3xl mx-auto w-full">
        <div className="glass-card rounded-[2rem] p-6 md:p-10 relative overflow-hidden shadow-2xl">
          {/* Background glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary/8 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <h3 className="font-headline text-2xl md:text-4xl font-extrabold tracking-tighter">Create New Video</h3>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Paste a link or topic</label>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-5 pr-12 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all text-base"
                  placeholder="Wikipedia link, news article, or story idea..."
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">link</span>
                </button>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-2">
              <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Quick Start</label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setInputValue(t.topic)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-outline-variant/10 text-xs font-medium text-outline hover:text-primary hover:border-primary/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Tier */}
            <div className="space-y-2">
              <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Quality</label>
              <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest/50 border border-outline-variant/10 p-1.5 rounded-2xl">
                {(["basic", "medium", "pro"] as QualityTier[]).map((t) => {
                  const info = QUALITY_TIERS[t];
                  const isActive = qualityTier === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setQualityTier(t)}
                      className={`py-2.5 px-2 rounded-xl flex flex-col items-center gap-0.5 transition-all ${isActive ? `${info.bgColor} ${info.color} border ${info.borderColor}` : "text-outline hover:bg-surface-variant/30"}`}
                    >
                      <span className="font-bold text-sm">{info.label}</span>
                      <span className="text-[10px] opacity-70 leading-tight text-center hidden sm:block">{t === "basic" ? "FREE" : `~$${info.creditsPerScene}/scene`}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-outline pl-1">{tier.description} · Estimated: <span className="font-bold text-on-surface">{qualityTier === "basic" ? "FREE" : `$${estimatedCredits} credits`}</span></p>
            </div>

            {/* Row: Dimension + Visual Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Video Size</label>
                <div className="relative">
                  <select
                    value={videoDimension.id}
                    onChange={(e) => setVideoDimension(VIDEO_DIMENSIONS.find(d => d.id === e.target.value) || VIDEO_DIMENSIONS[0])}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer truncate"
                  >
                    {VIDEO_DIMENSIONS.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Visual Style</label>
                <div className="relative">
                  <select
                    value={globalVisualStyle}
                    onChange={(e) => setGlobalVisualStyle(e.target.value)}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer truncate"
                  >
                    {VISUAL_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                </div>
              </div>
            </div>

            {/* Voiceover + Music + Captions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">
                  Voice {qualityTier === "basic" ? "(Free · Edge TTS)" : "(ElevenLabs)"}
                </label>
                <div className="relative">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-3.5 px-4 pr-10 text-on-surface text-sm appearance-none focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer"
                  >
                    {VOICES.map(v => (
                      <option key={v.id} value={v.id}>{v.name} — {v.gender}, {v.description}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">expand_more</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Extras</label>
                <div className="space-y-2">
                  {[
                    { enabled: musicEnabled, toggle: () => setMusicEnabled(!musicEnabled), onIcon: "music_note", offIcon: "music_off", label: "Background Music" },
                    { enabled: captionsEnabled, toggle: () => setCaptionsEnabled(!captionsEnabled), onIcon: "closed_caption", offIcon: "closed_caption_disabled", label: "Burn-in Captions" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.toggle}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all text-sm font-medium ${item.enabled ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-container-lowest/50 border-outline-variant/10 text-outline"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">{item.enabled ? item.onIcon : item.offIcon}</span>
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${item.enabled ? "bg-primary" : "bg-outline-variant/30"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${item.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Credits tracker */}
            {creditsUsed > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="material-symbols-outlined text-primary text-lg">account_balance_wallet</span>
                <div>
                  <p className="text-xs text-outline font-label uppercase tracking-widest">Credits Used This Session</p>
                  <p className="font-bold text-on-surface">${creditsUsed.toFixed(4)}</p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={!inputValue.trim()}
                className="w-full primary-gradient text-white font-headline font-extrabold py-4 px-8 rounded-2xl text-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
              >
                Generate Video
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      {hasMounted && (
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-headline text-xl md:text-2xl font-bold tracking-tight">
              Recent Videos
              {recentVideos.length > 0 && (
                <span className="ml-2 text-sm font-normal text-outline">({recentVideos.length})</span>
              )}
            </h3>
          </div>

          {recentVideos.length === 0 ? (
            <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-dashed border-outline-variant/20">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">movie</span>
              <h4 className="font-headline font-bold text-lg mb-1">No videos yet</h4>
              <p className="text-sm text-outline">Generate your first video above and it&apos;ll appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {recentVideos.map((v) => {
                const date = new Date(v.createdAt);
                const timeAgo = formatTimeAgo(date);
                const mins = Math.floor(v.totalSeconds / 60);
                const secs = v.totalSeconds % 60;
                const durationLabel = `${mins}:${String(secs).padStart(2, "0")}`;

                return (
                  <div key={v.id} className="group glass-card glass-card-hover rounded-[1.5rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-3px] hover:shadow-xl hover:shadow-primary/5">
                    <div className="h-40 md:h-48 relative overflow-hidden bg-surface-container-high">
                      {v.thumbnailUrl ? (
                        <img alt={v.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src={v.thumbnailUrl} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-4xl text-outline/30">movie</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{v.dimensionId}</span>
                        <span className="bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold">{durationLabel}</span>
                      </div>
                      <button
                        onClick={() => { deleteFromHistory(v.id); setRecentVideos(getHistory()); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/60"
                        title="Remove from history"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                    <div className="p-4 md:p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-headline font-bold text-base leading-tight mb-1 line-clamp-2">{v.title}</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${QUALITY_TIERS[v.quality].bgColor} ${QUALITY_TIERS[v.quality].color}`}>{QUALITY_TIERS[v.quality].label}</span>
                          <p className="text-xs text-outline">{timeAgo}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setUrl(v.topic); router.push("/story"); }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/20"
                      >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Regenerate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
