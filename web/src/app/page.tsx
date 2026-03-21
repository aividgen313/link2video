"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext, VOICES, VIDEO_DIMENSIONS, QUALITY_TIERS, QualityTier } from "@/context/AppContext";

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
    creditsUsed,
  } = useAppContext();

  const [inputValue, setInputValue] = useState(url || "");

  const handleGenerate = () => {
    if (!inputValue.trim()) return;
    setUrl(inputValue);
    router.push("/story");
  };

  const tier = QUALITY_TIERS[qualityTier];
  const sceneCount = 7; // Approx scenes for cost preview
  const estimatedCredits = (tier.creditsPerScene * sceneCount).toFixed(3);

  const recentVideos = [
    { title: "The Hidden Mysteries of the Amazon Rainforest", time: "2 hours ago", orientation: "Vertical", duration: "3:45", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuABpDAM-i-_JA37ynsh_gJVK4I2ywLtKKFGp_BcnKvGn4x7mIfKOGRjRtj-auhtQ0TyIJd7pv8iEzZFCz901grvAitOpon3tX2H_VCNoKcAbb13rUxVQjtCaHGxansGDHqOvQuB5QDvz55ul84jGNPNjK059Ko6n1wL8Z8Pr57a4v_05-L2Z5PhBLeUePHkAP4zVyJB_5g-i47GwbVpzcUmls7ZSnwHwYEnX15dPsnMSdxfVzarjcm7GfKOFvnOlWLOTVxRnWS9s7FC" },
    { title: "How Quantum Computing is Changing the World", time: "Yesterday", orientation: "Horizontal", duration: "12:20", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCD7uKMJsZEv3x_xyZNclEG3gTKw62_n0zDPGTq7JIIMbw-CdayYSUXOK7G_mQXzJp39l842bPfzp6xaXh9YxOhoZ6Em3pWGWkNKfYWhLLOjFD6PJ7WLWYIw-4Igc5h5No9t7Z40klaMue1zwUfQY4ni2FTKaPweUkvCIPRveiV1jyaHmtryRy_DPAjEuF0JSqNUtwUCvr-VrtWEUxbGdZFrXir4reksVWIATAo2hpfzrZlb5XgrRGe5ssgvPRbUV8x88_ByGZ160yK" },
    { title: "The Fall of Rome: A 60-Second Deep Dive", time: "3 days ago", orientation: "Vertical", duration: "0:58", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnt1Wo8ixYmZIcJlFfW_-LcAgJ9_QiChY8jDLOXpJwI2wkz6Cf8uIuPj1lN227E9Pz5p3CRdSF8PYgLB6RFhNFfRZXD30e7Fnh95-I4b1FZzMBwCw7EJaGVxtcYTCfCUrCuAIndHVTJClwQdgjuu-bGPNjAtvMC2uSx3iaMzWuR4pqRQIim2sEZUJvEMViHutLR3IXmkPdQ_4AtiaU6ZfBzj8nBfaLZCtBUFtmZ8Z_RQ6BjTfqJSi8ACLAs3-qPGFpugwAmAf74rDs" },
  ];

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

            {/* Voiceover + Music */}
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
                <label className="text-xs font-label text-outline uppercase tracking-widest pl-1">Background Music</label>
                <button
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all text-sm font-medium ${musicEnabled ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-container-lowest/50 border-outline-variant/10 text-outline"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">{musicEnabled ? "music_note" : "music_off"}</span>
                    <span>{musicEnabled ? "Music On" : "Music Off"}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${musicEnabled ? "bg-primary" : "bg-outline-variant/30"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${musicEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>
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
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="font-headline text-xl md:text-2xl font-bold tracking-tight">Recent Videos</h3>
          <button className="text-primary font-medium flex items-center gap-1 hover:underline transition-colors text-sm">
            View All
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {recentVideos.map((v, i) => (
            <div key={i} className="group glass-card glass-card-hover rounded-[1.5rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-3px] hover:shadow-xl hover:shadow-primary/5">
              <div className="h-40 md:h-48 relative overflow-hidden">
                <img alt={v.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src={v.src} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{v.orientation}</span>
                  <span className="bg-black/40 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold">{v.duration}</span>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-headline font-bold text-base leading-tight mb-1">{v.title}</h4>
                  <p className="text-xs text-outline">Modified {v.time}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl bg-surface-variant/50 hover:bg-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-base">edit</span>
                    Edit
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/30 transition-colors">
                    <span className="material-symbols-outlined text-base">refresh</span>
                    Redo
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
