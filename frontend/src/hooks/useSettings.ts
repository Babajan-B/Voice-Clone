"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VOICE_CONTROLS, type AsrModelSize, type VoiceControls } from "@/lib/constants";

export interface Settings {
  asrModel: AsrModelSize;
  asrLang: string;
  voiceControls: VoiceControls;
  saveHistory: boolean;
  reviewTranscript: boolean;
}

const DEFAULTS: Settings = {
  asrModel: "base",
  asrLang: "Auto",
  voiceControls: DEFAULT_VOICE_CONTROLS,
  saveHistory: true,
  reviewTranscript: false,
};

const STORAGE_KEY = "voice-clone-settings-v1";

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, voiceControls: { ...DEFAULTS.voiceControls, ...(parsed.voiceControls || {}) } };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(load());
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSettings(DEFAULTS);
  }, []);

  return { settings, update, reset };
}
