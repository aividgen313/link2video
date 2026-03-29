"use client";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const roundedStyles = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export default function Skeleton({ width, height, rounded = "md", className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${roundedStyles[rounded]} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}
