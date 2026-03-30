"use client";

interface ProgressProps {
  value: number; // 0-100
  variant?: "primary" | "success" | "error";
  size?: "sm" | "md" | "lg";
  label?: string;
  showPercent?: boolean;
  className?: string;
  animated?: boolean;
}

const barColors = {
  primary: "from-primary to-tertiary",
  success: "from-green-500 to-emerald-400",
  error: "from-red-500 to-rose-400",
};

const trackSizes = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export default function Progress({
  value,
  variant = "primary",
  size = "md",
  label,
  showPercent,
  className = "",
  animated = true,
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-on-surface-variant">{label}</span>}
          {showPercent && <span className="text-xs font-medium text-on-surface tabular-nums">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className={`w-full ${trackSizes[size]} bg-surface-container-high rounded-full overflow-hidden`}>
        <div
          className={`
            h-full rounded-full bg-gradient-to-r ${barColors[variant]}
            ${animated ? "transition-all duration-500 ease-out" : ""}
          `}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
