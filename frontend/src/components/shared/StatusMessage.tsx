"use client";

import { AlertIcon, CheckIcon } from "./Icons";

type Variant = "success" | "error" | "info";

interface StatusMessageProps {
  message: string;
  hint?: string;
  code?: string;
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  error:   "border-red-400/30 bg-red-400/10 text-red-200",
  info:    "border-blue-400/30 bg-blue-400/10 text-blue-200",
};

export function StatusMessage({ message, hint, code, variant = "info" }: StatusMessageProps) {
  if (!message) return null;
  return (
    <div
      className={`animate-fade-in flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${variantStyles[variant]}`}
    >
      <span className="mt-0.5 shrink-0">
        {variant === "success" ? <CheckIcon /> : <AlertIcon />}
      </span>
      <div className="leading-snug break-words min-w-0">
        <div>{message}</div>
        {hint && <div className="mt-1 text-xs opacity-80">{hint}</div>}
        {code && <div className="mt-1 text-[10px] font-mono opacity-50">{code}</div>}
      </div>
    </div>
  );
}
