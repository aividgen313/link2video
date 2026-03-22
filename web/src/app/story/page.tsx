"use client";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";

interface Angle {
  title: string;
  description: string;
  type: string;
  duration: string;
}

export default function StoryAngleGenerator() {
  const router = useRouter();
  const { url, setAngle, globalScriptModel, targetDurationMinutes } = useAppContext();
  const [selectedAngle, setSelectedAngle] = useState("");
  const [angles, setAngles] = useState<Angle[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect if no URL/topic entered
  useEffect(() => {
    if (hasMounted && !url) {
      router.push("/");
    }
  }, [hasMounted, url, router]);

  const fetchAngles = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
      const isRunware = globalScriptModel.startsWith("runware:");
      const provider = isRunware ? "runware" : "gemini";
      const model = isRunware ? globalScriptModel.replace("runware:", "") : globalScriptModel;

      const res = await fetch("/api/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: url,
          provider,
          model,
          durationMinutes: targetDurationMinutes,
        })
      });
      const data = await res.json();

      if (res.status === 402 && data.isCreditsError) {
        setErrorMessage(data.message || "Runware credits exhausted. Please add credits to continue.");
        setAngles([]);
      } else if (data.angles) {
        setAngles(data.angles);
        setErrorMessage(null);
      } else if (data.error) {
        setErrorMessage(data.error);
        setAngles([]);
      }
    } catch (e) {
      console.error("Failed to fetch angles:", e);
      setErrorMessage("Network error: Unable to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Separate effect for fetching — use ref to prevent double-call in strict mode
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (url && angles.length === 0 && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAngles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleGenerateScript = () => {
    setAngle(selectedAngle || angles[0]?.title || "General Story");
    router.push("/script");
  };

  if (!hasMounted) return null;

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

        {/* Error State */}
        {errorMessage && !isLoading && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-error-container border-2 border-error rounded-2xl p-8">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-error text-3xl">error</span>
                <div>
                  <h3 className="font-headline font-bold text-xl text-on-error-container mb-2">Unable to Generate Angles</h3>
                  <p className="text-on-error-container/80 mb-4">{errorMessage}</p>
                  {errorMessage.includes('credits') && (
                    <a
                      href="https://runware.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-error text-on-error px-4 py-2 rounded-xl font-medium hover:opacity-90 transition-opacity">
                      <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                      Add Credits on Runware
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="font-headline font-bold text-xl animate-pulse">Brainstorming Angles...</p>
          </div>
        ) : !errorMessage && (
          <div className="grid grid-cols-12 gap-8 mb-20">
            {angles.map((angle, index) => {
              const isSelected = selectedAngle === angle.title;
              
              if (index === 0) {
                // Card 1: Main Feature
                return (
                  <div key={index} className="col-span-12 lg:col-span-8 group cursor-pointer" onClick={() => setSelectedAngle(angle.title)}>
                    <div className={"glass-card rounded-xl p-8 h-full flex flex-col justify-between transition-all " + (isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-primary/5 border border-transparent hover:border-primary/20")}>
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <span className="font-label text-xs font-bold text-primary tracking-widest uppercase bg-primary/10 px-3 py-1 rounded-full">Recommended</span>
                          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_outward</span>
                        </div>
                        <h3 className="font-headline text-3xl font-extrabold mb-4 leading-tight text-on-surface">{angle.title}</h3>
                        <p className="font-body text-outline text-lg leading-relaxed mb-8">{angle.description}</p>
                        <div className="flex gap-4 mb-8">
                          <div className="px-4 py-2 rounded-lg bg-surface-container-lowest text-xs text-outline-variant font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            {angle.duration} script
                          </div>
                          <div className="px-4 py-2 rounded-lg bg-surface-container-lowest text-xs text-outline-variant font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">style</span>
                            {angle.type}
                          </div>
                        </div>
                      </div>
                      <button className={`font-headline font-bold py-3 px-8 rounded-xl self-start transition-all ${isSelected ? "primary-gradient text-white shadow-lg shadow-primary/30" : "bg-surface-variant/50 text-on-surface hover:bg-surface-variant"}`}>
                        {isSelected ? "Selected" : "Select Angle"}
                      </button>
                    </div>
                  </div>
                );
              }

              if (index === 1 || index === 2) {
                // Card 2 & 3: Side Items
                const badgeColor = index === 1 ? "text-tertiary border-tertiary/30" : "text-outline-variant border-outline-variant/30";
                return (
                  <div key={index} className="col-span-12 lg:col-span-4 group cursor-pointer" onClick={() => setSelectedAngle(angle.title)}>
                    <div className={"glass-card rounded-xl p-8 h-full flex flex-col transition-all " + (isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-primary/5 border border-transparent hover:border-primary/20")}>
                      <div className="mb-4">
                        <span className={`font-label text-[10px] font-bold tracking-widest uppercase border px-2 py-0.5 rounded ${badgeColor}`}>{angle.type}</span>
                      </div>
                      <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">{angle.title}</h3>
                      <p className="font-body text-outline text-sm leading-relaxed mb-6">{angle.description}</p>
                      <div className="mt-auto pt-6 flex justify-between items-center border-t border-outline-variant/10">
                        <span className="font-body text-xs text-outline-variant">{angle.duration}</span>
                        <button className={`${isSelected ? "text-primary" : "text-outline group-hover:text-primary"} font-headline font-bold text-sm flex items-center gap-1 hover:underline`}>
                          {isSelected ? "Selected" : "Select"} <span className="material-symbols-outlined text-sm">{isSelected ? "check" : "chevron_right"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (index === 3) {
                // Card 4: High Density
                return (
                  <div key={index} className="col-span-12 lg:col-span-8 group cursor-pointer" onClick={() => setSelectedAngle(angle.title)}>
                    <div className={"glass-card rounded-xl p-8 h-full flex items-center gap-8 transition-all relative overflow-hidden " + (isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-primary/5 border border-transparent hover:border-primary/20")}>
                      <div className="flex-1 relative z-10">
                        <div className="mb-3">
                          <span className="font-label text-xs font-bold text-outline uppercase tracking-widest">{angle.type} ({angle.duration})</span>
                        </div>
                        <h3 className="font-headline text-2xl font-bold mb-3 text-on-surface">{angle.title}</h3>
                        <p className="font-body text-outline text-sm leading-relaxed mb-6 max-w-md">{angle.description}</p>
                        <button className={`font-headline font-bold py-2.5 px-6 rounded-xl transition-colors ${isSelected ? "bg-primary text-on-primary" : "ghost-border text-on-surface hover:bg-surface-variant"}`}>
                          {isSelected ? "Selected" : "Select Story"}
                        </button>
                      </div>
                      <div className="hidden md:block w-48 h-48 rounded-xl overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                        <img alt="Abstract Background" className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=800&auto=format&fit=crop" />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high via-transparent to-transparent"></div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between pt-12 border-t border-outline-variant/10">
          <div className="flex items-center gap-2 text-outline-variant">
            <span className="material-symbols-outlined text-sm">info</span>
            <p className="text-xs font-body italic">Selection will lock your script's primary narrative flow.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchAngles} disabled={isLoading} className="ghost-border border border-outline-variant/30 text-on-surface font-headline font-bold py-4 px-10 rounded-xl hover:bg-surface-container-high transition-all flex items-center gap-2 disabled:opacity-50">
              <span className={`material-symbols-outlined text-xl ${isLoading ? "animate-spin" : ""}`}>refresh</span>
              Regenerate Angles
            </button>
            <button onClick={handleGenerateScript} disabled={isLoading || angles.length === 0} className="primary-gradient text-white font-headline font-bold py-4 px-12 rounded-xl flex items-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100">
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
