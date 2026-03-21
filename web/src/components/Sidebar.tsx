"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/", icon: "dashboard", label: "Home" },
    { href: "/assets", icon: "folder_open", label: "Assets" },
    { href: "/story", icon: "auto_awesome_motion", label: "Stories" },
    { href: "/script", icon: "edit_note", label: "Script" },
    { href: "/generate", icon: "movie", label: "Generate" },
  ];

  return (
    <aside className="w-[72px] bg-surface-container-lowest flex flex-col items-center border-r border-outline-variant/10 py-6 gap-2">
      {/* Logo */}
      <button
        onClick={() => router.push("/")}
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
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 mt-2">
          <img
            alt="User"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQsfKVpfeRfxoCQlU-HMh_xTyCd8PqIuYBnaUg4tOs01Lt7sp1XZ5P2jopCyS8OtFcNjqJUY4Ok9jwONbhSs7X8yhTRGFkAOK-A_B0FiylZSt4DmOpDg-r5qyflA10xjP1fDdtDglyxOSGYmI1NtZhp2uP0j91ssrwnmkSw9vv3-qFas_L3d9hwv-2rCeDkvEJ6i-7Xtpxx98TyaOI3Y5BynkLgxDssWKw5JYCv2UUd0plZaUbbITMkwr6rkwQgCCV9eZy8zpoZEr2"
          />
        </div>
      </div>
    </aside>
  );
}
