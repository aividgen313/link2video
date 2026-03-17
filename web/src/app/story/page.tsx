"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";

export default function StoryAngleGenerator() {
  const router = useRouter();
  const { setAngle } = useAppContext();
  const [selectedAngle, setSelectedAngle] = useState("");

  const handleSelectAngle = (angleDesc: string) => {
    setSelectedAngle(angleDesc);
  };

  const handleGenerateScript = () => {
    setAngle(selectedAngle || "The Rise and Fall of Blockbuster");
    router.push("/script");
  };

  return (
    <>
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-outline hover:text-primary transition-colors">
          <span className="material-symbols-outlined">chevron_left</span>
          <span className="font-body text-sm font-medium">Back to Dashboard</span>
        </Link>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <section className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary mb-6 border border-tertiary/20">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <span className="font-label text-[10px] uppercase font-bold tracking-[0.1em]">AI Engine Ready</span>
          </div>
          <h2 className="font-headline text-display-lg text-5xl font-extrabold tracking-tight mb-4">Choose a Story Angle</h2>
          <p className="font-body text-lg text-outline max-w-2xl leading-relaxed">
            Our AI analyzed your content and identified several narrative directions. Select the one that best fits your channel's vibe.
          </p>
        </section>

        {/* Bento-Style Concept Grid */}
        <div className="grid grid-cols-12 gap-8 mb-20">
          
          {/* Card 1: Main Feature */}
          <div className="col-span-12 lg:col-span-8 group cursor-pointer">
            <div className="bg-surface-container-high rounded-xl p-8 h-full flex flex-col justify-between transition-all hover:bg-surface-container-highest border border-transparent hover:border-primary/20">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <span className="font-label text-xs font-bold text-primary tracking-widest uppercase bg-primary/10 px-3 py-1 rounded-full">Recommended</span>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_outward</span>
                </div>
                <h3 className="font-headline text-3xl font-extrabold mb-4 leading-tight text-on-surface">The Rise and Fall of Blockbuster</h3>
                <p className="font-body text-outline text-lg leading-relaxed mb-8">
                  A gripping deep-dive into the strategic missteps of the 90s giant. Explore the untold story of how the biggest video rental company lost everything to a small DVD-by-mail startup named Netflix.
                </p>
                <div className="flex gap-4 mb-8">
                  <div className="px-4 py-2 rounded-lg bg-surface-container-lowest text-xs text-outline-variant font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    12 min script
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-surface-container-lowest text-xs text-outline-variant font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    High Retention
                  </div>
                </div>
              </div>
              <button onClick={() => handleSelectAngle("The Rise and Fall of Blockbuster")} className={`font-headline font-bold py-3 px-8 rounded-xl self-start transition-all ${selectedAngle === "The Rise and Fall of Blockbuster" ? "cinematic-gradient text-on-primary-container" : "bg-surface-variant text-on-surface hover:bg-surface-container-highest"}`}>
                {selectedAngle === "The Rise and Fall of Blockbuster" ? "Selected" : "Select Angle"}
              </button>
            </div>
          </div>

          {/* Card 2: Side Item */}
          <div className="col-span-12 lg:col-span-4 group cursor-pointer">
            <div className="bg-surface-container-high rounded-xl p-8 h-full flex flex-col transition-all hover:bg-surface-container-highest border border-transparent hover:border-primary/20">
              <div className="mb-4">
                <span className="font-label text-[10px] font-bold text-tertiary tracking-widest uppercase border border-tertiary/30 px-2 py-0.5 rounded">Short Form</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">The Netflix Gamble</h3>
              <p className="font-body text-outline text-sm leading-relaxed mb-6">
                Focusing specifically on the pivotal 2000 meeting where Blockbuster turned down buying Netflix for $50M.
              </p>
              <div className="mt-auto pt-6 flex justify-between items-center border-t border-outline-variant/10">
                <span className="font-body text-xs text-outline-variant">60s Narrative</span>
                <button className="text-primary font-headline font-bold text-sm flex items-center gap-1 hover:underline">
                  Select <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Side Item */}
          <div className="col-span-12 lg:col-span-4 group cursor-pointer">
            <div className="bg-surface-container-high rounded-xl p-8 h-full flex flex-col transition-all hover:bg-surface-container-highest border border-transparent hover:border-primary/20">
              <div className="mb-4">
                <span className="font-label text-[10px] font-bold text-outline-variant tracking-widest uppercase border border-outline-variant/30 px-2 py-0.5 rounded">Documentary Style</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">Digital Darwinism</h3>
              <p className="font-body text-outline text-sm leading-relaxed mb-6">
                A broader look at the evolution of home media and why physical stores were destined to vanish.
              </p>
              <div className="mt-auto pt-6 flex justify-between items-center border-t border-outline-variant/10">
                <span className="font-body text-xs text-outline-variant">15 min Script</span>
                <button className="text-primary font-headline font-bold text-sm flex items-center gap-1 hover:underline">
                  Select <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: High Density */}
          <div className="col-span-12 lg:col-span-8 group cursor-pointer">
            <div className="bg-surface-container-high rounded-xl p-8 h-full flex items-center gap-8 transition-all hover:bg-surface-container-highest border border-transparent hover:border-primary/20 relative overflow-hidden">
              <div className="flex-1 relative z-10">
                <h3 className="font-headline text-2xl font-bold mb-3 text-on-surface">The Last Blockbuster</h3>
                <p className="font-body text-outline text-sm leading-relaxed mb-6 max-w-md">
                  A human-centric story focusing on the Bend, Oregon location—the sole survivor in a ghost town of memories. Perfect for high-engagement viral storytelling.
                </p>
                <button className="ghost-border text-on-surface font-headline font-bold py-2.5 px-6 rounded-xl hover:bg-surface-variant transition-colors">Select Story</button>
              </div>
              <div className="hidden md:block w-48 h-48 rounded-xl overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                <img alt="Video Store" className="w-full h-full object-cover" data-alt="Vintage neon video rental store interior at night" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAboJC7ymdi3A1NXZzEDbZH7qNnmsnmIn_r_nLRMksw0-BW8OEhovhi-9o1TnAScCek3TJDGkYwuQcNigxPqIe_CF6DRyUcel3Y4Eafui6ncLj91oKKD3qMXoVyVPphtuAJvy5Peyahn1VYdWBmZUktlizZpmj8r6KAPV662oM_wx5Ad9DgmS6iqkd4MmURn2nf7saSHYwJfacxbISxlyE31_3oc4UikaAs5IleLlu33qVyYpoXJI9vUVjlJ9S8V450quy5v10kDzi4" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent"></div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between pt-12 border-t border-outline-variant/10">
          <div className="flex items-center gap-2 text-outline-variant">
            <span className="material-symbols-outlined text-sm">info</span>
            <p className="text-xs font-body italic">Selection will lock your script's primary narrative flow.</p>
          </div>
          <div className="flex gap-4">
            <button className="ghost-border border border-outline-variant/30 text-on-surface font-headline font-bold py-4 px-10 rounded-xl hover:bg-surface-container-high transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">refresh</span>
              Regenerate Angles
            </button>
            <button onClick={handleGenerateScript} className="cinematic-gradient bg-primary text-on-primary-container font-headline font-bold py-4 px-12 rounded-xl flex items-center gap-3 shadow-2xl shadow-primary-container/30 hover:scale-[1.02] transition-transform">
              Generate Script
              <span className="material-symbols-outlined text-xl">keyboard_double_arrow_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Abstract Design Element */}
      <div className="fixed bottom-0 right-0 w-1/3 h-1/2 -z-0 pointer-events-none opacity-20">
        <div className="w-full h-full bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent"></div>
      </div>
    </>
  );
}
