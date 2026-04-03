import {Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import {BackgroundLayer} from "../components/BackgroundLayer";
import {ProgressBar} from "../components/ProgressBar";
import {SpeakerSticker} from "../components/SpeakerSticker";
import {SubtitleLayer} from "../components/SubtitleLayer";
import {AudioVisualizer} from "../components/AudioVisualizer";
import type {ReelCompositionProps, ScriptLine, SpeakerId} from "../types";
import {getSubtitleYFromPosition} from "../types";

const getActiveLine = (frame: number, fps: number, scriptLines: ScriptLine[]) => {
  const time = frame / fps;
  return scriptLines.find((line) => time >= line.startSec && time <= line.endSec) ?? null;
};

const PIPSticker = ({
  speakerId,
  speaker,
  isActive,
  size,
}: {
  speakerId: SpeakerId;
  speaker: {label: string; stickerUrl: string; color: string; stickerEnabled: boolean};
  isActive: boolean;
  size: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bounce = spring({frame, fps, config: {damping: 12, stiffness: 180}});

  if (!speaker.stickerEnabled || !speaker.stickerUrl) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        bottom: 40,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `3px solid ${speaker.color}`,
        boxShadow: isActive ? `0 0 20px ${speaker.color}` : "0 10px 30px rgba(0,0,0,0.4)",
        overflow: "hidden",
        opacity: isActive ? 1 : 0.7,
        transform: isActive ? `scale(${1 + bounce * 0.1})` : "scale(1)",
      }}
    >
      <img
        src={speaker.stickerUrl}
        alt={speaker.label}
        style={{width: "100%", height: "100%", objectFit: "cover"}}
      />
    </div>
  );
};

const InterviewNamePlate = ({
  speakerName,
  accentColor,
  isMain,
}: {
  speakerName: string;
  accentColor: string;
  isMain: boolean;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 14, stiffness: 130}});

  return (
    <div
      style={{
        position: "absolute",
        left: isMain ? 40 : undefined,
        right: isMain ? undefined : 40,
        top: isMain ? 60 : undefined,
        bottom: isMain ? undefined : 200,
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [10, 0])}px)`,
      }}
    >
      <div
        style={{
          padding: "8px 20px",
          backgroundColor: "rgba(0,0,0,0.7)",
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: "0 8px 8px 0",
        }}
      >
        <span style={{color: "white", fontWeight: 700, fontSize: 20}}>{speakerName}</span>
      </div>
    </div>
  );
};

export const DuoInterviewComposition = (props: ReelCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const activeLine = getActiveLine(frame, fps, props.scriptLines);
  const activeSpeaker = activeLine?.speaker ?? null;
  const subtitleAccent = activeSpeaker === "B" ? props.speakerB.color : props.speakerA.color;

  const isMainSpeakerA = activeSpeaker === "A";

  const introProgress = spring({
    frame,
    fps,
    config: {damping: 14, stiffness: 100},
    durationInFrames: 30,
  });
  
  const sceneOpacity = interpolate(introProgress, [0, 1], [0, 1]);
  const sceneTranslateY = interpolate(introProgress, [0, 1], [40, 0]);
  const subtitleYPercent = getSubtitleYFromPosition(props.editConfig.subtitlePosition, props.editConfig.subtitleY);

  const mainSpeakerWidth = width * 0.65;
  const pipSize = 120;

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
      <BackgroundLayer backgroundSrc={props.backgroundSrc} editConfig={props.editConfig} />
      {props.audioSrc ? <Audio src={props.audioSrc} /> : null}

      <AudioVisualizer speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} scriptLines={props.scriptLines} />
      <ProgressBar color={subtitleAccent} />

      <SpeakerSticker
        speakerId="A"
        speaker={props.speakerA}
        activeLine={activeLine}
        isActive={isMainSpeakerA}
        editConfig={{
          ...props.editConfig,
          stickerSize: 180,
        }}
        subtitleYPercent={subtitleYPercent}
      />
      <SpeakerSticker
        speakerId="B"
        speaker={props.speakerB}
        activeLine={activeLine}
        isActive={!isMainSpeakerA && activeSpeaker === "B"}
        editConfig={{
          ...props.editConfig,
          stickerSize: 180,
        }}
        subtitleYPercent={subtitleYPercent}
      />

      <PIPSticker
        speakerId="B"
        speaker={props.speakerB}
        isActive={!isMainSpeakerA}
        size={pipSize}
      />

      <InterviewNamePlate
        speakerName={props.speakerA.label}
        accentColor={props.speakerA.color}
        isMain={isMainSpeakerA}
      />
      <InterviewNamePlate
        speakerName={props.speakerB.label}
        accentColor={props.speakerB.color}
        isMain={!isMainSpeakerA}
      />

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