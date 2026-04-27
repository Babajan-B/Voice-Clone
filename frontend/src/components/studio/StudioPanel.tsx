"use client";

import { useEffect, useState } from "react";
import { useVoices } from "@/hooks/useVoices";
import { useSSE } from "@/hooks/useSSE";
import { api, audioB64ToBlobUrl, downloadBlob } from "@/lib/api";
import { GlassCard } from "../shared/GlassCard";
import { StatusMessage } from "../shared/StatusMessage";
import { AudioPlayer } from "../shared/AudioPlayer";
import { ProgressBar } from "../shared/ProgressBar";
import { VoiceSelector } from "../voice/VoiceSelector";
import { StudioIcon, PlusIcon, TrashIcon, DownloadIcon } from "../shared/Icons";

const FORMATS = [
  { value: "deep_dive", label: "Deep Dive" },
  { value: "brief",     label: "Brief" },
  { value: "critique",  label: "Critique" },
  { value: "debate",    label: "Debate" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "hi", label: "Hindi" },
  { value: "tr", label: "Turkish" },
  { value: "id", label: "Indonesian" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
];

export function StudioPanel() {
  const { voices, loading: voicesLoading, refresh: refreshVoices } = useVoices();
  const sse = useSSE();

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [sources, setSources] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState("");
  const [voice, setVoice] = useState<string | null>(null);
  const [format, setFormat] = useState("deep_dive");
  const [language, setLanguage] = useState("en");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  useEffect(() => {
    api.studioAuthStatus()
      .then(d => setLoggedIn(d.logged_in))
      .catch(() => setLoggedIn(false));
  }, []);

  const addSource = () => setSources(s => [...s, ""]);

  const removeSource = (i: number) =>
    setSources(s => s.filter((_, idx) => idx !== i));

  const updateSource = (i: number, val: string) =>
    setSources(s => s.map((v, idx) => (idx === i ? val : v)));

  const handleGenerate = async () => {
    if (!voice) return;
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }
    setTranscript(null);
    sse.reset();

    const form = new FormData();
    form.append("sources", JSON.stringify(sources.filter(s => s.trim())));
    form.append("instructions", instructions);
    form.append("voice_name", voice);
    form.append("audio_format", format);
    form.append("language", language);
    form.append("asr_model", "base");
    form.append("speed", "1.0");
    form.append("pitch", "0.0");
    form.append("emotion", "neutral");
    form.append("auto_delete", "true");
    form.append("save_history", "true");

    const result = await sse.run(api.studioUrl, form);
    if (result?.audio_b64) {
      setOutputUrl(audioB64ToBlobUrl(result.audio_b64));
      setTranscript(result.transcript ?? null);
    }
  };

  const handleDownload = async () => {
    if (!outputUrl) return;
    const r = await fetch(outputUrl);
    const blob = await r.blob();
    downloadBlob(blob, `studio_${Date.now()}.wav`);
  };

  const validSources = sources.filter(s => s.trim()).length;
  const canGenerate = !!voice && validSources > 0 && !sse.isRunning && loggedIn === true;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* Auth warning */}
      {loggedIn === false && (
        <div className="glass-card border border-amber-500/30 bg-amber-500/5 p-4 rounded-xl flex gap-3 items-start">
          <span className="text-amber-400 text-lg">⚠</span>
          <div>
            <p className="text-sm text-amber-300 font-medium">NotebookLM login required</p>
            <p className="text-xs text-white/50 mt-1">
              Run <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300">notebooklm login</code> in
              your terminal, then refresh this page.
            </p>
          </div>
        </div>
      )}

      {/* Sources */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
            Sources
          </span>
          <button
            className="btn btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            onClick={addSource}
            disabled={sse.isRunning}
          >
            <PlusIcon size={13} />
            Add source
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {sources.map((src, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="glass-input flex-1 text-sm"
                placeholder={i === 0 ? "https://example.com/article or paste text..." : "URL or text..."}
                value={src}
                onChange={e => updateSource(i, e.target.value)}
                disabled={sse.isRunning}
              />
              {sources.length > 1 && (
                <button
                  className="btn btn-danger btn-icon"
                  onClick={() => removeSource(i)}
                  disabled={sse.isRunning}
                  aria-label="Remove"
                >
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {validSources === 0 && (
          <p className="text-xs text-white/30 mt-2">Add at least one URL or paste some text</p>
        )}
      </GlassCard>

      {/* Custom Instructions */}
      <GlassCard>
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide block mb-3">
          Custom Prompt / Instructions
        </span>
        <textarea
          className="glass-input w-full resize-none text-sm leading-relaxed"
          rows={4}
          placeholder={
            "e.g. Make this a debate between a skeptic and an optimist. Use simple language. " +
            "Start with a surprising fact. Focus on practical takeaways."
          }
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          disabled={sse.isRunning}
        />
        <p className="text-xs text-white/30 mt-2">
          This prompt is sent directly to NotebookLM to guide the podcast style and focus.
        </p>
      </GlassCard>

      {/* Voice + Format + Language */}
      <GlassCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Voice selector */}
          <div className="sm:col-span-2">
            <VoiceSelector
              voices={voices}
              selected={voice}
              onSelect={setVoice}
              onRefresh={refreshVoices}
              loading={voicesLoading}
              label="Your cloned voice (replaces NLM hosts)"
              showDelete={false}
            />
          </div>

          {/* Format */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Format</span>
            <select
              className="glass-input appearance-none cursor-pointer"
              value={format}
              onChange={e => setFormat(e.target.value)}
              disabled={sse.isRunning}
            >
              {FORMATS.map(f => (
                <option key={f.value} value={f.value} className="bg-[#0a0a0f]">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Language</span>
            <select
              className="glass-input appearance-none cursor-pointer"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              disabled={sse.isRunning}
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value} className="bg-[#0a0a0f]">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Generate button */}
      <button
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
        onClick={handleGenerate}
        disabled={!canGenerate}
      >
        <StudioIcon size={16} />
        {sse.isRunning ? "Generating..." : "Generate with My Voice"}
      </button>

      {/* Progress */}
      {sse.isRunning && (
        <GlassCard>
          <ProgressBar value={sse.progress} />
          <p className="text-xs text-white/50 mt-2 text-center">{sse.desc}</p>
        </GlassCard>
      )}

      {/* Error */}
      {sse.error && (
        <StatusMessage
          variant="error"
          message={sse.error.message}
          hint={sse.error.hint}
        />
      )}

      {/* Result */}
      {outputUrl && (
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/80">Your Cloned Podcast</span>
            <button
              className="btn btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              onClick={handleDownload}
            >
              <DownloadIcon size={14} />
              Download
            </button>
          </div>

          <AudioPlayer src={outputUrl} />

          {transcript && (
            <details className="mt-4">
              <summary className="text-xs text-white/40 cursor-pointer select-none hover:text-white/60">
                View transcript
              </summary>
              <p className="text-xs text-white/50 leading-relaxed mt-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {transcript}
              </p>
            </details>
          )}
        </GlassCard>
      )}

      {/* Info card */}
      {!sse.isRunning && !outputUrl && (
        <div className="text-xs text-white/25 text-center leading-relaxed px-4">
          NotebookLM generates a podcast from your sources (5–15 min),
          then your cloned voice replaces the AI hosts.
        </div>
      )}
    </div>
  );
}
