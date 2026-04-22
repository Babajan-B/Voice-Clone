export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const ASR_MODEL_CHOICES = [
  "tiny",
  "base",
  "small",
  "medium",
  "large-v3",
  "turbo",
] as const;

export const ASR_LANGUAGE_CHOICES = [
  { code: "Auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
] as const;

export type AsrModelSize = (typeof ASR_MODEL_CHOICES)[number];

export const EMOTION_CHOICES = [
  { value: "neutral", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "excited", label: "Excited" },
  { value: "calm", label: "Calm" },
  { value: "serious", label: "Serious" },
  { value: "whisper", label: "Whisper" },
] as const;

export type Emotion = (typeof EMOTION_CHOICES)[number]["value"];

export interface VoiceControls {
  emotion: Emotion;
  speed: number;
  pitch: number;
}

export const DEFAULT_VOICE_CONTROLS: VoiceControls = {
  emotion: "neutral",
  speed: 1.0,
  pitch: 0,
};
