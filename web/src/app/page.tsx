"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";

export default function Home() {
  const router = useRouter();
  const { url, setUrl, globalScriptModel, setGlobalScriptModel, globalVisualStyle, setGlobalVisualStyle } = useAppContext();
  const [inputValue, setInputValue] = useState(url || "");
  const [selectedPlatform, setSelectedPlatform] = useState<"tiktok" | "instagram" | "youtube">("tiktok");
  const [videoLength, setVideoLength] = useState("1 min");
  const [voiceEngine, setVoiceEngine] = useState<"elevenlabs" | "google">("elevenlabs");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const handleGenerate = () => {
    setUrl(inputValue);
    router.push("/story");
  };

  const handleViewAllVideos = () => {
    alert("View All Videos feature coming soon! This will navigate to a complete video library.");
  };

  const handleEditVideo = (videoTitle: string) => {
    alert(`Edit video: "${videoTitle}"\n\nThis feature will open the video in the editor for modifications.`);
  };

  const handleRegenerateVideo = (videoTitle: string) => {
    alert(`Regenerate video: "${videoTitle}"\n\nThis will create a new version with updated AI models.`);
  };

  return (
    <>
      <div className="max-w-5xl mx-auto">
        <div className="glass-card rounded-[2rem] p-10 relative overflow-hidden shadow-2xl">
          {/* Background Decoration */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary/8 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10">
            <h3 className="font-headline text-4xl font-extrabold mb-8 tracking-tighter">Create New Video</h3>
            <div className="grid grid-cols-1 gap-8">
              {/* Input Field */}
              <div className="space-y-3">
                <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Paste a link or topic</label>
                <div className="relative group">
                  <input 
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-5 px-6 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 transition-all text-lg" 
                    placeholder="Paste a Wikipedia link, news article, or type a story idea..." 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                    <button className="p-2 text-outline hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">link</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Platform Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Platform</label>
                  <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-2xl">
                    <button
                      onClick={() => setSelectedPlatform("tiktok")}
                      className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center gap-1 font-medium text-xs transition-all ${selectedPlatform === "tiktok" ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-xl">theater_comedy</span>
                      TikTok
                    </button>
                    <button
                      onClick={() => setSelectedPlatform("instagram")}
                      className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center gap-1 text-xs transition-all ${selectedPlatform === "instagram" ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-xl">camera_roll</span>
                      Instagram
                    </button>
                    <button
                      onClick={() => setSelectedPlatform("youtube")}
                      className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center gap-1 text-xs transition-all ${selectedPlatform === "youtube" ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-xl">smart_display</span>
                      YouTube
                    </button>
                  </div>
                </div>

                {/* Length Dropdown */}
                <div className="space-y-3">
                  <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Video Length</label>
                  <div className="relative">
                    <select
                      value={videoLength}
                      onChange={(e) => setVideoLength(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-6 text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                      <option>1 min</option>
                      <option>3 min</option>
                      <option>5 min</option>
                      <option>10 min</option>
                      <option>30 min</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>

                {/* Visual Style Dropdown */}
                <div className="space-y-3">
                  <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Visual Style</label>
                  <div className="relative">
                    <select 
                      value={globalVisualStyle}
                      onChange={(e) => setGlobalVisualStyle(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl py-4 px-6 text-on-surface appearance-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                      <option value="Cinematic Documentary">🎥 Cinematic Documentary (Realistic)</option>
                      <option value="Animated Storytime">🎨 Animated Storytime (2D flat vector)</option>
                      <option value="3D Render">🖼️ 3D Render (Pixar/Disney Style)</option>
                      <option value="Photorealistic">📸 Photorealistic (Natural Lighting)</option>
                      <option value="Anime">🌸 Anime (Studio Ghibli Style)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div className="space-y-3">
                  <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Voiceover Engine</label>
                  <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-2xl">
                    <button
                      onClick={() => setVoiceEngine("elevenlabs")}
                      className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 font-medium text-xs transition-all ${voiceEngine === "elevenlabs" ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-lg">graphic_eq</span>
                      ElevenLabs
                    </button>
                    <button
                      onClick={() => setVoiceEngine("google")}
                      className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 text-xs transition-all ${voiceEngine === "google" ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-lg">cloud_queue</span>
                      Google Cloud TTS
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-label text-outline uppercase tracking-widest pl-1">Subtitles &amp; Captions</label>
                  <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-2xl">
                    <button
                      onClick={() => setSubtitlesEnabled(true)}
                      className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 font-medium text-xs transition-all ${subtitlesEnabled ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-lg">closed_caption</span>
                      Deepgram + FFmpeg
                    </button>
                    <button
                      onClick={() => setSubtitlesEnabled(false)}
                      className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 text-xs transition-all ${!subtitlesEnabled ? "bg-primary/15 text-primary shadow-sm shadow-primary/10" : "text-outline hover:bg-surface-variant/30"}`}>
                      <span className="material-symbols-outlined text-lg">block</span>
                      None
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button 
                onClick={handleGenerate}
                disabled={!inputValue}
                className="primary-gradient text-white font-headline font-extrabold py-5 px-12 rounded-2xl text-xl flex items-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30">
                Generate &amp; Assemble Video 
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos Section */}
      <div className="max-w-6xl mx-auto pt-16">
        <div className="flex items-center justify-between mb-8 px-4">
          <h3 className="font-headline text-2xl font-bold tracking-tight">Recent Videos</h3>
          <button
            onClick={handleViewAllVideos}
            className="text-primary font-medium flex items-center gap-2 hover:underline transition-colors">
            View All
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        
        {/* Bento Grid Layout for Recent Videos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Video Card 1 */}
          <div className="group glass-card glass-card-hover rounded-[2rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-primary/5">
            <div className="h-48 relative overflow-hidden">
              <img alt="Nature video thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuABpDAM-i-_JA37ynsh_gJVK4I2ywLtKKFGp_BcnKvGn4x7mIfKOGRjRtj-auhtQ0TyIJd7pv8iEzZFCz901grvAitOpon3tX2H_VCNoKcAbb13rUxVQjtCaHGxansGDHqOvQuB5QDvz55ul84jGNPNjK059Ko6n1wL8Z8Pr57a4v_05-L2Z5PhBLeUePHkAP4zVyJB_5g-i47GwbVpzcUmls7ZSnwHwYEnX15dPsnMSdxfVzarjcm7GfKOFvnOlWLOTVxRnWS9s7FC" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent"></div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Vertical</span>
                <span className="bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">3:45</span>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-headline font-bold text-lg leading-tight mb-2">The Hidden Mysteries of the Amazon Rainforest</h4>
                <p className="text-xs text-outline font-label">Modified 2 hours ago</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleEditVideo("The Hidden Mysteries of the Amazon Rainforest")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl bg-surface-variant/50 hover:bg-surface-variant transition-colors backdrop-blur-sm">
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleRegenerateVideo("The Hidden Mysteries of the Amazon Rainforest")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-variant/30 transition-colors">
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Video Card 2 */}
          <div className="group glass-card glass-card-hover rounded-[2rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-primary/5">
            <div className="h-48 relative overflow-hidden">
              <img alt="Technology video thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD7uKMJsZEv3x_xyZNclEG3gTKw62_n0zDPGTq7JIIMbw-CdayYSUXOK7G_mQXzJp39l842bPfzp6xaXh9YxOhoZ6Em3pWGWkNKfYWhLLOjFD6PJ7WLWYIw-4Igc5h5No9t7Z40klaMue1zwUfQY4ni2FTKaPweUkvCIPRveiV1jyaHmtryRy_DPAjEuF0JSqNUtwUCvr-VrtWEUxbGdZFrXir4reksVWIATAo2hpfzrZlb5XgrRGe5ssgvPRbUV8x88_ByGZ160yK" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent"></div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Horizontal</span>
                <span className="bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">12:20</span>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-headline font-bold text-lg leading-tight mb-2">How Quantum Computing is Changing the World</h4>
                <p className="text-xs text-outline font-label">Modified yesterday</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleEditVideo("How Quantum Computing is Changing the World")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl bg-surface-variant/50 hover:bg-surface-variant transition-colors backdrop-blur-sm">
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleRegenerateVideo("How Quantum Computing is Changing the World")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-variant/30 transition-colors">
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Video Card 3 */}
          <div className="group glass-card glass-card-hover rounded-[2rem] overflow-hidden flex flex-col transition-all hover:translate-y-[-4px] hover:shadow-xl hover:shadow-primary/5">
            <div className="h-48 relative overflow-hidden">
              <img alt="History video thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnt1Wo8ixYmZIcJlFfW_-LcAgJ9_QiChY8jDLOXpJwI2wkz6Cf8uIuPj1lN227E9Pz5p3CRdSF8PYgLB6RFhNFfRZXD30e7Fnh95-I4b1FZzMBwCw7EJaGVxtcYTCfCUrCuAIndHVTJClwQdgjuu-bGPNjAtvMC2uSx3iaMzWuR4pqRQIim2sEZUJvEMViHutLR3IXmkPdQ_4AtiaU6ZfBzj8nBfaLZCtBUFtmZ8Z_RQ6BjTfqJSi8ACLAs3-qPGFpugwAmAf74rDs" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent"></div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="bg-primary/20 backdrop-blur-md text-primary px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Vertical</span>
                <span className="bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">0:58</span>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-headline font-bold text-lg leading-tight mb-2">The Fall of Rome: A 60-Second Deep Dive</h4>
                <p className="text-xs text-outline font-label">Modified 3 days ago</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleEditVideo("The Fall of Rome: A 60-Second Deep Dive")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl bg-surface-variant/50 hover:bg-surface-variant transition-colors backdrop-blur-sm">
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleRegenerateVideo("The Fall of Rome: A 60-Second Deep Dive")}
                  className="flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-variant/30 transition-colors">
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
