import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import type {EditConfig, ScriptLine, SpeakerConfig, SpeakerId} from "../types";

type SpeakerStickerProps = {
  speakerId: SpeakerId;
  speaker: SpeakerConfig;
  activeLine: ScriptLine | null;
  isActive: boolean;
  editConfig: EditConfig;
};

const getShapeStyle = () => ({borderRadius: "50%"});

const getIdlePosition = (speakerId: SpeakerId, width: number, height: number) => {
  const centerX = width / 2 - 76;
  return {
    left: centerX,
    top: speakerId === "A" ? 86 : height - 318,
  };
};

const seededShake = (speakerId: SpeakerId, frame: number) => {
  const seed = speakerId === "A" ? 0.73 : 1.17;
  return Math.sin((frame + 1) * 7.7 * seed) * 5;
};

export const SpeakerSticker = ({speakerId, speaker, activeLine, isActive, editConfig}: SpeakerStickerProps) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const position = getIdlePosition(speakerId, width, height);

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
    : 0.16;

  let translateX = 0;
  let translateY = 0;
  let scale = isActive ? 1 + emphasis * 0.08 : 0.94;

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

  return (
    <div style={{position: "absolute", left: position.left, top: position.top, width: 152, pointerEvents: "none"}}>
      <div
        style={{
          position: "relative",
          width: 152,
          height: 152,
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -12,
            borderRadius: "50%",
            border: `4px solid ${speaker.color}`,
            boxShadow: `0 0 28px ${speaker.color}, inset 0 0 24px ${speaker.color}`,
            opacity: glowOpacity,
          }}
        />
        <div
          style={{
            width: 152,
            height: 152,
            overflow: "hidden",
            border: `4px solid ${speaker.color}`,
            background: `linear-gradient(135deg, ${speaker.color} 0%, rgba(255,255,255,0.15) 100%)`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            ...getShapeStyle(),
          }}
        >
          {speaker.stickerUrl ? (
            <Img src={speaker.stickerUrl} style={{width: "100%", height: "100%", objectFit: "cover"}} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 56,
                fontWeight: 900,
              }}
            >
              {speaker.label.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "10px 18px",
          borderRadius: 999,
          backgroundColor: "rgba(6, 10, 14, 0.78)",
          border: `1px solid ${speaker.color}`,
          boxShadow: isActive ? `0 0 24px ${speaker.color}` : "0 10px 24px rgba(0,0,0,0.28)",
          color: "white",
          fontSize: 24,
          fontWeight: 800,
          textAlign: "center",
          opacity: isActive ? interpolate(nameTagReveal, [0, 1], [0.45, 1]) : 0.72,
          transform: `translateY(${isActive ? interpolate(nameTagReveal, [0, 1], [18, 0]) : 0}px)`,
        }}
      >
        {speaker.label}
      </div>
    </div>
  );
};
