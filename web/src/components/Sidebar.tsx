"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { recoverOrphanedProjects } from "@/lib/videoHistory";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", icon: "dashboard", label: "Home" },
    { href: "/notepad", icon: "auto_stories", label: "Notepad" },
    { href: "/assets", icon: "folder_open", label: "Projects" },
    { href: "/script", icon: "edit_note", label: "Script" },
    { href: "/editor", icon: "movie_edit", label: "Editor" },
  ];

  return (
    <>
      {/* Desktop Sidebar — Floating Island */}
      <aside className="hidden md:flex w-[72px] flex-col items-center py-5 gap-2 shrink-0 sidebar-island relative z-40">
        {/* Logo */}
        <button
          onClick={() => { router.push("/"); setMobileOpen(false); }}
          className="w-12 h-12 rounded-[1.25rem] bg-primary flex items-center justify-center mb-6 hover:scale-110 press-scale transition-all duration-500 shadow-lg shadow-primary/25 group relative"
        >
          <div className="absolute inset-0 rounded-[1.25rem] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
          <span className="material-symbols-outlined text-white text-2xl relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col items-center gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={item.label}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center spring-transition group relative ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-inner"
                    : "text-outline hover:text-on-surface hover:bg-surface-variant/40"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'wght' 300" }}
                >
                  {item.icon}
                </span>
                
                {/* Tooltip */}
                <span className="absolute left-full ml-4 px-3 py-1.5 rounded-xl bg-on-surface text-surface text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 translate-x-1 group-hover:translate-x-0 shadow-xl">
                  {item.label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -left-[14px] w-[4px] h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(37,99,235,0.5)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            title="Settings"
            onClick={() => router.push("/")}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/40 spring-transition press-scale"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'wght' 300" }}>settings</span>
          </button>
          <button
            title="Deep Recovery"
            onClick={async () => {
              const recovered = await recoverOrphanedProjects();
              if (recovered && recovered.length > 0) {
                alert(`Successfully recovered ${recovered.length} projects!`);
                window.location.reload();
              } else {
                alert("No orphaned projects found in deep storage.");
              }
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-outline hover:text-primary hover:bg-primary/10 spring-transition press-scale"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'wght' 300" }}>healing</span>
          </button>
          <div className="w-10 h-10 rounded-2xl overflow-hidden border border-outline-variant/20 mt-2 flex items-center justify-center bg-surface-container shadow-sm group hover:border-primary/40 transition-colors">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-xl">person</span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="global-mobile-nav md:hidden fixed top-0 left-0 right-0 z-40 h-14 glass border-b border-outline-variant/10 flex items-center justify-between px-4">
        <button
          onClick={() => { router.push("/"); }}
          className="w-9 h-9 rounded-full glass-elevated flex items-center justify-center press-scale"
        >
          <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>
        <span className="font-headline font-bold text-gradient">Link2Video</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition"
        >
          <span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span>
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className="md:hidden fixed top-14 left-0 bottom-0 z-30 w-64 glass border-r border-outline-variant/10 py-6 px-4 flex flex-col gap-2"
        style={{ transform: mobileOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.3s ease" }}
      >
        <nav className="flex flex-col gap-1 stagger-children">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-full spring-transition animate-fade-in-up ${
                  isActive
                    ? "glass-elevated text-primary"
                    : "text-outline hover:text-on-surface hover:bg-surface-variant/30"
                }`}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Mobile bottom actions */}
        <div className="mt-auto pt-6 border-t border-outline-variant/10 flex flex-col gap-2">
          <button
            onClick={async () => {
              const recovered = await recoverOrphanedProjects();
              if (recovered && recovered.length > 0) {
                alert(`Successfully recovered ${recovered.length} projects!`);
                window.location.reload();
              } else {
                alert("No orphaned projects found in deep storage.");
              }
              setMobileOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-full text-outline hover:text-primary hover:bg-primary/10 spring-transition"
          >
            <span className="material-symbols-outlined text-xl">healing</span>
            <span className="font-medium text-sm">Deep Recovery</span>
          </button>
        </div>
      </aside>
    </>
  );
}
