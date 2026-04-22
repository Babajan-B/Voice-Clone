"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { HistoryItem } from "@/types";
import { GlassCard } from "../shared/GlassCard";
import { AudioPlayer } from "../shared/AudioPlayer";
import { StatusMessage } from "../shared/StatusMessage";
import { HistoryIcon, TrashIcon, RefreshIcon, SparkleIcon, SwitchIcon } from "../shared/Icons";

type Filter = "all" | "synthesize" | "convert";

export function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await api.listHistory();
      setItems(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.kind === filter);
  }, [items, filter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this generation? This cannot be undone.")) return;
    try {
      await api.deleteHistory(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleClear = async () => {
    if (!confirm(`Delete all ${items.length} entries? This cannot be undone.`)) return;
    try {
      await api.clearHistory();
      setItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    }
  };

  return (
    <div className="animate-fade-in">
      <GlassCard
        title="Generation History"
        subtitle={`${items.length} saved · Newest first`}
        icon={<HistoryIcon />}
        actions={
          <>
            <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
              <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            {items.length > 0 && (
              <button className="btn btn-danger" onClick={handleClear}>
                <TrashIcon size={14} />
                Clear all
              </button>
            )}
          </>
        }
      >
        <div className="flex gap-2 mb-4">
          {(["all", "synthesize", "convert"] as Filter[]).map(f => (
            <button
              key={f}
              className={`px-3 py-1 rounded-lg text-xs transition-all ${
                filter === f
                  ? "bg-violet-500/20 border-violet-400/50 border text-white"
                  : "bg-white/[0.03] border border-white/10 text-white/60 hover:bg-white/[0.06]"
              }`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "synthesize" ? "Synthesize" : "Convert"}
            </button>
          ))}
        </div>

        {error && <StatusMessage message={error} variant="error" />}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/40">
            {loading ? "Loading..." : "No generations yet. Synthesize or convert some audio."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <HistoryRow key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function HistoryRow({ item, onDelete }: { item: HistoryItem; onDelete: (id: string) => void }) {
  const kindStyle =
    item.kind === "synthesize"
      ? "bg-violet-500/15 border-violet-400/30 text-violet-200"
      : "bg-blue-500/15 border-blue-400/30 text-blue-200";

  const Icon = item.kind === "synthesize" ? SparkleIcon : SwitchIcon;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className={`px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase flex items-center gap-1 ${kindStyle}`}>
          <Icon size={10} />
          {item.kind}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white/90 font-medium">
            {item.voice_name || "(unknown voice)"}
          </div>
          <div className="text-[11px] text-white/40 font-mono">
            {item.created_at_iso} · {item.duration?.toFixed(1)}s · {item.sample_rate} Hz
            {item.emotion !== "neutral" && <> · {item.emotion}</>}
            {item.speed !== 1 && <> · {item.speed.toFixed(2)}×</>}
            {item.pitch !== 0 && <> · {item.pitch > 0 ? "+" : ""}{item.pitch}st</>}
          </div>
        </div>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => onDelete(item.id)}
          aria-label="Delete"
        >
          <TrashIcon size={14} />
        </button>
      </div>

      <div className="text-xs text-white/60 bg-white/[0.03] rounded-lg px-3 py-2 mb-3 line-clamp-3">
        {item.text || "(no text)"}
      </div>

      <AudioPlayer src={item.audio_url} downloadName={`${item.id}.wav`} />
    </div>
  );
}
