import { API_BASE } from "./constants";
import type {
  Voice,
  VoiceListResponse,
  SSEEvent,
  HistoryItem,
  SystemStatus,
  WhisperSegment,
} from "@/types";

export const api = {
  base: API_BASE,

  async listVoices(): Promise<VoiceListResponse> {
    const r = await fetch(`${API_BASE}/api/voices`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listVoices failed: ${r.status}`);
    return r.json();
  },

  async getVoice(name: string): Promise<Voice> {
    const r = await fetch(`${API_BASE}/api/voices/${encodeURIComponent(name)}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`getVoice failed: ${r.status}`);
    const data = await r.json();
    return { ...data, audio_url: `${API_BASE}${data.audio_url}` };
  },

  async saveVoice(form: FormData): Promise<VoiceListResponse> {
    const r = await fetch(`${API_BASE}/api/voices`, { method: "POST", body: form });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(text || `saveVoice failed: ${r.status}`);
    }
    return r.json();
  },

  async deleteVoice(name: string): Promise<VoiceListResponse> {
    const r = await fetch(`${API_BASE}/api/voices/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteVoice failed: ${r.status}`);
    return r.json();
  },

  async listHistory(): Promise<{ items: HistoryItem[] }> {
    const r = await fetch(`${API_BASE}/api/history`, { cache: "no-store" });
    if (!r.ok) throw new Error(`listHistory failed: ${r.status}`);
    const data = await r.json();
    return {
      items: (data.items || []).map((m: HistoryItem) => ({
        ...m,
        audio_url: m.audio_url.startsWith("http") ? m.audio_url : `${API_BASE}${m.audio_url}`,
      })),
    };
  },

  async deleteHistory(id: string): Promise<void> {
    const r = await fetch(`${API_BASE}/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`deleteHistory failed: ${r.status}`);
  },

  async clearHistory(): Promise<void> {
    const r = await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
    if (!r.ok) throw new Error(`clearHistory failed: ${r.status}`);
  },

  async getStatus(): Promise<SystemStatus> {
    const r = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
    if (!r.ok) throw new Error(`status failed: ${r.status}`);
    return r.json();
  },

  async downloadSubtitle(format: "srt" | "vtt", segments: WhisperSegment[]): Promise<Blob> {
    const r = await fetch(`${API_BASE}/api/subtitles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, segments }),
    });
    if (!r.ok) throw new Error(`subtitle failed: ${r.status}`);
    return r.blob();
  },

  async unload(): Promise<void> {
    await fetch(`${API_BASE}/api/unload`, { method: "POST" });
  },

  transcribeUrl: `${API_BASE}/api/transcribe`,
  generateUrl: `${API_BASE}/api/generate`,
  convertUrl: `${API_BASE}/api/convert`,
  convertFinalizeUrl: `${API_BASE}/api/convert/finalize`,
};

export async function streamSSE(
  url: string,
  body: FormData,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, { method: "POST", body, signal });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed: ${response.status}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = line.slice(6).trim();
        if (json) {
          try {
            onEvent(JSON.parse(json) as SSEEvent);
          } catch (e) {
            console.error("Failed to parse SSE event:", json, e);
          }
        }
      }
    }
  }
}

export function audioB64ToBlobUrl(b64: string, mime = "audio/wav"): string {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
