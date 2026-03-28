import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import type {EditConfig, ScriptLine, SpeakerConfig, SpeakerId} from "../types";

type SpeakerStickerProps = {
  speakerId: SpeakerId;
  speaker: SpeakerConfig;
  activeLine: ScriptLine | null;
  isActive: boolean;
  editConfig: EditConfig;
  subtitleYPercent: number;
};

const seededShake = (speakerId: SpeakerId, frame: number) => {
  const seed = speakerId === "A" ? 0.73 : 1.17;
  return Math.sin((frame + 1) * 7.7 * seed) * 5;
};

const getShapeStyle = () => ({borderRadius: "50%"});

export const SpeakerSticker = ({
  speakerId,
  speaker,
  activeLine,
  isActive,
  editConfig,
  subtitleYPercent,
}: SpeakerStickerProps) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const stickerSize = editConfig.stickerSize;
  const stickerGap = editConfig.stickerGap;
  const subtitleBottom = (subtitleYPercent / 100) * height;

  const startFrame = activeLine && activeLine.speaker === speakerId ? Math.floor(activeLine.startSec * fps) : null;
  const frameSinceSpeechStart = startFrame === null ? 0 : Math.max(0, frame - startFrame);

  const emphasis = spring({
    frame: frameSinceSpeechStart,
    fps,
    config: {damping: 12, stiffness: 170, mass: 0.7},
    durationInFrames: 18,
  });
  const nameTagReveal = spring({
    frame: frameSinceSpeechStart,
    fps,
    config: {damping: 14, stiffness: 130},
  });
  const glowOpacity = isActive
    ? interpolate(frame % 20, [0, 10, 20], [0.3, 0.95, 0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  let translateX = 0;
  let translateY = 0;
  let scale = isActive ? 1 + emphasis * 0.08 : 0.94;
  let rotation = 0;

  switch (editConfig.stickerAnim) {
    case "slide":
      translateX = isActive ? interpolate(1 - emphasis, [0, 1], [0, speakerId === "A" ? -54 : 54]) : 0;
      break;
    case "float":
      translateY = isActive ? Math.sin(frame * 0.1) * 9 : 0;
      break;
    case "pulse":
      scale = isActive
        ? interpolate(frame % 30, [0, 15, 30], [1, 1.06, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 0.96;
      break;
    case "bounce":
      translateY = isActive ? interpolate(emphasis, [0, 0.5, 1], [0, -20, 0]) : 0;
      scale = isActive ? 1 + emphasis * 0.15 : 0.94;
      break;
    case "spin":
      scale = isActive ? 1.1 : 0.94;
      rotation = isActive
        ? interpolate(frameSinceSpeechStart, [0, 30], [0, 360], {
            extrapolateRight: "clamp",
          })
        : 0;
      translateX = 0;
      break;
    case "shake":
      translateX = isActive && frameSinceSpeechStart < 7 ? seededShake(speakerId, frameSinceSpeechStart) : 0;
      scale = isActive ? 1.03 : 0.96;
      break;
    case "static":
      scale = isActive ? 1 : 0.96;
      break;
    default:
      break;
  }

  if (!speaker.stickerEnabled || !speaker.stickerUrl) {
    return null;
  }

  const bottomOffset = subtitleBottom + stickerGap + 60;
  const position = {
    left: width / 2 - stickerSize / 2,
    bottom: bottomOffset,
  };

  const entryProgress = spring({
    frame: frameSinceSpeechStart,
    fps,
    config: {damping: 16, stiffness: 140},
    durationInFrames: 20,
  });
  const entryOpacity = isActive ? interpolate(entryProgress, [0, 1], [0, 1]) : interpolate(frameSinceSpeechStart, [0, 15], [1, 0]);
  const entryScale = isActive ? interpolate(entryProgress, [0, 1], [0.5, 1]) : interpolate(frameSinceSpeechStart, [0, 15], [1, 0.8]);

  if (entryOpacity <= 0.01) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: position.left + editConfig.stickerOffsetX,
        bottom: position.bottom + editConfig.stickerOffsetY,
        width: stickerSize,
        pointerEvents: "none",
        opacity: entryOpacity,
        transform: `scale(${entryScale * scale})`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: stickerSize,
          height: stickerSize,
          transform: `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -12 * (stickerSize / 152),
            borderRadius: "50%",
            border: `${editConfig.stickerBorderWidth}px solid ${speaker.color}`,
            boxShadow: `0 0 28px ${speaker.color}, inset 0 0 24px ${speaker.color}`,
            opacity: glowOpacity,
          }}
        />
        <div
          style={{
            width: stickerSize,
            height: stickerSize,
            overflow: "hidden",
            border: `${editConfig.stickerBorderWidth}px solid ${speaker.color}`,
            background: `linear-gradient(135deg, ${speaker.color} 0%, rgba(255,255,255,0.15) 100%)`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            ...getShapeStyle(),
          }}
        >
          <Img src={speaker.stickerUrl} style={{width: "100%", height: "100%", objectFit: "cover"}} />
        </div>
      </div>

      {editConfig.showStickerLabels && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(6, 10, 14, 0.78)",
            border: `1px solid ${speaker.color}`,
            boxShadow: isActive ? `0 0 24px ${speaker.color}` : "0 10px 24px rgba(0,0,0,0.28)",
            color: "white",
            fontSize: Math.max(14, Math.round(stickerSize * 0.16)),
            fontWeight: 800,
            textAlign: "center",
            opacity: interpolate(nameTagReveal, [0, 1], [0.45, 1]),
            transform: `translateY(${interpolate(nameTagReveal, [0, 1], [18, 0])}px)`,
          }}
        >
          {speaker.label}
        </div>
      )}
    </div>
  );
};
