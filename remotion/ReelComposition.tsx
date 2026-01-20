import {Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import {BackgroundLayer} from "./components/BackgroundLayer";
import {ProgressBar} from "./components/ProgressBar";
import {SpeakerSticker} from "./components/SpeakerSticker";
import {SubtitleLayer} from "./components/SubtitleLayer";
import type {ReelCompositionProps, ScriptLine, SpeakerId} from "./types";

const getActiveLine = (frame: number, fps: number, scriptLines: ScriptLine[]) => {
  const time = frame / fps;
  return scriptLines.find((line) => time >= line.startSec && time <= line.endSec) ?? null;
};

const getActiveSpeaker = (frame: number, fps: number, scriptLines: ScriptLine[]): SpeakerId | null => {
  const activeLine = getActiveLine(frame, fps, scriptLines);
  return activeLine?.speaker ?? null;
};

const ConversationOverlay = ({activeSpeaker, speakerAColor, speakerBColor}: {activeSpeaker: SpeakerId | null; speakerAColor: string; speakerBColor: string}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const shimmer = interpolate(frame % 45, [0, 22, 45], [0.12, 0.26, 0.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 78,
          left: width / 2 - 180,
          width: 360,
          height: 240,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${speakerAColor} 0%, transparent 70%)`,
          opacity: activeSpeaker === "A" ? shimmer : 0.1,
          filter: "blur(38px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 138,
          left: width / 2 - 180,
          width: 360,
          height: 240,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${speakerBColor} 0%, transparent 70%)`,
          opacity: activeSpeaker === "B" ? shimmer : 0.1,
          filter: "blur(38px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          top: 34,
          bottom: 34,
          borderRadius: 44,
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.03), 0 16px 40px rgba(0,0,0,0.18)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height / 2 - 90,
          height: 180,
          background: "linear-gradient(180deg, transparent 0%, rgba(5,8,12,0.18) 35%, rgba(5,8,12,0.52) 100%)",
        }}
      />
    </>
  );
};

const IntroBadge = ({speakerAColor, speakerBColor}: {speakerAColor: string; speakerBColor: string}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 14, stiffness: 120}});

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: width / 2 - 124,
        width: 248,
        padding: "12px 16px",
        borderRadius: 999,
        textAlign: "center",
        color: "white",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 1.2,
        background: `linear-gradient(90deg, ${speakerAColor}88 0%, ${speakerBColor}88 100%)`,
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
        opacity: interpolate(frame, [0, 20, 70, 90], [0, reveal, reveal, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${interpolate(reveal, [0, 1], [-14, 0])}px)`,
      }}
    >
      DUAL VOICE REEL
    </div>
  );
};

export const ReelComposition = (props: ReelCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeLine = getActiveLine(frame, fps, props.scriptLines);
  const activeSpeaker = getActiveSpeaker(frame, fps, props.scriptLines);
  const subtitleAccent = activeSpeaker === "B" ? props.speakerB.color : props.speakerA.color;

  return (
    <div style={{position: "absolute", inset: 0, backgroundColor: "#05080c", overflow: "hidden", color: "white"}}>
      <BackgroundLayer backgroundSrc={props.backgroundSrc} bgDimOpacity={props.editConfig.bgDimOpacity} />
      {props.audioSrc ? <Audio src={props.audioSrc} /> : null}

      <ConversationOverlay activeSpeaker={activeSpeaker} speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} />
      <IntroBadge speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} />
      <ProgressBar color={subtitleAccent} />

      <SpeakerSticker
        speakerId="A"
        speaker={props.speakerA}
        activeLine={activeLine}
        isActive={activeSpeaker === "A"}
        editConfig={props.editConfig}
      />
      <SpeakerSticker
        speakerId="B"
        speaker={props.speakerB}
        activeLine={activeLine}
        isActive={activeSpeaker === "B"}
        editConfig={props.editConfig}
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
