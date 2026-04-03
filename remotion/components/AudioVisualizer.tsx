import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ScriptLine, SpeakerId } from "../types";

const getActiveSpeaker = (frame: number, fps: number, scriptLines: ScriptLine[]): SpeakerId | null => {
  const time = frame / fps;
  const activeLine = scriptLines.find((line) => time >= line.startSec && time <= line.endSec);
  return activeLine?.speaker ?? null;
};

export const AudioVisualizer = ({
  speakerAColor,
  speakerBColor,
  scriptLines,
}: {
  speakerAColor: string;
  speakerBColor: string;
  scriptLines: ScriptLine[];
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const activeSpeaker = getActiveSpeaker(frame, fps, scriptLines);

  const numBars = 18;
  const barWidth = 5;
  const gap = 5;
  const totalWidth = numBars * barWidth + (numBars - 1) * gap;
  const maxBarHeight = 48;
  const minBarHeight = 3;

  const color = activeSpeaker === "B" ? speakerBColor : speakerAColor;

  // Smooth fade in/out based on active speaker
  const targetOpacity = activeSpeaker ? 1 : 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: width / 2 - totalWidth / 2,
        width: totalWidth,
        height: maxBarHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: `${gap}px`,
        opacity: targetOpacity,
        transition: "opacity 0.25s ease-in-out",
      }}
    >
      {Array.from({ length: numBars }).map((_, i) => {
        // Multiple layered sine waves for realistic waveform shape
        const centerDist = Math.abs(i - (numBars - 1) / 2) / ((numBars - 1) / 2);
        const envelopeScale = 1 - centerDist * 0.55; // Taller in center, shorter at edges

        const wave1 = Math.sin(frame * 0.22 + i * 0.9) * 0.35;
        const wave2 = Math.sin(frame * 0.15 + i * 1.4 + 1.2) * 0.25;
        const wave3 = Math.sin(frame * 0.31 + i * 0.5 + 2.8) * 0.2;
        const wave4 = Math.cos(frame * 0.11 + i * 2.1) * 0.15;

        const rawAmplitude = activeSpeaker
          ? Math.abs(wave1 + wave2 + wave3 + wave4) * envelopeScale
          : 0;

        const amplitude = Math.min(1, rawAmplitude * 1.4 + 0.08);

        const barHeight = interpolate(
          amplitude,
          [0, 1],
          [minBarHeight, maxBarHeight],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // Subtle glow intensity based on height
        const glowIntensity = interpolate(amplitude, [0, 1], [0.2, 0.7]);

        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              borderRadius: barWidth,
              boxShadow: `0 0 ${6 + glowIntensity * 10}px ${color}${Math.round(glowIntensity * 99).toString().padStart(2, "0")}`,
              transition: "height 0.04s linear",
            }}
          />
        );
      })}
    </div>
  );
};
