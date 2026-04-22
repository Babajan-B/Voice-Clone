"use client";

interface ProgressBarProps {
  value: number; // 0-1
  desc?: string;
  active?: boolean;
}

export function ProgressBar({ value, desc, active = true }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="w-full animate-fade-in">
      <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${active ? "progress-shimmer" : "bg-gradient-to-r from-violet-500 to-blue-500"}`}
          style={{ width: `${pct}%`, transition: "width 300ms ease" }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-white/60 truncate">{desc ?? ""}</span>
        <span className="font-mono text-white/40">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
