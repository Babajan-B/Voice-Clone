"use client";

import { ReactNode } from "react";
import { useStatus } from "@/hooks/useStatus";
import { api } from "@/lib/api";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute top-20 -right-32 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <Header />
        {children}
      </div>
    </div>
  );
}

function Header() {
  const status = useStatus(4000);
  const connected = status != null;
  const loaded = connected && (status!.tts_loaded || status!.asr_loaded);

  const dotColor = !connected
    ? "bg-red-400"
    : loaded
    ? "bg-violet-400"
    : "bg-emerald-400";

  const label = !connected
    ? "offline"
    : status!.tts_loaded
    ? "TTS loaded"
    : status!.asr_loaded
    ? `ASR (${status!.asr_model_size})`
    : `idle · ${status!.device}`;

  return (
    <header className="flex items-center justify-between mb-10 gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 border border-white/15 shadow-[0_8px_32px_-8px_rgba(124,58,237,0.6)] flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M19 11a7 7 0 0 1-14 0" />
            <path d="M12 19v3" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white/95 truncate">
            Voice <span className="text-gradient">Clone</span>
          </h1>
          <p className="text-xs text-white/45 truncate">
            Local AI voice studio · Qwen3-TTS + faster-whisper
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 text-[11px] font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-full"
          title={status ? JSON.stringify(status, null, 2) : "not connected"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${connected ? "animate-pulse" : ""}`} />
          <span className="text-white/70">{label}</span>
          {status?.rss_mb != null && (
            <span className="text-white/40 ml-1">· {status.rss_mb.toFixed(0)} MB</span>
          )}
        </div>
        {loaded && (
          <button
            onClick={() => api.unload()}
            className="text-[11px] text-white/50 hover:text-white/80 transition-colors px-2 py-1"
            title="Unload all models to free memory"
          >
            Unload
          </button>
        )}
      </div>
    </header>
  );
}
