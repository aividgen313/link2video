export default function TopNav() {
  return (
    <header className="h-20 shrink-0 flex items-center justify-between px-12 border-b border-outline-variant/10 bg-surface/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center">
        <h2 className="font-headline font-bold text-2xl tracking-tight">Dashboard</h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-outline">
          <button className="hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
          </button>
          <button className="hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" data-icon="settings">settings</span>
          </button>
        </div>
        <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-outline-variant/30">
          <img alt="User Avatar" className="w-full h-full object-cover" data-alt="Close up portrait of a smiling man" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQsfKVpfeRfxoCQlU-HMh_xTyCd8PqIuYBnaUg4tOs01Lt7sp1XZ5P2jopCyS8OtFcNjqJUY4Ok9jwONbhSs7X8yhTRGFkAOK-A_B0FiylZSt4DmOpDg-r5qyflA10xjP1fDdtDglyxOSGYmI1NtZhp2uP0j91ssrwnmkSw9vv3-qFas_L3d9hwv-2rCeDkvEJ6i-7Xtpxx98TyaOI3Y5BynkLgxDssWKw5JYCv2UUd0plZaUbbITMkwr6rkwQgCCV9eZy8zpoZEr2" />
        </div>
      </div>
    </header>
  );
}
