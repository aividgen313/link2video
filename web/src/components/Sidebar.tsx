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
    { href: "/assets", icon: "folder_open", label: "Assets" },
    { href: "/story", icon: "auto_awesome_motion", label: "Stories" },
    { href: "/script", icon: "edit_note", label: "Script" },
    { href: "/generate", icon: "movie", label: "Generate" },
  ];

  const NavContent = () => (
    <>
      {/* Logo */}
      <button
        onClick={() => { router.push("/"); setMobileOpen(false); }}
        className="w-11 h-11 rounded-2xl primary-gradient flex items-center justify-center mb-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
      >
        <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
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
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-outline hover:text-on-surface hover:bg-surface-variant/50"
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <span className="absolute -left-[5px] w-[3px] h-5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <button
          title="Settings"
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all"
        >
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 mt-2 flex items-center justify-center bg-primary/10">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[72px] bg-surface-container-lowest flex-col items-center border-r border-outline-variant/10 py-6 gap-2 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-surface/95 backdrop-blur-xl border-b border-outline-variant/10 flex items-center justify-between px-4">
        <button
          onClick={() => { router.push("/"); }}
          className="w-9 h-9 rounded-xl primary-gradient flex items-center justify-center shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>
        <span className="font-headline font-bold text-on-surface">Link2Video</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant/50 transition-all"
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
      <aside className={`md:hidden fixed top-14 left-0 bottom-0 z-30 w-64 bg-surface-container-lowest border-r border-outline-variant/10 py-6 px-4 flex flex-col gap-2 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-outline hover:text-on-surface hover:bg-surface-variant/50"
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
