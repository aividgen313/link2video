"use client";
import React, { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export default function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-block group" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      {isVisible && content && (
        <div 
          className={`absolute z-[200] px-2 py-1 text-[10px] font-bold text-white bg-zinc-900 border border-white/10 rounded shadow-xl whitespace-nowrap pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95 ${positionClasses[position]}`}
          style={{ 
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
          }}
        >
          {content}
          {/* Arrow */}
          <div 
            className={`absolute w-1.5 h-1.5 bg-zinc-900 border-inherit rotate-45 ${
              position === "top" ? "top-full -translate-y-1/2 left-1/2 -translate-x-1/2 border-t-0 border-l-0" :
              position === "bottom" ? "bottom-full translate-y-1/2 left-1/2 -translate-x-1/2 border-b-0 border-r-0" :
              position === "left" ? "left-full -translate-x-1/2 top-1/2 -translate-y-1/2 border-t-0 border-r-0" :
              "right-full translate-x-1/2 top-1/2 -translate-y-1/2 border-b-0 border-l-0"
            }`} 
          />
        </div>
      )}
    </div>
  );
}
