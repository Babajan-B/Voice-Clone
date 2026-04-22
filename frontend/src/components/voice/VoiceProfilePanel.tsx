"use client";

import { useEffect, useState } from "react";
import { useVoices } from "@/hooks/useVoices";
import { api } from "@/lib/api";
import { GlassCard } from "../shared/GlassCard";
import { StatusMessage } from "../shared/StatusMessage";
import { AudioPlayer } from "../shared/AudioPlayer";
import { VoiceSelector } from "./VoiceSelector";
import { AudioRecorder } from "../synthesize/AudioRecorder";
import { SaveIcon, UserIcon } from "../shared/Icons";

export function VoiceProfilePanel() {
  const { voices, loading, refresh } = useVoices();
  const [selected, setSelected] = useState<string | null>(null);
  const [refAudio, setRefAudio] = useState<Blob | null>(null);
  const [refFilename, setRefFilename] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [name, setName] = useState("");
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ msg: string; variant: "success" | "error" | "info" } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) {
      setSavedAudioUrl(null);
      return;
    }
    api
      .getVoice(selected)
      .then(v => {
        setSavedAudioUrl(v.audio_url);
        setTranscript(v.transcript);
        setName(v.name);
      })
      .catch(e => setStatus({ msg: String(e), variant: "error" }));
  }, [selected]);

  const handleSave = async () => {
    if (!refAudio) {
      setStatus({ msg: "Please record or upload reference audio first.", variant: "error" });
      return;
    }
    if (!transcript.trim()) {
      setStatus({ msg: "Please enter the transcript of the audio.", variant: "error" });
      return;
    }
    if (!name.trim()) {
      setStatus({ msg: "Please enter a name for this voice profile.", variant: "error" });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("audio", refAudio, refFilename || "audio.webm");
      form.append("transcript", transcript.trim());
      form.append("name", name.trim());
      const res = await api.saveVoice(form);
      setStatus({ msg: `Saved voice profile "${name.trim()}"`, variant: "success" });
      await refresh();
      setSelected(name.trim());
      // Refresh list count
      void res;
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "Failed to save voice", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (voiceName: string) => {
    if (!confirm(`Delete voice profile "${voiceName}"? This cannot be undone.`)) return;
    try {
      await api.deleteVoice(voiceName);
      await refresh();
      setSelected(null);
      setRefAudio(null);
      setTranscript("");
      setName("");
      setSavedAudioUrl(null);
      setStatus({ msg: `Deleted "${voiceName}"`, variant: "info" });
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "Delete failed", variant: "error" });
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
      {/* Left: load existing */}
      <GlassCard
        title="Saved Profiles"
        subtitle={`${voices.length} voice${voices.length === 1 ? "" : "s"} available`}
        icon={<UserIcon />}
      >
        <div className="space-y-4">
          <VoiceSelector
            voices={voices}
            selected={selected}
            onSelect={setSelected}
            onRefresh={refresh}
            onDelete={handleDelete}
            loading={loading}
          />

          {selected && savedAudioUrl ? (
            <>
              <AudioPlayer src={savedAudioUrl} label="Reference audio" downloadName={`${selected}.wav`} />
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  Reference transcript
                </label>
                <textarea
                  className="glass-input mt-1.5 font-mono text-[13px]"
                  rows={5}
                  readOnly
                  value={transcript}
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
              Select a voice to preview, or create one on the right
            </div>
          )}
        </div>
      </GlassCard>

      {/* Right: create new */}
      <GlassCard
        title="Create New Profile"
        subtitle="Record or upload a reference clip"
        icon={<SaveIcon />}
        glow
      >
        <div className="space-y-4">
          <AudioRecorder
            value={refAudio}
            onChange={(blob, filename) => {
              setRefAudio(blob);
              setRefFilename(filename ?? "");
            }}
          />

          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Transcript (exact words spoken)
            </label>
            <textarea
              className="glass-input mt-1.5"
              rows={4}
              placeholder="Type the exact transcript of the reference audio..."
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Profile name</label>
            <input
              className="glass-input mt-1.5"
              type="text"
              placeholder="e.g. My Formal Voice"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            <SaveIcon size={16} />
            {saving ? "Saving..." : "Save voice profile"}
          </button>

          {status && <StatusMessage message={status.msg} variant={status.variant} />}
        </div>
      </GlassCard>
    </div>
  );
}
