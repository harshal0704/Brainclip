import {Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import {BackgroundLayer} from "./components/BackgroundLayer";
import {ProgressBar} from "./components/ProgressBar";
import {SpeakerSticker} from "./components/SpeakerSticker";
import {SubtitleLayer} from "./components/SubtitleLayer";
import {AudioVisualizer} from "./components/AudioVisualizer";
import type {ReelCompositionProps, ScriptLine, SpeakerId} from "./types";
import {getSubtitleYFromPosition} from "./types";

const getActiveLine = (frame: number, fps: number, scriptLines: ScriptLine[]) => {
  const time = frame / fps;
  return scriptLines.find((line) => time >= line.startSec && time <= line.endSec) ?? null;
};

const getActiveSpeaker = (frame: number, fps: number, scriptLines: ScriptLine[]): SpeakerId | null => {
  const activeLine = getActiveLine(frame, fps, scriptLines);
  return activeLine?.speaker ?? null;
};

// ------------------------------------------------------------
// AmbientOrbs — subtle drifting light particles
// ------------------------------------------------------------
const AmbientOrbs = ({speakerAColor, speakerBColor}: {speakerAColor: string; speakerBColor: string}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const orbs = [
    {x: 0.15, yBase: 0.22, color: speakerAColor, size: 180, speed: 0.0018, phase: 0},
    {x: 0.82, yBase: 0.18, color: speakerBColor, size: 140, speed: 0.0022, phase: 1.2},
    {x: 0.5,  yBase: 0.55, color: speakerAColor, size: 120, speed: 0.0015, phase: 2.4},
    {x: 0.25, yBase: 0.78, color: speakerBColor, size: 160, speed: 0.002,  phase: 0.8},
    {x: 0.74, yBase: 0.65, color: speakerAColor, size: 100, speed: 0.0025, phase: 3.1},
  ];

  return (
    <>
      {orbs.map((orb, i) => {
        const drift = Math.sin(frame * orb.speed + orb.phase) * 28;
        const pulsate = 0.06 + Math.sin(frame * orb.speed * 1.7 + orb.phase) * 0.04;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              left: orb.x * width - orb.size / 2,
              top: orb.yBase * height - orb.size / 2 + drift,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 68%)`,
              opacity: pulsate,
              filter: "blur(32px)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

// ------------------------------------------------------------
// ConversationOverlay — smooth shimmer with spring
// ------------------------------------------------------------
const ConversationOverlay = ({activeSpeaker, speakerAColor, speakerBColor}: {activeSpeaker: SpeakerId | null; speakerAColor: string; speakerBColor: string}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  // Pulsing glow — smooth sine instead of raw interpolate
  const shimmerA = 0.14 + Math.sin(frame * 0.08) * 0.08;
  const shimmerB = 0.14 + Math.sin(frame * 0.08 + Math.PI) * 0.08;

  return (
    <>
      {/* Speaker A glow */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: width / 2 - 200,
          width: 400,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${speakerAColor} 0%, transparent 68%)`,
          opacity: activeSpeaker === "A" ? shimmerA + 0.12 : shimmerA * 0.4,
          filter: "blur(42px)",
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Speaker B glow */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: width / 2 - 200,
          width: 400,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${speakerBColor} 0%, transparent 68%)`,
          opacity: activeSpeaker === "B" ? shimmerB + 0.12 : shimmerB * 0.4,
          filter: "blur(42px)",
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Frame border */}
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
      {/* Center vignette band */}
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

// ------------------------------------------------------------
// IntroBadge
// ------------------------------------------------------------
const IntroBadge = ({speakerAColor, speakerBColor, show}: {speakerAColor: string; speakerBColor: string; show: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 14, stiffness: 120}});

  if (!show) return null;

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

// ------------------------------------------------------------
// WatermarkLayer
// ------------------------------------------------------------
const WatermarkLayer = ({text, position, opacity, size}: {text: string; position: string; opacity: number; size: number}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const breathe = 1 + Math.sin(frame * 0.03) * 0.008;

  const posMap: Record<string, {top?: number; bottom?: number; left?: number; right?: number}> = {
    "top-left":     {top: 28, left: 28},
    "top-right":    {top: 28, right: 28},
    "bottom-left":  {bottom: 44, left: 28},
    "bottom-right": {bottom: 44, right: 28},
  };
  const pos = posMap[position] ?? posMap["bottom-right"];

  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        fontSize: size,
        fontWeight: 600,
        color: "rgba(255,255,255,0.82)",
        letterSpacing: 0.5,
        opacity,
        transform: `scale(${breathe})`,
        textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        pointerEvents: "none",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {text}
    </div>
  );
};

// ------------------------------------------------------------
// Main composition
// ------------------------------------------------------------
export const ReelComposition = (props: ReelCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeLine = getActiveLine(frame, fps, props.scriptLines);
  const activeSpeaker = getActiveSpeaker(frame, fps, props.scriptLines);
  const subtitleAccent = activeSpeaker === "B" ? props.speakerB.color : props.speakerA.color;

  // Scene intro — fade + slide up
  const introProgress = spring({
    frame,
    fps,
    config: {damping: 16, stiffness: 100},
    durationInFrames: 28,
  });

  const sceneOpacity = interpolate(introProgress, [0, 1], [0, 1]);
  const sceneTranslateY = interpolate(introProgress, [0, 1], [36, 0]);
  const subtitleYPercent = getSubtitleYFromPosition(props.editConfig.subtitlePosition, props.editConfig.subtitleY);

  const showIntroBadge = props.editConfig.showIntroBadge !== false;
  const watermarkText = props.editConfig.watermarkText ?? "";

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

      {/* Ambient floating orbs */}
      <AmbientOrbs speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} />

      <ConversationOverlay activeSpeaker={activeSpeaker} speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} />
      <AudioVisualizer speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} scriptLines={props.scriptLines} />
      <IntroBadge speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} show={showIntroBadge} />

      {props.editConfig.showProgressBar !== false && (
        <ProgressBar color={subtitleAccent} />
      )}

      <SpeakerSticker
        speakerId="A"
        speaker={props.speakerA}
        activeLine={activeLine}
        isActive={activeSpeaker === "A"}
        editConfig={props.editConfig}
        subtitleYPercent={subtitleYPercent}
      />
      <SpeakerSticker
        speakerId="B"
        speaker={props.speakerB}
        activeLine={activeLine}
        isActive={activeSpeaker === "B"}
        editConfig={props.editConfig}
        subtitleYPercent={subtitleYPercent}
      />

      <SubtitleLayer
        wordTimings={props.wordTimings}
        scriptLines={props.scriptLines}
        subtitleStyle={props.subtitleStyle}
        editConfig={props.editConfig}
        accentColor={subtitleAccent}
      />

      {watermarkText && (
        <WatermarkLayer
          text={watermarkText}
          position={props.editConfig.watermarkPosition ?? "bottom-right"}
          opacity={props.editConfig.watermarkOpacity ?? 0.6}
          size={props.editConfig.watermarkSize ?? 12}
        />
      )}
    </div>
  );
};
