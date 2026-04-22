"use client";

import { useCallback, useRef, useState } from "react";
import { UploadIcon } from "./Icons";

interface FileDropzoneProps {
  accept?: string;
  onChange: (file: File | null) => void;
  file: File | null;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

export function FileDropzone({
  accept = "audio/*,video/*",
  onChange,
  file,
  label = "Drop a file or click to browse",
  hint = "MP3, WAV, MP4, M4A, WebM, etc.",
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onChange(f);
    },
    [onChange, disabled]
  );

  const fmt = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`
        relative rounded-2xl border border-dashed transition-all cursor-pointer overflow-hidden
        ${dragActive ? "border-violet-400/60 bg-violet-500/10" : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-4 p-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/25 to-blue-500/25 border border-white/10 flex items-center justify-center text-white/80">
          <UploadIcon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <div className="font-medium text-white/90 truncate">{file.name}</div>
              <div className="text-xs text-white/50 mt-0.5">
                {fmt(file.size)} · {file.type || "unknown"}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-white/85">{label}</div>
              <div className="text-xs text-white/50 mt-0.5">{hint}</div>
            </>
          )}
        </div>
        {file && (
          <button
            className="btn btn-secondary btn-icon"
            onClick={e => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
