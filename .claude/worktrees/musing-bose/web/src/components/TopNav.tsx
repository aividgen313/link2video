"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";

export default function TopNav() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { pollenBalance, isFetchingBalance, pollenUsed } = useAppContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageTitle = (() => {
    switch (pathname) {
      case "/": return "Dashboard";
      case "/assets": return "Assets";
      case "/story": return "Story Angles";
      case "/script": return "Script Editor";
      case "/storyboard": return "Storyboard Preview";
      case "/editor": return "Video Editor";
      case "/generate": return "Video Generation";
      default: return "Dashboard";
    }
  })();

  const pageSubtitle = (() => {
    switch (pathname) {
      case "/": return "Your creative workspace";
      case "/assets": return "Media library";
      case "/story": return "Choose your narrative";
      case "/script": return "Write & refine";
      case "/storyboard": return "Visual planning";
      case "/editor": return "Fine-tune your video";
      case "/generate": return "Bring it to life";
      default: return "";
    }
  })();

  // Format balance: show 4 sig-figs for small amounts
  const formatBalance = (bal: number) => {
    if (bal >= 10) return bal.toFixed(2);
    if (bal >= 1) return bal.toFixed(3);
    return bal.toFixed(4);
  };

  // Colour based on how low balance is
  const balanceColor = () => {
    if (pollenBalance === null) return "text-outline";
    if (pollenBalance < 0.05) return "text-red-500 dark:text-red-400";
    if (pollenBalance < 0.20) return "text-amber-500 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const balanceBg = () => {
    if (pollenBalance === null) return "bg-surface-container";
    if (pollenBalance < 0.05) return "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25";
    if (pollenBalance < 0.20) return "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25";
    return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25";
  };

  return (
    <header className="h-[56px] md:h-[72px] shrink-0 flex items-center justify-between px-4 md:px-6 topnav-island relative z-10">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-headline font-bold text-base md:text-lg tracking-tight text-on-surface leading-tight">
            {pageTitle}
          </h2>
          <p className="text-[11px] text-outline font-medium leading-tight mt-0.5 hidden md:block">
            {pageSubtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">

        {/* ── Credits Pill ─────────────────────────────────── */}
        {mounted && (
          <div
            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300 ${balanceBg()}`}
            title={`Total spent this session: $${pollenUsed.toFixed(4)}`}
          >
            <span
              className={`material-symbols-outlined text-sm leading-none ${balanceColor()}`}
              style={{ fontVariationSettings: "'FILL' 1", fontSize: "14px" }}
            >
              toll
            </span>
            {isFetchingBalance ? (
              <span className="text-outline animate-pulse">···</span>
            ) : pollenBalance !== null ? (
              <span className={balanceColor()}>
                ${formatBalance(pollenBalance)}
              </span>
            ) : (
              <span className="text-outline">Credits</span>
            )}
            {pollenUsed > 0 && (
              <span className="text-outline/60 font-normal hidden sm:inline">
                {" "}−${pollenUsed.toFixed(4)}
              </span>
            )}
          </div>
        )}

        {/* ── Search ─────────────────────────── desktop only */}
        <div className="hidden md:flex items-center gap-2">
          {showSearch ? (
            <div className="flex items-center gap-2 animate-fade-in-up">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
                    setShowSearch(false);
                    setSearchQuery("");
                  } else if (e.key === "Escape") {
                    setShowSearch(false);
                    setSearchQuery("");
                  }
                }}
                onBlur={() => { setShowSearch(false); setSearchQuery(""); }}
                placeholder="Search projects..."
                className="w-52 h-9 px-5 rounded-full glass text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none placeholder:text-outline/50 spring-transition"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              title="Search"
              className="w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale"
            >
              <span className="material-symbols-outlined text-lg">search</span>
            </button>
          )}

          {/* ── Notifications ── */}
          <button
            title="Notifications"
            className="w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale relative"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
          </button>

          {/* ── Theme Toggle ── */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale"
              title="Toggle Theme"
            >
              <span className="material-symbols-outlined text-lg">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>
          )}
        </div>

        {/* ── Theme Toggle mobile only ── */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface md:hidden"
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-base">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
