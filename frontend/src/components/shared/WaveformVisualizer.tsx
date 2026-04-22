"use client";

interface WaveformVisualizerProps {
  mode: "idle" | "recording" | "active";
  amplitude?: number;
  bars?: number;
  className?: string;
}

export function WaveformVisualizer({ mode, amplitude = 0, bars = 32, className = "" }: WaveformVisualizerProps) {
  const barsArr = Array.from({ length: bars });

  return (
    <div className={`flex items-center justify-center gap-[3px] h-14 ${className}`}>
      {barsArr.map((_, i) => {
        if (mode === "recording") {
          // Show live amplitude with wave-like distribution (higher at center)
          const distanceFromCenter = Math.abs(i - bars / 2) / (bars / 2);
          const centerBias = 1 - distanceFromCenter * 0.6;
          const randomJitter = 0.6 + Math.random() * 0.4;
          const height = Math.max(0.12, amplitude * centerBias * randomJitter);
          return (
            <div
              key={i}
              className="w-1 rounded-full"
              style={{
                height: `${Math.min(100, height * 100)}%`,
                background: "linear-gradient(180deg, #ef4444, #f59e0b)",
                transition: "height 60ms ease",
              }}
            />
          );
        }

        if (mode === "active") {
          const distanceFromCenter = Math.abs(i - bars / 2) / (bars / 2);
          const centerBias = 1 - distanceFromCenter * 0.5;
          const randomJitter = 0.5 + Math.random() * 0.5;
          const height = Math.max(0.15, amplitude * centerBias * randomJitter);
          return (
            <div
              key={i}
              className="w-1 rounded-full"
              style={{
                height: `${Math.min(100, height * 100)}%`,
                background: "linear-gradient(180deg, #7c3aed, #22d3ee)",
                transition: "height 60ms ease",
              }}
            />
          );
        }

        // idle animated pulse
        const delay = (i / bars) * 1.2;
        return (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: "40%",
              background: "rgba(255,255,255,0.18)",
              animation: `waveform-idle 2s ease-in-out infinite`,
              animationDelay: `${delay}s`,
              transformOrigin: "center",
            }}
          />
        );
      })}
    </div>
  );
}
