"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

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

  const tabs = [
    { label: "Recent", href: "/" },
    { label: "All Videos", href: "/assets" },
    { label: "Story", href: "/story" },
    { label: "Script", href: "/script" },
    { label: "Storyboard", href: "/storyboard" },
    { label: "Generate", href: "/generate" },
  ];

  return (
    <header className="h-16 shrink-0 hidden md:flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-10">
      <div className="flex items-center gap-6">
        <h2 className="font-headline font-bold text-lg tracking-tight text-on-surface">
          {pageTitle}
        </h2>
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-outline hover:text-on-surface hover:bg-surface-variant/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all"
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        )}
        <button
          title="Notifications"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all relative"
        >
          <span className="material-symbols-outlined text-lg">notifications</span>
        </button>
        {showSearch ? (
          <div className="flex items-center gap-2">
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
              className="w-48 h-9 px-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm text-on-surface focus:ring-1 focus:ring-primary/40 focus:outline-none placeholder:text-outline/50"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            title="Search"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all"
          >
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        )}
      </div>
    </header>
  );
}
