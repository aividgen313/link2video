export default function Sidebar() {
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
        <button className="primary-gradient text-on-primary-container font-headline font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-10 shadow-lg shadow-primary-container/20">
          <span className="material-symbols-outlined">add</span>
          New Project
        </button>
        <nav className="space-y-2">
          <a className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface-container-high text-primary font-medium" href="#">
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            Dashboard
          </a>
          <a className="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 transition-colors" href="#">
            <span className="material-symbols-outlined" data-icon="video_library">video_library</span>
            Projects
          </a>
          <a className="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 transition-colors" href="#">
            <span className="material-symbols-outlined" data-icon="auto_awesome_motion">auto_awesome_motion</span>
            Templates
          </a>
          <a className="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 transition-colors" href="#">
            <span className="material-symbols-outlined" data-icon="folder_open">folder_open</span>
            Assets
          </a>
        </nav>
      </div>
    </aside>
  );
}
