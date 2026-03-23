"use client";
import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import Icon from "./Icon";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  suffix?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, suffix, error, className = "", ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
            <Icon name={icon} size={18} filled={false} />
          </span>
        )}
        <input
          ref={ref}
          className={`
            w-full h-10 bg-surface-container/60 text-on-surface
            border border-outline-variant/30 rounded-xl
            px-3 ${icon ? "pl-10" : ""} ${suffix ? "pr-10" : ""}
            text-sm placeholder:text-on-surface-variant/40
            focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40
            transition-all duration-200
            ${error ? "border-error/60 focus:ring-error/40" : ""}
            ${className}
          `}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </span>
        )}
        {error && (
          <p className="mt-1 text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <div>
        <textarea
          ref={ref}
          className={`
            w-full bg-surface-container/60 text-on-surface
            border border-outline-variant/30 rounded-xl
            px-3 py-2.5 text-sm placeholder:text-on-surface-variant/40
            focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40
            transition-all duration-200 resize-none
            ${error ? "border-error/60 focus:ring-error/40" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export default Input;
