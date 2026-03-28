import {Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import {BackgroundLayer} from "../components/BackgroundLayer";
import {ProgressBar} from "../components/ProgressBar";
import {SpeakerSticker} from "../components/SpeakerSticker";
import {SubtitleLayer} from "../components/SubtitleLayer";
import {AudioVisualizer} from "../components/AudioVisualizer";
import type {ReelCompositionProps, ScriptLine, SpeakerId, SpeakerLayout} from "../types";
import {getSubtitleYFromPosition} from "../types";

const getActiveLine = (frame: number, fps: number, scriptLines: ScriptLine[]) => {
  const time = frame / fps;
  return scriptLines.find((line) => time >= line.startSec && time <= line.endSec) ?? null;
};

const SideBySideSpeaker = ({
  speakerId,
  speaker,
  isActive,
  isLeft,
  size,
  editConfig,
}: {
  speakerId: SpeakerId;
  speaker: {label: string; stickerUrl: string; color: string; stickerEnabled: boolean};
  isActive: boolean;
  isLeft: boolean;
  size: number;
  editConfig: any;
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  
  const glowOpacity = interpolate(frame % 30, [0, 15, 30], [0.3, 0.9, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  const speakerWidth = width / 2 - 20;
  const speakerHeight = height * 0.55;
  const leftPos = isLeft ? 10 : width / 2 + 10;

  if (!speaker.stickerEnabled || !speaker.stickerUrl) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: leftPos,
        top: height / 2 - speakerHeight / 2,
        width: speakerWidth,
        height: speakerHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isActive && (
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: 20,
            border: `3px solid ${speaker.color}`,
            boxShadow: `0 0 ${30 * glowOpacity}px ${speaker.color}`,
            opacity: glowOpacity,
          }}
        />
      )}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${editConfig.stickerBorderWidth}px solid ${speaker.color}`,
          boxShadow: isActive ? `0 0 28px ${speaker.color}` : "0 18px 40px rgba(0,0,0,0.35)",
          overflow: "hidden",
          background: `linear-gradient(135deg, ${speaker.color} 0%, rgba(255,255,255,0.15) 100%)`,
        }}
      >
        <img
          src={speaker.stickerUrl}
          alt={speaker.label}
          style={{width: "100%", height: "100%", objectFit: "cover"}}
        />
      </div>
      {editConfig.showStickerLabels && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 999,
            backgroundColor: isActive ? speaker.color : "rgba(6, 10, 14, 0.78)",
            color: isActive ? "#000" : "white",
            fontSize: Math.max(14, Math.round(size * 0.16)),
            fontWeight: 800,
            textAlign: "center",
            boxShadow: isActive ? `0 0 24px ${speaker.color}` : "0 10px 24px rgba(0,0,0,0.28)",
          }}
        >
          {speaker.label}
        </div>
      )}
    </div>
  );
};

const SplitDivider = ({color1, color2}: {color1: string; color2: string}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const shimmer = interpolate(frame % 40, [0, 20, 40], [0.3, 0.7, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: width / 2 - 1,
        top: height * 0.2,
        bottom: height * 0.2,
        width: 2,
        background: `linear-gradient(180deg, ${color1} 0%, rgba(255,255,255,0.5) 50%, ${color2} 100%)`,
        opacity: shimmer,
      }}
    />
  );
};

export const SideBySideComposition = (props: ReelCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeLine = getActiveLine(frame, fps, props.scriptLines);
  const activeSpeaker = activeLine?.speaker ?? null;
  const subtitleAccent = activeSpeaker === "B" ? props.speakerB.color : props.speakerA.color;

  const speakerLayout = props.speakerLayout ?? "left-right";
  
  const introProgress = spring({
    frame,
    fps,
    config: {damping: 14, stiffness: 100},
    durationInFrames: 30,
  });
  
  const sceneOpacity = interpolate(introProgress, [0, 1], [0, 1]);
  const sceneTranslateY = interpolate(introProgress, [0, 1], [40, 0]);
  const subtitleYPercent = getSubtitleYFromPosition(props.editConfig.subtitlePosition, props.editConfig.subtitleY);

  const stickerSize = props.editConfig.stickerSize;

  return (
    <div style={{
      position: "absolute", 
      inset: 0, 
      backgroundColor: "#05080c", 
      overflow: "hidden", 
      color: "white",
      opacity: sceneOpacity,
      transform: `translateY(${sceneTranslateY}px)`,
    }}>
      <BackgroundLayer backgroundSrc={props.backgroundSrc} editConfig={props.editConfig} backgroundType="gradient" />
      {props.audioSrc ? <Audio src={props.audioSrc} /> : null}

      <AudioVisualizer speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} scriptLines={props.scriptLines} />
      <ProgressBar color={subtitleAccent} />

      <SideBySideSpeaker
        speakerId="A"
        speaker={props.speakerA}
        isActive={activeSpeaker === "A"}
        isLeft={true}
        size={stickerSize}
        editConfig={props.editConfig}
      />
      <SideBySideSpeaker
        speakerId="B"
        speaker={props.speakerB}
        isActive={activeSpeaker === "B"}
        isLeft={false}
        size={stickerSize}
        editConfig={props.editConfig}
      />

      <SplitDivider color1={props.speakerA.color} color2={props.speakerB.color} />

      <SubtitleLayer
        wordTimings={props.wordTimings}
        scriptLines={props.scriptLines}
        subtitleStyle={props.subtitleStyle}
        editConfig={props.editConfig}
        accentColor={subtitleAccent}
      />
    </div>
  );
};