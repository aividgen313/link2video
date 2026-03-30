"use client";
import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import Icon from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glass";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-sm shadow-[#1877F2]/30 hover:shadow-[#166FE5]/40",
  secondary:
    "glass-card text-on-surface border border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25",
  ghost:
    "bg-transparent text-on-surface hover:bg-black/5 dark:hover:bg-white/8",
  danger:
    "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-400/30 hover:bg-red-500/20",
  glass:
    "glass text-on-surface hover:brightness-105",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-4 text-xs gap-1.5 rounded-full",
  md: "h-10 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-6 text-base gap-2.5 rounded-full",
  icon: "h-10 w-10 rounded-full justify-center",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, iconRight, loading, children, className = "", disabled, ...props }, ref) => {
    const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center font-medium
          transition-all duration-200 ease-out
          press-scale
          disabled:opacity-40 disabled:pointer-events-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : icon ? (
          <Icon name={icon} size={iconSize} />
        ) : null}
        {children}
        {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
