"use client";

interface ModelSelectProps<T extends string> {
  label?: string;
  value: T;
  options: readonly T[] | readonly { code: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function ModelSelect<T extends string>({ label, value, options, onChange, disabled }: ModelSelectProps<T>) {
  const normalized = (options as readonly (T | { code: T; label: string })[]).map(o =>
    typeof o === "string" ? { code: o, label: o } : o
  );
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>}
      <div className="relative">
        <select
          className="glass-input appearance-none pr-10 cursor-pointer"
          value={value}
          onChange={e => onChange(e.target.value as T)}
          disabled={disabled}
        >
          {normalized.map(o => (
            <option key={o.code} value={o.code} className="bg-[#0a0a0f]">
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </label>
  );
}
