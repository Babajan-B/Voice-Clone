"use client";

import { useState } from "react";
import { useVoices } from "@/hooks/useVoices";
import { useSSE } from "@/hooks/useSSE";
import { useSettings } from "@/hooks/useSettings";
import { api, audioB64ToBlobUrl } from "@/lib/api";
import { GlassCard } from "../shared/GlassCard";
import { StatusMessage } from "../shared/StatusMessage";
import { AudioPlayer } from "../shared/AudioPlayer";
import { FileDropzone } from "../shared/FileDropzone";
import { ProgressBar } from "../shared/ProgressBar";
import { ModelSelect } from "../shared/ModelSelect";
import { VoiceSelector } from "../voice/VoiceSelector";
import { VoiceControls } from "../shared/VoiceControls";
import { SwitchIcon, SparkleIcon } from "../shared/Icons";
import { ASR_MODEL_CHOICES, ASR_LANGUAGE_CHOICES, type AsrModelSize } from "@/lib/constants";

export function ConvertPanel() {
  const { voices, loading: voicesLoading, refresh: refreshVoices } = useVoices();
  const { settings, update } = useSettings();
  const conv = useSSE();
  const finalize = useSSE();

  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [step, setStep] = useState<"idle" | "review" | "done">("idle");

  const resetFlow = () => {
    setStep("idle");
    setEditableTranscript("");
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    conv.reset();
    finalize.reset();
  };

  const handleConvert = async () => {
    if (!file || !voice) return;
    resetFlow();
    const form = new FormData();
    form.append("source_audio", file, file.name);
    form.append("voice_name", voice);
    form.append("model_size", settings.asrModel);
    form.append("language", settings.asrLang);
    form.append("emotion", settings.voiceControls.emotion);
    form.append("speed", String(settings.voiceControls.speed));
    form.append("pitch", String(settings.voiceControls.pitch));
    form.append("save_history", String(settings.saveHistory));
    form.append("transcribe_only", String(settings.reviewTranscript));

    const result = await conv.run(api.convertUrl, form);
    if (!result) return;

    if (result.transcribe_only) {
      setEditableTranscript(result.transcript || "");
      setStep("review");
      return;
    }

    if (result.audio_b64) {
      setOutputUrl(audioB64ToBlobUrl(result.audio_b64));
      setEditableTranscript(result.transcript || "");
      setStep("done");
    }
  };

  const handleFinalize = async () => {
    if (!voice || !editableTranscript.trim()) return;
    const form = new FormData();
    form.append("voice_name", voice);
    form.append("transcript", editableTranscript.trim());
    form.append("emotion", settings.voiceControls.emotion);
    form.append("speed", String(settings.voiceControls.speed));
    form.append("pitch", String(settings.voiceControls.pitch));
    form.append("save_history", String(settings.saveHistory));

    const result = await finalize.run(api.convertFinalizeUrl, form);
    if (result?.audio_b64) {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(audioB64ToBlobUrl(result.audio_b64));
      setStep("done");
    }
  };

  const canConvert = !!file && !!voice && !conv.isRunning && !finalize.isRunning;
  const running = conv.isRunning || finalize.isRunning;

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 animate-fade-in">
      <GlassCard
        title="Voice-to-Voice"
        subtitle="Re-synthesize any audio in a saved voice"
        icon={<SwitchIcon />}
      >
        <div className="space-y-4">
          <FileDropzone
            file={file}
            onChange={setFile}
            accept="audio/*,video/*"
            label="Drop source audio or video"
            hint="Will be transcribed, then re-synthesized"
          />

          <VoiceSelector
            voices={voices}
            selected={voice}
            onSelect={setVoice}
            onRefresh={refreshVoices}
            loading={voicesLoading}
            showDelete={false}
            label="Target voice profile"
          />

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

          <VoiceControls
            value={settings.voiceControls}
            onChange={v => update({ voiceControls: v })}
            disabled={running}
          />

          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-500"
              checked={settings.reviewTranscript}
              onChange={e => update({ reviewTranscript: e.target.checked })}
            />
            Review transcript before synthesizing
          </label>

          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-500"
              checked={settings.saveHistory}
              onChange={e => update({ saveHistory: e.target.checked })}
            />
            Save to history
          </label>

          <button className="btn btn-primary w-full py-3" onClick={handleConvert} disabled={!canConvert}>
            <SwitchIcon size={16} />
            {conv.isRunning ? "Converting..." : settings.reviewTranscript ? "Transcribe source" : "Convert voice"}
          </button>

          {conv.isRunning && <ProgressBar value={conv.progress} desc={conv.desc} />}
          {conv.error && (
            <StatusMessage
              message={conv.error.message}
              hint={conv.error.hint}
              code={conv.error.code}
              variant="error"
            />
          )}
        </div>
      </GlassCard>

      <GlassCard
        title="Result"
        subtitle={step === "review" ? "Edit transcript, then synthesize" : "Transcript + synthesized output"}
        icon={<SparkleIcon />}
        glow
      >
        <div className="space-y-4">
          {step === "idle" && !conv.isRunning && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/40">
              Upload a file and select a voice to begin
            </div>
          )}

          {(step === "review" || step === "done") && (
            <div>
              <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                {step === "review" ? "Edit transcript" : "Detected transcript"}
              </label>
              <textarea
                className="glass-input mt-1.5 font-mono text-[13px]"
                rows={6}
                readOnly={step === "done"}
                value={editableTranscript}
                onChange={e => setEditableTranscript(e.target.value)}
              />
            </div>
          )}

          {step === "review" && (
            <>
              <button
                className="btn btn-primary w-full py-3"
                onClick={handleFinalize}
                disabled={finalize.isRunning || !editableTranscript.trim()}
              >
                <SparkleIcon size={16} />
                {finalize.isRunning ? "Synthesizing..." : "Synthesize with this transcript"}
              </button>
              {finalize.isRunning && <ProgressBar value={finalize.progress} desc={finalize.desc} />}
              {finalize.error && (
                <StatusMessage
                  message={finalize.error.message}
                  hint={finalize.error.hint}
                  code={finalize.error.code}
                  variant="error"
                />
              )}
            </>
          )}

          {step === "done" && outputUrl && (
            <div className="space-y-2 animate-fade-in">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wide">
                Converted audio
              </div>
              <AudioPlayer src={outputUrl} downloadName="converted.wav" />
              <div className="text-[11px] font-mono text-white/40 text-right">
                {(finalize.result?.duration ?? conv.result?.duration)?.toFixed(1)}s ·{" "}
                {finalize.result?.sample_rate ?? conv.result?.sample_rate} Hz · {voice}
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
