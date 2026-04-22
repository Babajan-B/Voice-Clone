"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useVoices() {
  const [voices, setVoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listVoices();
      setVoices(res.voices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load voices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { voices, loading, error, refresh, setVoices };
}
