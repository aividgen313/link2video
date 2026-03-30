"use client";
import { ReactNode } from "react";

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary/15 text-primary border-primary/20",
  secondary: "bg-secondary/15 text-secondary border-secondary/20",
  success: "bg-green-500/15 text-green-400 border-green-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  error: "bg-error/15 text-error border-error/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export default function Badge({ variant = "primary", children, className = "", dot }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2 py-0.5 text-[11px] font-medium
        rounded-full border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current animate-gentle-pulse`} />
      )}
      {children}
    </span>
  );
}
