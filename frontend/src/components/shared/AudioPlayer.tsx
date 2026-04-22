"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, PauseIcon, DownloadIcon } from "./Icons";

interface AudioPlayerProps {
  src: string | null;
  label?: string;
  showDownload?: boolean;
  downloadName?: string;
}

export function AudioPlayer({ src, label, showDownload = true, downloadName = "audio.wav" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.load();
    const onLoaded = () => setDuration(el.duration || 0);
    const onTime = () => setCurrent(el.currentTime);
    const onEnd = () => setPlaying(false);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    el.currentTime = pct * duration;
    setCurrent(el.currentTime);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const disabled = !src;

  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <button
        className="btn btn-primary btn-icon shrink-0"
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex-1 min-w-0">
        {label && <div className="text-xs text-white/50 mb-1 truncate">{label}</div>}
        <div
          className="h-2 rounded-full bg-white/10 relative cursor-pointer overflow-hidden"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-white/50">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {showDownload && src && (
        <a
          href={src}
          download={downloadName}
          className="btn btn-secondary btn-icon shrink-0"
          aria-label="Download"
        >
          <DownloadIcon />
        </a>
      )}

      <audio ref={audioRef} src={src ?? undefined} preload="metadata" />
    </div>
  );
}
