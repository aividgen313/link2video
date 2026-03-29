"use client";
import React from "react";

interface AIActionButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "tertiary" | "emerald";
  className?: string;
}

export default function AIActionButton({
  label,
  icon,
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  className = ""
}: AIActionButtonProps) {
  
  const variantStyles = {
    primary: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/40",
    secondary: "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:border-white/20",
    tertiary: "bg-tertiary/10 text-tertiary border-tertiary/20 hover:bg-tertiary/20 hover:border-tertiary/40",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl 
        border transition-all duration-300 group overflow-hidden
        disabled:opacity-40 disabled:pointer-events-none
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {/* Animated Shimmer Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
      
      {/* Glow Effect on Hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-current pointer-events-none blur-2xl" style={{ opacity: 0.03 }} />

      {loading ? (
        <div className="w-5 h-5 relative flex items-center justify-center">
             <div className="absolute inset-0 border-2 border-current/20 rounded-full" />
             <div className="absolute inset-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform duration-300">
          {icon}
        </span>
      )}
      
      <span className="text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors">
        {label}
      </span>

      {/* Subtle border bottom highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-current opacity-0 group-hover:opacity-30 transition-opacity" />
    </button>
  );
}
