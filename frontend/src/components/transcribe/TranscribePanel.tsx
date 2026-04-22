"use client";

import { useState } from "react";
import { useSSE } from "@/hooks/useSSE";
import { useSettings } from "@/hooks/useSettings";
import { api, downloadBlob } from "@/lib/api";
import { GlassCard } from "../shared/GlassCard";
import { StatusMessage } from "../shared/StatusMessage";
import { FileDropzone } from "../shared/FileDropzone";
import { ProgressBar } from "../shared/ProgressBar";
import { ModelSelect } from "../shared/ModelSelect";
import { TextIcon } from "../shared/Icons";
import { ASR_MODEL_CHOICES, ASR_LANGUAGE_CHOICES, type AsrModelSize } from "@/lib/constants";
import type { WhisperSegment } from "@/types";

export function TranscribePanel() {
  const { settings, update } = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<WhisperSegment[]>([]);
  const tx = useSSE();

  const handleTranscribe = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("audio", file, file.name);
    form.append("model_size", settings.asrModel);
    form.append("language", settings.asrLang);
    const result = await tx.run(api.transcribeUrl, form);
    if (result?.transcript) setTranscript(result.transcript);
    if (result?.segments) setSegments(result.segments);
  };

  const copy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
  };

  const downloadTxt = () => {
    if (!transcript) return;
    downloadBlob(new Blob([transcript], { type: "text/plain" }), "transcript.txt");
  };

  const downloadSubtitle = async (fmt: "srt" | "vtt") => {
    if (segments.length === 0) return;
    try {
      const blob = await api.downloadSubtitle(fmt, segments);
      downloadBlob(blob, `transcript.${fmt}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 animate-fade-in">
      <GlassCard title="Source Media" subtitle="Audio or video file to transcribe" icon={<TextIcon />}>
        <div className="space-y-4">
          <FileDropzone
            file={file}
            onChange={setFile}
            accept="audio/*,video/*"
            label="Drop audio or video"
            hint="MP3, WAV, MP4, MOV, WebM, M4A"
          />

          <div className="grid grid-cols-2 gap-3">
            <ModelSelect
              label="Model size"
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

          <button
            className="btn btn-primary w-full"
            onClick={handleTranscribe}
            disabled={!file || tx.isRunning}
          >
            <TextIcon size={16} />
            {tx.isRunning ? "Transcribing..." : "Transcribe"}
          </button>

          {tx.isRunning && <ProgressBar value={tx.progress} desc={tx.desc} />}
          {tx.error && (
            <StatusMessage
              message={tx.error.message}
              hint={tx.error.hint}
              code={tx.error.code}
              variant="error"
            />
          )}
          {tx.result && !tx.isRunning && (
            <div className="text-xs text-white/50">
              <span className="text-emerald-300">✓</span> Transcribed {tx.result.segment_count} segments · language{" "}
              <span className="font-mono text-white/70">{tx.result.language}</span>
              {tx.result.compute_type && <> · {tx.result.compute_type}</>}
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard
        title="Transcript"
        subtitle="Editable · copy or export"
        icon={<TextIcon />}
        actions={
          <>
            <button className="btn btn-secondary" onClick={copy} disabled={!transcript}>
              Copy
            </button>
            <button className="btn btn-secondary" onClick={downloadTxt} disabled={!transcript}>
              .txt
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => downloadSubtitle("srt")}
              disabled={segments.length === 0}
              title="SubRip subtitles"
            >
              .srt
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => downloadSubtitle("vtt")}
              disabled={segments.length === 0}
              title="WebVTT subtitles"
            >
              .vtt
            </button>
          </>
        }
      >
        <textarea
          className="glass-input font-mono text-[13px]"
          rows={16}
          placeholder="Transcript will appear here..."
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
        />
        {segments.length > 0 && (
          <div className="mt-3 text-[11px] text-white/40">
            {segments.length} timed segments available for subtitle export
          </div>
        )}
      </GlassCard>
    </div>
  );
}
