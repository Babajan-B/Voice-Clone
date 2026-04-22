"use client";

import { RefreshIcon, TrashIcon, UserIcon } from "../shared/Icons";

interface VoiceSelectorProps {
  voices: string[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onRefresh: () => void;
  onDelete?: (name: string) => void;
  loading?: boolean;
  label?: string;
  showDelete?: boolean;
}

export function VoiceSelector({
  voices,
  selected,
  onSelect,
  onRefresh,
  onDelete,
  loading,
  label = "Saved voice profile",
  showDelete = true,
}: VoiceSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>
      <div className="flex gap-2 items-stretch">
        <div className="relative flex-1">
          <UserIcon
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <select
            className="glass-input appearance-none pl-9 pr-10 cursor-pointer"
            value={selected ?? ""}
            onChange={e => onSelect(e.target.value || null)}
            disabled={loading}
          >
            <option value="" className="bg-[#0a0a0f]">— none —</option>
            {voices.map(v => (
              <option key={v} value={v} className="bg-[#0a0a0f]">
                {v}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={onRefresh} disabled={loading} aria-label="Refresh">
          <RefreshIcon size={16} className={loading ? "animate-spin" : ""} />
        </button>
        {showDelete && selected && onDelete && (
          <button
            className="btn btn-danger btn-icon"
            onClick={() => selected && onDelete(selected)}
            aria-label="Delete"
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
