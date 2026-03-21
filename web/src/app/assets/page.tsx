export default function AssetLibrary() {
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xl">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input className="w-full bg-surface-container-low border-none rounded-xl py-2.5 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary/40 placeholder:text-outline/60 font-body" placeholder="Search assets, tags, or projects..." type="text"/>
        </div>
        <div className="flex items-center gap-6 ml-8">
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
          <div className="h-8 w-[1px] bg-outline-variant/20"></div>
          <h1 className="font-headline font-bold text-lg text-on-surface">Asset Library</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <section className="flex flex-col gap-10 max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-on-surface font-headline font-extrabold text-5xl mb-4 tracking-tight">Media Assets</h2>
              <p className="text-on-surface-variant font-body max-w-md">Manage and organize your cinematic production files. Drag and drop to upload new footage.</p>
            </div>
            <button className="primary-gradient text-white px-8 py-4 rounded-xl font-headline font-bold flex items-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
              Upload New Asset
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 p-1.5 bg-surface-container-low rounded-2xl w-fit">
              <button className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-surface-container-highest text-primary shadow-sm">All</button>
              <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Images</button>
              <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Videos</button>
              <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Audio</button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-label text-on-surface-variant uppercase tracking-widest">Sort by: <span className="text-on-surface font-bold">Recent</span></span>
              <button className="p-2.5 rounded-xl border border-outline-variant/15 text-on-surface-variant">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
            </div>
          </div>

          {/* Bento Asset Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* Video Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video relative overflow-hidden">
                <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Cinematic landscape drone shot thumbnail" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDQ0no70lpuO-eG65LHEr2a_WscivvY9rIjd8vQJvJ0JxY7gEskFyTfD7dMmBe2p5mHMWNcyQbepHrvfesBxmgW4ei_ywXorCfXfbkhUtQ-87qg0Xh9YKpoSC9DRapgG9GEt98wLXETFMe_Z610ECLxSVzEFk65kLnOeoJaqulZCZjUUFcjcFwzddedUZodhwXLfxdFf8qT0e81EOY7yxfehdrOOlprAc7ArsaieDF1GLpxFU6Nv-OQEBOC2w8RZcBH_qwFZYDFqA0"/>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all"></div>
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold font-headline text-white uppercase tracking-wider">0:45</div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20">
                    <span className="material-symbols-outlined text-sm">more_vert</span>
                  </button>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Mountain_Drone_4K.mp4</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">124.5 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 24, 2023</span>
                </div>
              </div>
            </div>

            {/* Audio Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video bg-surface-container-highest flex items-center justify-center relative">
                <div className="flex items-end gap-1 h-12">
                  <div className="w-1.5 h-6 bg-primary/40 rounded-full"></div>
                  <div className="w-1.5 h-10 bg-primary/60 rounded-full"></div>
                  <div className="w-1.5 h-12 primary-gradient rounded-full"></div>
                  <div className="w-1.5 h-8 bg-primary/60 rounded-full"></div>
                  <div className="w-1.5 h-5 bg-primary/40 rounded-full"></div>
                </div>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Ambient_Synth_Wave.wav</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">12.2 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 22, 2023</span>
                </div>
              </div>
            </div>

            {/* Image Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video relative overflow-hidden">
                <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Abstract colorful neon gradient background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNynxcWSXgLv9KR3idQuDmF2q58VofDrgWzSBdhaca9CNKv-kOScXGaBUBZm7gRQRvGfCr86brms9I5hNaa-FdhO44pH9CSkELlhPUX7inVJ9TiHOCPU8WE9_uPE94HgmSSC8B0-9AhAFqYxVpwYhkKEe-5M_jwZVjsKikOYgq60-LF9fqpRxndLtjk2uhuPTAayyKIHIzFSucTpUvzAr7GdUN52dCGMh3I16zEkaKyffgx-d5scMMwh1iNDFzuhpnTBNR2eoCiO_N"/>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all"></div>
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 bg-tertiary text-on-tertiary rounded text-[10px] font-bold font-headline uppercase tracking-wider">AI Gen</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Neon_Dream_01.jpg</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">4.8 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 20, 2023</span>
                </div>
              </div>
            </div>

            {/* Video Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video relative overflow-hidden">
                <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Cinematic movie theatre interior" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDd8tjawWjA4XdY4AlW_Mlr7sEldk58sxY1ZqJ8Z0XQAClWw89C1Hx0ppLAQH8_kDwQwB4e0WtunJLpUwRBxSwBD3B5KZozsohggUMg3te1C3YzT2yr-WcPg_cJw-dk-XM3LOIl2PlybFhRKbwAy2lLyWNAcuLJV-fWiJbOGrJCktTKrxcmrSjlGm063UflvTWW0XWvJ_H3385ATEmzybGPsu-A7buIx4gYzWe0Ti-Lxx6PtW61OuKEOzIFLTHhJhLYPOsZe016PHYr"/>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all"></div>
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold font-headline text-white uppercase tracking-wider">2:15</div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Interview_B-Roll.mp4</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">452.1 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 18, 2023</span>
                </div>
              </div>
            </div>

            {/* Image Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video relative overflow-hidden">
                <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="Dark abstract architectural stairs" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB__3EiCg2mqBqAkI6W3hpdWf8lIoO6k3z95PthiN5ZN9hpb9Vlo7917ifN3YgCpGkI8BsRTaUadkmOQpOk79z9KUUTEJ6GyMuzgvNM3ZKtyc1uCxZ0XMwVFKijG2sV27aUB-H6qUcYMZBqNDoO0Svo5QOyYgrGFmzcQVkpEegwymQJz8tke26Kq0trs0iAQAIYMIajuPZQNir0SP0r5impGsLuMmh41edYR1INqgBtqtrSNsParvPdfOftosxpjYsZJ8oH65Cvqjdr"/>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all"></div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Architecture_Still.png</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">15.5 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 15, 2023</span>
                </div>
              </div>
            </div>

            {/* Audio Asset Card */}
            <div className="group relative glass-card glass-card-hover rounded-xl overflow-hidden hover:ring-2 ring-primary/30 transition-all duration-300">
              <div className="aspect-video bg-surface-container-highest flex items-center justify-center relative">
                <span className="material-symbols-outlined text-outline text-4xl opacity-40">mic</span>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="p-5">
                <h3 className="font-headline font-bold text-on-surface mb-1 truncate">Voiceover_Script_v2.mp3</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-widest">3.1 MB</span>
                  <span className="text-[11px] font-body text-outline">Oct 14, 2023</span>
                </div>
              </div>
            </div>
          </div>

          {/* Empty State / Footer Area */}
          <div className="mt-8 py-16 flex flex-col items-center justify-center border-2 border-dashed border-primary/10 rounded-3xl glass mb-8">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-6">
              <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
            </div>
            <h4 className="font-headline font-bold text-xl text-on-surface mb-2">Drag more assets here</h4>
            <p className="text-on-surface-variant font-body text-sm text-center max-w-xs leading-relaxed">Supports MP4, MOV, PNG, JPG, and WAV formats. Maximum file size 2GB.</p>
          </div>
        </section>
      </div>
    </>
  );
}
