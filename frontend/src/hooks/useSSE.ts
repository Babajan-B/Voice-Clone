"use client";

import { useCallback, useRef, useState } from "react";
import { streamSSE } from "@/lib/api";
import type { SSEEvent, SSEResultEvent } from "@/types";

export interface SSEErrorInfo {
  message: string;
  code?: string;
  hint?: string;
}

export interface UseSSEResult {
  isRunning: boolean;
  progress: number;
  desc: string;
  error: SSEErrorInfo | null;
  result: SSEResultEvent | null;
  run: (url: string, body: FormData) => Promise<SSEResultEvent | null>;
  cancel: () => void;
  reset: () => void;
}

export function useSSE(): UseSSEResult {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<SSEErrorInfo | null>(null);
  const [result, setResult] = useState<SSEResultEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setDesc("");
    setError(null);
    setResult(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  }, []);

  const run = useCallback(async (url: string, body: FormData): Promise<SSEResultEvent | null> => {
    reset();
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let finalResult: SSEResultEvent | null = null;
    let streamError: SSEErrorInfo | null = null;

    try {
      await streamSSE(
        url,
        body,
        (event: SSEEvent) => {
          switch (event.type) {
            case "progress":
              setProgress(event.value);
              setDesc(event.desc);
              break;
            case "result":
              finalResult = event;
              setResult(event);
              break;
            case "error":
              streamError = { message: event.message, code: event.code, hint: event.hint };
              setError(streamError);
              break;
            case "done":
              break;
          }
        },
        controller.signal
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const msg = e instanceof Error ? e.message : "Stream failed";
        streamError = { message: msg };
        setError(streamError);
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
    }

    return streamError ? null : finalResult;
  }, [reset]);

  return { isRunning, progress, desc, error, result, run, cancel, reset };
}
