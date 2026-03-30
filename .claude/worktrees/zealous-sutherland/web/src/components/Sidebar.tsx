"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", icon: "dashboard", label: "Home" },
    { href: "/notepad", icon: "auto_stories", label: "Notepad" },
    { href: "/assets", icon: "folder_open", label: "Assets" },
    { href: "/script", icon: "edit_note", label: "Script" },
    { href: "/editor", icon: "movie_edit", label: "Editor" },
  ];

  const NavContent = () => (
    <>
      {/* Logo */}
      <button
        onClick={() => { router.push("/"); setMobileOpen(false); }}
        className="w-11 h-11 rounded-full bg-[#1877F2] dark:bg-[#4599FF] flex items-center justify-center mb-4 hover:scale-110 press-scale transition-all duration-300 shadow-md"
      >
        <span className="material-symbols-outlined text-white dark:text-[#18191A] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          play_arrow
        </span>
      </button>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={item.label}
              className={`w-11 h-11 rounded-full flex items-center justify-center spring-transition group relative ${
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
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-3 py-1.5 rounded-xl glass-elevated text-on-surface text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 translate-x-1 group-hover:translate-x-0">
                {item.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <span className="absolute -left-[7px] w-[3px] h-5 bg-primary rounded-full animate-gentle-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <button
          title="Settings"
          onClick={() => router.push("/")}
          className="w-11 h-11 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/30 spring-transition"
        >
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/20 mt-2 flex items-center justify-center glass-subtle">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar — Floating Island */}
      <aside className="hidden md:flex w-[72px] flex-col items-center py-5 gap-2 shrink-0 sidebar-island relative z-40">
        <NavContent />
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
      </aside>
    </>
  );
}
