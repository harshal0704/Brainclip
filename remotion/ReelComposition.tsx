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
// AmbientOrbs — subtle drifting light particles (refined)
// ------------------------------------------------------------
const AmbientOrbs = ({speakerAColor, speakerBColor, activeSpeaker}: {speakerAColor: string; speakerBColor: string; activeSpeaker: SpeakerId | null}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const orbs = [
    {x: 0.12, yBase: 0.18, color: speakerAColor, size: 200, speed: 0.0012, phase: 0},
    {x: 0.88, yBase: 0.15, color: speakerBColor, size: 160, speed: 0.0016, phase: 1.4},
    {x: 0.5,  yBase: 0.5,  color: speakerAColor, size: 140, speed: 0.001,  phase: 2.8},
    {x: 0.22, yBase: 0.82, color: speakerBColor, size: 180, speed: 0.0014, phase: 0.6},
  ];

  return (
    <>
      {orbs.map((orb, i) => {
        const drift = Math.sin(frame * orb.speed + orb.phase) * 20;
        // Orbs respond to active speaker — glow brighter when matching
        const isMatchingSpeaker = (i % 2 === 0 && activeSpeaker === "A") || (i % 2 === 1 && activeSpeaker === "B");
        const baseOpacity = 0.04 + Math.sin(frame * orb.speed * 1.5 + orb.phase) * 0.025;
        const orbOpacity = isMatchingSpeaker ? baseOpacity + 0.03 : baseOpacity;
        
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
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 65%)`,
              opacity: orbOpacity,
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

// ------------------------------------------------------------
// SpeakerGlow — minimal speaker-reactive glow (replaces heavy ConversationOverlay)
// ------------------------------------------------------------
const SpeakerGlow = ({activeSpeaker, speakerAColor, speakerBColor}: {activeSpeaker: SpeakerId | null; speakerAColor: string; speakerBColor: string}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const pulse = 0.12 + Math.sin(frame * 0.06) * 0.06;
  const activeColor = activeSpeaker === "B" ? speakerBColor : speakerAColor;

  return (
    <>
      {/* Single subtle reactive glow — follows active speaker */}
      <div
        style={{
          position: "absolute",
          top: height * 0.4,
          left: width / 2 - 280,
          width: 560,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${activeColor} 0%, transparent 60%)`,
          opacity: activeSpeaker ? pulse : pulse * 0.3,
          filter: "blur(50px)",
          pointerEvents: "none",
          transition: "opacity 0.4s ease",
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

      {/* Subtle ambient orbs — speaker-reactive */}
      <AmbientOrbs speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} activeSpeaker={activeSpeaker} />

      {/* Single clean speaker glow (replaces heavy ConversationOverlay) */}
      <SpeakerGlow activeSpeaker={activeSpeaker} speakerAColor={props.speakerA.color} speakerBColor={props.speakerB.color} />

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
