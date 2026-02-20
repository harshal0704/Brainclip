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
  const { fps, width, height } = useVideoConfig();
  const activeSpeaker = getActiveSpeaker(frame, fps, scriptLines);

  const numBars = 12;
  const barWidth = 8;
  const gap = 12;
  const totalWidth = numBars * barWidth + (numBars - 1) * gap;

  // Simulate an audio waveform using sine waves and seeded randomness
  return (
    <div
      style={{
        position: "absolute",
        bottom: 120, // Positioned above the progress bar
        left: width / 2 - totalWidth / 2,
        width: totalWidth,
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: `${gap}px`,
        opacity: activeSpeaker ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      {Array.from({ length: numBars }).map((_, i) => {
        const seed = (i * 13.37) % 7; // Seed for randomness
        const speed = 0.2 + (i % 3) * 0.1; // Varied speed
        
        // Simulating the amplitude for each bar based on the frame, if a speaker is active
        const activeAmplitude = activeSpeaker
          ? Math.abs(Math.sin(frame * speed + seed)) * 0.8 + 0.2
          : 0;
          
        const smoothedHeight = interpolate(
          activeAmplitude,
          [0, 1],
          [4, 60],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const color = activeSpeaker === "A" ? speakerAColor : speakerBColor;

        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: smoothedHeight,
              backgroundColor: color,
              borderRadius: 999,
              boxShadow: `0 0 12px ${color}88`,
              transition: "height 0.05s linear",
            }}
          />
        );
      })}
    </div>
  );
};
