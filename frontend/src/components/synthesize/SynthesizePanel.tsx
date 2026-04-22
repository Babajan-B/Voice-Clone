"use client";

import { useEffect, useState } from "react";
import { useVoices } from "@/hooks/useVoices";
import { useSSE } from "@/hooks/useSSE";
import { useSettings } from "@/hooks/useSettings";
import { api, audioB64ToBlobUrl } from "@/lib/api";
import { GlassCard } from "../shared/GlassCard";
import { StatusMessage } from "../shared/StatusMessage";
import { AudioPlayer } from "../shared/AudioPlayer";
import { ProgressBar } from "../shared/ProgressBar";
import { ModelSelect } from "../shared/ModelSelect";
import { VoiceSelector } from "../voice/VoiceSelector";
import { AudioRecorder } from "./AudioRecorder";
import { VoiceControls } from "../shared/VoiceControls";
import { SparkleIcon, TextIcon, WandIcon } from "../shared/Icons";
import { ASR_MODEL_CHOICES, ASR_LANGUAGE_CHOICES, type AsrModelSize } from "@/lib/constants";

export function SynthesizePanel() {
  const { voices, loading: voicesLoading, refresh: refreshVoices } = useVoices();
  const { settings, update } = useSettings();
  const gen = useSSE();
  const tx = useSSE();

  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [refAudio, setRefAudio] = useState<Blob | null>(null);
  const [refFilename, setRefFilename] = useState("");
  const [refTranscript, setRefTranscript] = useState("");
  const [targetText, setTargetText] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedVoice) return;
    api.getVoice(selectedVoice).then(async v => {
      setRefTranscript(v.transcript);
      try {
        const r = await fetch(v.audio_url);
        const blob = await r.blob();
        setRefAudio(blob);
        setRefFilename(`${v.name}.wav`);
      } catch {
        /* non-fatal */
      }
    });
  }, [selectedVoice]);

  const handleTranscribeRef = async () => {
    if (!refAudio) return;
    const form = new FormData();
    form.append("audio", refAudio, refFilename || "audio.webm");
    form.append("model_size", settings.asrModel);
    form.append("language", settings.asrLang);
    const result = await tx.run(api.transcribeUrl, form);
    if (result?.transcript) setRefTranscript(result.transcript);
  };

  const handleGenerate = async () => {
    if (!refAudio) return;
    const form = new FormData();
    form.append("ref_audio", refAudio, refFilename || "audio.webm");
    form.append("ref_transcript", refTranscript.trim());
    form.append("target_text", targetText.trim());
    form.append("emotion", settings.voiceControls.emotion);
    form.append("speed", String(settings.voiceControls.speed));
    form.append("pitch", String(settings.voiceControls.pitch));
    form.append("save_history", String(settings.saveHistory));
    if (selectedVoice) form.append("voice_name", selectedVoice);

    const result = await gen.run(api.generateUrl, form);
    if (result?.audio_b64) {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(audioB64ToBlobUrl(result.audio_b64));
    }
  };

  const canGenerate = !!refAudio && !!refTranscript.trim() && !!targetText.trim() && !gen.isRunning;
  const canTranscribe = !!refAudio && !tx.isRunning && !gen.isRunning;

  return (
    <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
      <GlassCard
        title="Reference Voice"
        subtitle="Record, upload, or load a saved profile"
        icon={<WandIcon />}
      >
        <div className="space-y-4">
          <VoiceSelector
            voices={voices}
            selected={selectedVoice}
            onSelect={setSelectedVoice}
            onRefresh={refreshVoices}
            loading={voicesLoading}
            showDelete={false}
            label="Load saved voice (optional)"
          />

          <AudioRecorder
            value={refAudio}
            onChange={(blob, filename) => {
              setRefAudio(blob);
              setRefFilename(filename ?? "");
              setSelectedVoice(null);
            }}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                Reference transcript
              </label>
              <button
                className="text-[11px] text-violet-300 hover:text-violet-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                onClick={handleTranscribeRef}
                disabled={!canTranscribe}
              >
                <TextIcon size={12} />
                {tx.isRunning ? "Transcribing..." : "Auto-transcribe"}
              </button>
            </div>
            <textarea
              className="glass-input"
              rows={4}
              placeholder="Type exactly what was said in the reference audio..."
              value={refTranscript}
              onChange={e => setRefTranscript(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ModelSelect
              label="ASR model"
              value={settings.asrModel}
              options={ASR_MODEL_CHOICES}
              onChange={v => update({ asrModel: v as AsrModelSize })}
            />
            <ModelSelect
              label="Language"
              value={settings.asrLang}
              options={ASR_LANGUAGE_CHOICES}
              onChange={v => update({ asrLang: v })}
            />
          </div>

          {tx.isRunning && <ProgressBar value={tx.progress} desc={tx.desc} />}
          {tx.error && (
            <StatusMessage
              message={tx.error.message}
              hint={tx.error.hint}
              code={tx.error.code}
              variant="error"
            />
          )}
        </div>
      </GlassCard>

      <GlassCard
        title="Generate Speech"
        subtitle="Synthesize new text in the reference voice"
        icon={<SparkleIcon />}
        glow
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Target text to synthesize
            </label>
            <textarea
              className="glass-input mt-1.5"
              rows={7}
              placeholder="What do you want the AI voice to say? (long text is auto-chunked)"
              value={targetText}
              onChange={e => setTargetText(e.target.value)}
            />
            <div className="mt-1 text-[11px] text-white/30 text-right">{targetText.length} chars</div>
          </div>

          <VoiceControls
            value={settings.voiceControls}
            onChange={v => update({ voiceControls: v })}
            disabled={gen.isRunning}
          />

          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-500"
              checked={settings.saveHistory}
              onChange={e => update({ saveHistory: e.target.checked })}
            />
            Save to history
          </label>

          <button
            className="btn btn-primary w-full py-3 text-base"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            <SparkleIcon size={18} />
            {gen.isRunning ? "Generating..." : "Generate Voice"}
          </button>

          {gen.isRunning && <ProgressBar value={gen.progress} desc={gen.desc} />}
          {gen.error && (
            <StatusMessage
              message={gen.error.message}
              hint={gen.error.hint}
              code={gen.error.code}
              variant="error"
            />
          )}

          {outputUrl && !gen.isRunning && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Output</div>
                {gen.result?.chunk_count && gen.result.chunk_count > 1 && (
                  <div className="text-[10px] font-mono text-white/40">
                    {gen.result.chunk_count} chunks
                  </div>
                )}
              </div>
              <AudioPlayer src={outputUrl} downloadName="generated.wav" />
              {gen.result?.duration && (
                <div className="text-[11px] font-mono text-white/40 text-right">
                  {gen.result.duration.toFixed(1)}s · {gen.result.sample_rate} Hz
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
