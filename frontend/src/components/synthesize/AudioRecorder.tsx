"use client";

import { useEffect, useRef, useState } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { WaveformVisualizer } from "../shared/WaveformVisualizer";
import { MicIcon, StopIcon, UploadIcon, TrashIcon } from "../shared/Icons";

interface AudioRecorderProps {
  value: Blob | null;
  onChange: (blob: Blob | null, filename?: string) => void;
  disabled?: boolean;
}

export function AudioRecorder({ value, onChange, disabled }: AudioRecorderProps) {
  const rec = useRecorder();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Sync recorder blob → parent
  useEffect(() => {
    if (rec.state === "recorded" && rec.blob) {
      onChange(rec.blob, "recording.webm");
    }
  }, [rec.state, rec.blob, onChange]);

  // Create playback URL when value changes
  useEffect(() => {
    if (!value) {
      setPlaybackUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPlaybackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    setUploadedName(file.name);
    onChange(file, file.name);
    rec.reset();
  };

  const clear = () => {
    onChange(null);
    rec.reset();
    setUploadedName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const elapsedSec = (rec.elapsed / 1000).toFixed(1);
  const isRecording = rec.state === "recording";

  return (
    <div className="space-y-3">
      <div className="glass-card p-5 flex flex-col items-center">
        <WaveformVisualizer
          mode={isRecording ? "recording" : value ? "active" : "idle"}
          amplitude={rec.amplitude}
        />
        {isRecording && (
          <div className="mt-2 font-mono text-sm text-red-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {elapsedSec}s recording
          </div>
        )}
        {!isRecording && value && (
          <div className="mt-2 text-xs text-white/50 truncate max-w-[90%]">
            {uploadedName || "Recorded clip"} · {(value.size / 1024).toFixed(0)} KB
          </div>
        )}
        {!isRecording && !value && (
          <div className="mt-2 text-xs text-white/40">No audio yet — record or upload below</div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isRecording ? (
          <button
            className={`btn ${value ? "btn-secondary" : "btn-primary"} flex-1 min-w-[120px]`}
            onClick={rec.start}
            disabled={disabled}
          >
            <MicIcon size={16} />
            {value ? "Record new" : "Record"}
          </button>
        ) : (
          <button
            className="btn btn-danger flex-1 min-w-[120px] animate-recording-pulse"
            onClick={rec.stop}
          >
            <StopIcon size={16} />
            Stop
          </button>
        )}

        <label className={`btn btn-secondary flex-1 min-w-[120px] ${(isRecording || disabled) ? "opacity-50 pointer-events-none" : ""}`}>
          <UploadIcon size={16} />
          Upload
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => handleUpload(e.target.files?.[0])}
            disabled={isRecording || disabled}
          />
        </label>

        {value && !isRecording && (
          <button className="btn btn-secondary btn-icon" onClick={clear} disabled={disabled}>
            <TrashIcon size={16} />
          </button>
        )}
      </div>

      {playbackUrl && !isRecording && (
        <audio
          src={playbackUrl}
          controls
          className="w-full h-10 rounded-lg [&::-webkit-media-controls-panel]:bg-white/5"
          style={{ filter: "invert(0.9) hue-rotate(180deg)" }}
        />
      )}

      {rec.error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {rec.error}
        </div>
      )}
    </div>
  );
}
