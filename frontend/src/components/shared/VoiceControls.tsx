"use client";

import { useState } from "react";
import {
  EMOTION_CHOICES,
  DEFAULT_VOICE_CONTROLS,
  type VoiceControls as VC,
  type Emotion,
} from "@/lib/constants";
import { WandIcon, ChevronDownIcon } from "./Icons";

interface VoiceControlsProps {
  value: VC;
  onChange: (v: VC) => void;
  disabled?: boolean;
}

export function VoiceControls({ value, onChange, disabled }: VoiceControlsProps) {
  const [open, setOpen] = useState(false);

  const isModified =
    value.emotion !== DEFAULT_VOICE_CONTROLS.emotion ||
    value.speed !== DEFAULT_VOICE_CONTROLS.speed ||
    value.pitch !== DEFAULT_VOICE_CONTROLS.pitch;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 text-sm text-white/80">
          <WandIcon size={14} />
          Voice controls
          {isModified && (
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-400/30">
              modified
            </span>
          )}
        </span>
        <span
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <ChevronDownIcon size={14} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/5">
          {/* Emotion */}
          <div>
            <label className="text-[11px] font-medium text-white/50 uppercase tracking-wide">
              Emotion
            </label>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {EMOTION_CHOICES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, emotion: opt.value as Emotion })}
                  className={`
                    text-xs py-1.5 rounded-lg border transition-all
                    ${value.emotion === opt.value
                      ? "bg-violet-500/20 border-violet-400/50 text-white"
                      : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white/80"}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wide">
                Speed
              </label>
              <span className="text-xs font-mono text-white/70">
                {value.speed.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={value.speed}
              disabled={disabled}
              onChange={e => onChange({ ...value, speed: parseFloat(e.target.value) })}
              className="mt-1.5 w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
              <span>0.5× (slow)</span>
              <span>1×</span>
              <span>2× (fast)</span>
            </div>
          </div>

          {/* Pitch */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wide">
                Pitch
              </label>
              <span className="text-xs font-mono text-white/70">
                {value.pitch > 0 ? "+" : ""}{value.pitch} semitones
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={value.pitch}
              disabled={disabled}
              onChange={e => onChange({ ...value, pitch: parseInt(e.target.value, 10) })}
              className="mt-1.5 w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
              <span>-12 (lower)</span>
              <span>0</span>
              <span>+12 (higher)</span>
            </div>
          </div>

          {isModified && (
            <button
              type="button"
              className="text-[11px] text-white/50 hover:text-white/80 transition-colors"
              onClick={() => onChange(DEFAULT_VOICE_CONTROLS)}
              disabled={disabled}
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
