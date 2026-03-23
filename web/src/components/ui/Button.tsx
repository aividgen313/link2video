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
    "primary-gradient text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110",
  secondary:
    "glass-card text-on-surface hover:border-primary/30",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container-high",
  danger:
    "bg-error/10 text-error border border-error/20 hover:bg-error/20",
  glass:
    "glass text-on-surface hover:bg-white/[0.06]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
  icon: "h-10 w-10 rounded-xl justify-center",
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
