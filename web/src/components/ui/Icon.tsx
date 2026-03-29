"use client";
import { memo } from "react";

interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
  onClick?: () => void;
}

const Icon = memo(function Icon({ name, size = 24, filled = true, className = "", onClick }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {name}
    </span>
  );
});

export default Icon;
