"use client";

import type { TabKey } from "@/types";
import { MicIcon, SparkleIcon, TextIcon, SwitchIcon, HistoryIcon } from "../shared/Icons";

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

export const TABS: Tab[] = [
  { key: "voices",     label: "Voice Profiles", icon: <MicIcon size={16} />,    shortcut: "1" },
  { key: "synthesize", label: "Synthesize",     icon: <SparkleIcon size={16} />, shortcut: "2" },
  { key: "transcribe", label: "Transcribe",     icon: <TextIcon size={16} />,   shortcut: "3" },
  { key: "convert",    label: "Voice Convert",  icon: <SwitchIcon size={16} />, shortcut: "4" },
  { key: "history",    label: "History",        icon: <HistoryIcon size={16} />, shortcut: "5" },
];

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="glass-card p-1.5 inline-flex gap-1 mb-8 flex-wrap">
      {TABS.map(tab => (
        <button
          key={tab.key}
          data-active={active === tab.key}
          className="tab-pill"
          onClick={() => onChange(tab.key)}
          title={`Press ${tab.shortcut}`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
