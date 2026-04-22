"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecorderState } from "@/types";

export interface UseRecorderResult {
  state: RecorderState;
  blob: Blob | null;
  error: string | null;
  elapsed: number; // ms
  amplitude: number; // 0-1 realtime volume
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [amplitude, setAmplitude] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Analyser for waveform visualization
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setAmplitude(Math.min(1, Math.sqrt(sum / data.length) * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // MediaRecorder
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(finalBlob);
        setState("recorded");
        cleanup();
      };
      mr.start();
      mediaRecorderRef.current = mr;

      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 100);
      setState("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to access microphone";
      setError(msg);
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setBlob(null);
    setError(null);
    setElapsed(0);
    setAmplitude(0);
    setState("idle");
  }, [cleanup]);

  return { state, blob, error, elapsed, amplitude, start, stop, reset };
}
