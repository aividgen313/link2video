"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNewProject = () => {
    router.push("/");
  };

  return (
    <aside className="w-64 bg-surface-container-low flex flex-col border-r border-outline-variant/10">
      <div className="p-8 flex flex-col gap-1">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container">auto_awesome</span>
          </div>
          <div>
            <h1 className="font-headline font-bold text-on-surface leading-tight">Link2Video AI</h1>
            <p className="text-xs font-label text-outline uppercase tracking-widest">Creator Studio</p>
          </div>
        </div>
        <button
          onClick={handleNewProject}
          className="primary-gradient text-on-primary-container font-headline font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-10 shadow-lg shadow-primary-container/20 transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <span className="material-symbols-outlined">add</span>
          New Project
        </button>
        <nav className="space-y-2">
          <Link
            href="/"
            className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
              pathname === "/"
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-variant/50"
            }`}>
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            Dashboard
          </Link>
          <Link
            href="/assets"
            className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
              pathname === "/assets"
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-variant/50"
            }`}>
            <span className="material-symbols-outlined" data-icon="folder_open">folder_open</span>
            Assets
          </Link>
          <Link
            href="/story"
            className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
              pathname === "/story"
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-variant/50"
            }`}>
            <span className="material-symbols-outlined" data-icon="auto_awesome_motion">auto_awesome_motion</span>
            Story Angles
          </Link>
          <Link
            href="/script"
            className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
              pathname === "/script"
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-variant/50"
            }`}>
            <span className="material-symbols-outlined" data-icon="edit_note">edit_note</span>
            Script Editor
          </Link>
          <Link
            href="/generate"
            className={`flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
              pathname === "/generate"
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-variant/50"
            }`}>
            <span className="material-symbols-outlined" data-icon="video_library">video_library</span>
            Video Generation
          </Link>
        </nav>
      </div>
    </aside>
  );
}
