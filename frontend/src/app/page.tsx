"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TabBar } from "@/components/layout/TabBar";
import { VoiceProfilePanel } from "@/components/voice/VoiceProfilePanel";
import { SynthesizePanel } from "@/components/synthesize/SynthesizePanel";
import { TranscribePanel } from "@/components/transcribe/TranscribePanel";
import { ConvertPanel } from "@/components/convert/ConvertPanel";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { StudioPanel } from "@/components/studio/StudioPanel";
import type { TabKey } from "@/types";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("voices");

  return (
    <AppShell>
      <TabBar active={tab} onChange={setTab} />

      {tab === "voices" && <VoiceProfilePanel />}
      {tab === "synthesize" && <SynthesizePanel />}
      {tab === "transcribe" && <TranscribePanel />}
      {tab === "convert" && <ConvertPanel />}
      {tab === "history" && <HistoryPanel />}
      {tab === "studio" && <StudioPanel />}
    </AppShell>
  );
}
