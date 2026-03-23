"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function TopNav() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Contextual subtitle based on current page
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

  return (
    <header className="h-[72px] shrink-0 hidden md:flex items-center justify-between px-8 topnav-island relative z-10">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="font-headline font-bold text-lg tracking-tight text-on-surface leading-tight">
            {pageTitle}
          </h2>
          <p className="text-xs text-outline font-medium leading-tight mt-0.5">
            {pageSubtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Search */}
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
              className="w-52 h-9 px-4 rounded-2xl glass text-sm text-on-surface focus:ring-2 focus:ring-primary/30 focus:outline-none placeholder:text-outline/50 spring-transition"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            title="Search"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale"
          >
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        )}

        {/* Notifications */}
        <button
          title="Notifications"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale relative"
        >
          <span className="material-symbols-outlined text-lg">notifications</span>
        </button>

        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition press-scale"
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
