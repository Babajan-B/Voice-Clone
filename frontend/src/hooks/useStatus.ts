"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SystemStatus } from "@/types";

export function useStatus(pollMs: number = 5000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const s = await api.getStatus();
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus(null);
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return status;
}
