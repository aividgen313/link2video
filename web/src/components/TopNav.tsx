"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function TopNav() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageTitle = (() => {
    switch (pathname) {
      case "/": return "Dashboard";
      case "/assets": return "Assets";
      case "/story": return "Story Angles";
      case "/script": return "Script Editor";
      case "/generate": return "Video Generation";
      default: return "Dashboard";
    }
  })();

  const tabs = [
    { label: "Recent", href: "/" },
    { label: "All Videos", href: "/assets" },
    { label: "Story", href: "/story" },
    { label: "Script", href: "/script" },
    { label: "Generate", href: "/generate" },
  ];

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-10">
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
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all">
          <span className="material-symbols-outlined text-lg">notifications</span>
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all">
          <span className="material-symbols-outlined text-lg">search</span>
        </button>
      </div>
    </header>
  );
}
