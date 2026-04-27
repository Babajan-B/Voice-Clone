export interface Voice {
  name: string;
  transcript: string;
  audio_url: string;
}

export interface VoiceListResponse {
  voices: string[];
}

export interface WhisperWord {
  start: number;
  end: number;
  word: string;
  probability: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

export interface SSEProgressEvent {
  type: "progress";
  value: number;
  desc: string;
}

export interface SSEResultEvent {
  type: "result";
  audio_b64?: string;
  sample_rate?: number;
  duration?: number;
  transcript?: string;
  language?: string;
  language_probability?: number;
  segment_count?: number;
  segments?: WhisperSegment[];
  compute_type?: string;
  chunk_count?: number;
  history_id?: string;
  transcribe_only?: boolean;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
  hint?: string;
}

export interface SSEDoneEvent {
  type: "done";
}

export type SSEEvent = SSEProgressEvent | SSEResultEvent | SSEErrorEvent | SSEDoneEvent;

export type TabKey = "voices" | "synthesize" | "transcribe" | "convert" | "history" | "studio";

export type RecorderState = "idle" | "recording" | "recorded";

export interface HistoryItem {
  id: string;
  kind: "synthesize" | "convert";
  created_at: number;
  created_at_iso: string;
  voice_name: string | null;
  text: string;
  source_filename: string | null;
  emotion: string;
  speed: number;
  pitch: number;
  duration: number | null;
  sample_rate: number;
  audio_url: string;
}

export interface SystemStatus {
  device: string;
  asr_device: string;
  tts_loaded: boolean;
  asr_loaded: boolean;
  asr_model_size: string | null;
  asr_compute_type: string | null;
  locked: boolean;
  rss_mb: number | null;
}
