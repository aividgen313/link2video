"use client";
import { useAppContext, ExtractProgress, SynthesizeProgress } from "@/context/AppContext";

function TaskToast({
  icon,
  label,
  sub,
  percent,
  state,
}: {
  icon: string;
  label: string;
  sub: string;
  percent?: number;
  state: string;
}) {
  const isError = state === "error";
  const isDone = state === "complete";
  const accent = isError ? "#EF4444" : isDone ? "#10B981" : "var(--np-blue, #3B82F6)";
  const bg = isError ? "#3B0000" : isDone ? "#002B1E" : "#0D1B2A";

  return (
    <div
      className="flex flex-col gap-1.5 p-3 rounded-xl shadow-2xl border"
      style={{
        background: bg,
        borderColor: accent + "44",
        minWidth: 240,
        maxWidth: 300,
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px]" style={{ color: accent }}>
          {isError ? "error" : isDone ? "check_circle" : icon}
        </span>
        <span className="text-[12px] font-bold text-white">{label}</span>
        {!isDone && !isError && (
          <div
            className="ml-auto w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
            style={{ borderColor: accent + "44", borderTopColor: accent }}
          />
        )}
      </div>

      {sub && (
        <p className="text-[11px] truncate" style={{ color: "#94A3B8" }}>
          {sub}
        </p>
      )}

      {typeof percent === "number" && (
        <div className="mt-1">
          <div className="flex justify-between mb-0.5">
            <span className="text-[10px] font-mono" style={{ color: accent }}>
              {Math.round(percent)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1E293B" }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${percent}%`,
                background: `linear-gradient(to right, ${accent}88, ${accent})`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function GlobalBackgroundTasks() {
  const { extractProgress, synthesizeProgress } = useAppContext();

  const showExtract = extractProgress.state !== "idle";
  const showSynthesize = synthesizeProgress.state !== "idle";

  if (!showExtract && !showSynthesize) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
    >
      {showExtract && (
        <TaskToast
          icon="auto_awesome"
          label={
            extractProgress.state === "complete"
              ? "Extraction Complete"
              : extractProgress.state === "error"
              ? "Extraction Failed"
              : `Extracting ${extractProgress.done}/${extractProgress.total}`
          }
          sub={
            extractProgress.state === "running"
              ? `Processing: ${extractProgress.currentTitle}`
              : extractProgress.error || ""
          }
          percent={
            extractProgress.total > 0
              ? Math.round((extractProgress.done / extractProgress.total) * 100)
              : undefined
          }
          state={extractProgress.state}
        />
      )}

      {showSynthesize && (
        <TaskToast
          icon="psychology"
          label={
            synthesizeProgress.state === "complete"
              ? "Synthesis Complete"
              : synthesizeProgress.state === "error"
              ? "Synthesis Failed"
              : "Synthesizing Knowledge…"
          }
          sub={synthesizeProgress.error || "Cinematic Director is analyzing your sources"}
          percent={synthesizeProgress.percent}
          state={synthesizeProgress.state}
        />
      )}
    </div>
  );
}
