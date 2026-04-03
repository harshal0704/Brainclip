import {Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import {BackgroundLayer} from "../components/BackgroundLayer";
import {ProgressBar} from "../components/ProgressBar";
import {SpeakerSticker} from "../components/SpeakerSticker";
import {SubtitleLayer} from "../components/SubtitleLayer";
import {AudioVisualizer} from "../components/AudioVisualizer";
import type {ReelCompositionProps, ScriptLine, SingleSpeakerConfig, SpeakerId} from "../types";
import {getSubtitleYFromPosition} from "../types";

const getActiveLine = (frame: number, fps: number, scriptLines: ScriptLine[]) => {
  const time = frame / fps;
  return scriptLines.find((line) => time >= line.startSec && time <= line.endSec) ?? null;
};

const SingleHostIntro = ({accentColor}: {accentColor: string}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 14, stiffness: 120}});

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: width / 2 - 100,
        width: 200,
        padding: "12px 16px",
        borderRadius: 999,
        textAlign: "center",
        color: "white",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 1.2,
        background: `${accentColor}88`,
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
        opacity: interpolate(frame, [0, 20, 70, 90], [0, reveal, reveal, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${interpolate(reveal, [0, 1], [-14, 0])}px)`,
      }}
    >
      SINGLE HOST
    </div>
  );
};

const LowerThird = ({speakerName, accentColor, isVisible}: {speakerName: string; accentColor: string; isVisible: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame: isVisible ? 0 : 30, fps, config: {damping: 14, stiffness: 130}});

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        bottom: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [20, 0])}px)`,
      }}
    >
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: accentColor,
          borderRadius: 4,
        }}
      >
        <span style={{color: "#000", fontWeight: 800, fontSize: 16}}>{speakerName}</span>
      </div>
    </div>
  );
};

export const SingleHostComposition = (props: ReelCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const activeLine = getActiveLine(frame, fps, props.scriptLines);
  const subtitleAccent = props.speakerA.color;
  
  const singleSpeakerConfig = props.singleSpeakerConfig ?? {
    enabled: true,
    position: "center",
    size: "medium",
    showNameTag: true,
    lowerThirdEnabled: true,
  };

  const speakerConfig = props.speakerA;
  const isActive = activeLine !== null && activeLine.speaker === "A";

  const introProgress = spring({
    frame,
    fps,
    config: {damping: 14, stiffness: 100},
    durationInFrames: 30,
  });
  
  const sceneOpacity = interpolate(introProgress, [0, 1], [0, 1]);
  const sceneTranslateY = interpolate(introProgress, [0, 1], [40, 0]);
  const subtitleYPercent = getSubtitleYFromPosition(props.editConfig.subtitlePosition, props.editConfig.subtitleY);

  const stickerSize = singleSpeakerConfig.size === "small" 
    ? 100 
    : singleSpeakerConfig.size === "large" 
    ? 180 
    : 140;

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

      <SingleHostIntro accentColor={subtitleAccent} />
      <AudioVisualizer speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} scriptLines={props.scriptLines} />
      <ProgressBar color={subtitleAccent} />

      <SpeakerSticker
        speakerId="A"
        speaker={props.speakerA}
        activeLine={activeLine}
        isActive={isActive}
        editConfig={{
          ...props.editConfig,
          stickerSize,
        }}
        subtitleYPercent={subtitleYPercent}
      />

      <LowerThird
        speakerName={singleSpeakerConfig.showNameTag ? speakerConfig.label : ""}
        accentColor={subtitleAccent}
        isVisible={singleSpeakerConfig.lowerThirdEnabled && isActive}
      />

      <SubtitleLayer
        wordTimings={props.wordTimings}
        scriptLines={props.scriptLines}
        subtitleStyle={props.subtitleStyle}
        editConfig={{
          ...props.editConfig,
          subtitleY: singleSpeakerConfig.position === "bottom" ? 75 : 65,
        }}
        accentColor={subtitleAccent}
      />
    </div>
  );
};