"use client";
import { HTMLAttributes, forwardRef, ReactNode } from "react";

type CardVariant = "glass" | "elevated" | "subtle" | "solid";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  glass: "glass-card",
  elevated: "glass-elevated",
  subtle: "glass-subtle",
  solid: "bg-surface-container border border-outline-variant/20",
};

const paddingStyles: Record<string, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-8",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "glass", hover = false, padding = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-[32px]
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hover ? "hover-lift cursor-pointer" : ""}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
