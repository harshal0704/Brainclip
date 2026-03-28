import type {CSSProperties} from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import type {EditConfig, ScriptLine, SubtitleStyleId, WordTiming} from "../types";
import {getSubtitleYFromPosition} from "../types";

type SubtitleLayerProps = {
  wordTimings: WordTiming[];
  scriptLines: ScriptLine[];
  subtitleStyle: SubtitleStyleId;
  editConfig: EditConfig;
  accentColor: string;
};

type DisplayWord = WordTiming & {
  key: string;
  isPast: boolean;
  isActive: boolean;
};

const getActiveLine = (timeInSeconds: number, scriptLines: ScriptLine[]) => {
  return scriptLines.find((line) => timeInSeconds >= line.startSec && timeInSeconds <= line.endSec) ?? null;
};

const getLineWords = (line: ScriptLine | null, wordTimings: WordTiming[]) => {
  if (!line) {
    return [];
  }

  const inWindow = wordTimings.filter((word) => word.end >= line.startSec - 0.05 && word.start <= line.endSec + 0.05);
  if (inWindow.length > 0) {
    return inWindow.map((word, index) => ({...word, key: word.id ?? `${line.id}-${index}`}));
  }

  const words = line.text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.2, line.endSec - line.startSec);
  const step = duration / Math.max(words.length, 1);
  return words.map((word, index) => ({
    word,
    start: line.startSec + step * index,
    end: index === words.length - 1 ? line.endSec : line.startSec + step * (index + 1),
    key: `${line.id}-fallback-${index}`,
  }));
};

const containerStyle = (editConfig: EditConfig): CSSProperties => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: editConfig.subtitleTextAlign === "left" ? "flex-start" : editConfig.subtitleTextAlign === "right" ? "flex-end" : "center",
  gap: "10px 12px",
  maxWidth: 640,
  padding: `${editConfig.subtitlePadding ?? 18}px ${(editConfig.subtitlePadding ?? 18) + 4}px`,
  borderRadius: 28,
  backgroundColor: `rgba(7, 12, 17, ${editConfig.subtitleBackgroundOpacity ?? 0})`,
  backdropFilter: editConfig.subtitleBackgroundBlur ? `blur(${editConfig.subtitleBackgroundBlur}px)` : undefined,
  textAlign: editConfig.subtitleTextAlign ?? "center",
  lineHeight: editConfig.subtitleLineHeight ?? 1.18,
  letterSpacing: editConfig.subtitleLetterSpacing ?? 0,
  fontSize: editConfig.subtitleSize,
  fontWeight: editConfig.subtitleFontWeight ?? 900,
  fontFamily: editConfig.subtitleFontFamily ? `${editConfig.subtitleFontFamily}, sans-serif` : "Inter, sans-serif",
  color: editConfig.subtitleColor ?? "#f7f5ef",
  textShadow: editConfig.subtitleOutlineWidth && editConfig.subtitleOutlineWidth > 0
    ? `${editConfig.subtitleOutlineWidth}px ${editConfig.subtitleOutlineWidth}px 0 ${editConfig.subtitleOutlineColor ?? "#000"}, -${editConfig.subtitleOutlineWidth}px -${editConfig.subtitleOutlineWidth}px 0 ${editConfig.subtitleOutlineColor ?? "#000"}, ${editConfig.subtitleOutlineWidth}px -${editConfig.subtitleOutlineWidth}px 0 ${editConfig.subtitleOutlineColor ?? "#000"}, -${editConfig.subtitleOutlineWidth}px ${editConfig.subtitleOutlineWidth}px 0 ${editConfig.subtitleOutlineColor ?? "#000"}`
    : `0 ${editConfig.subtitleShadowOffsetY ?? 2}px ${editConfig.subtitleShadowBlur ?? 8}px rgba(0,0,0,0.58)`,
});

export const SubtitleLayer = ({wordTimings, scriptLines, subtitleStyle, editConfig, accentColor}: SubtitleLayerProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeInSeconds = frame / fps;
  const activeLine = getActiveLine(timeInSeconds, scriptLines);
  const subtitleY = getSubtitleYFromPosition(editConfig.subtitlePosition, editConfig.subtitleY);

  // Spring fade-in when subtitle container first appears
  const lineKey = activeLine?.id ?? "none";
  const revealSpring = spring({frame, fps, config: {damping: 18, stiffness: 160}, durationInFrames: 12});
  const containerOpacity = activeLine ? Math.min(1, revealSpring) : 0;
  const containerTranslateY = activeLine ? interpolate(revealSpring, [0, 1], [12, 0]) : 0;

  if (!activeLine) {
    return null;
  }

  const words = getLineWords(activeLine, wordTimings).map((word) => ({
    ...word,
    isPast: timeInSeconds > word.end,
    isActive: timeInSeconds >= word.start && timeInSeconds <= word.end,
  })) as DisplayWord[];
  const lineDuration = Math.max(0.001, activeLine.endSec - activeLine.startSec);
  const lineProgress = Math.min(1, Math.max(0, (timeInSeconds - activeLine.startSec) / lineDuration));
  const visibleWords = words.filter((word) => word.isPast || word.isActive).length;

  // Base text color (respects editConfig override)
  const baseColor = editConfig.subtitleColor ?? "#f7f5ef";

  const wordStyle = (word: DisplayWord): CSSProperties => ({
    display: "inline-block",
    color: word.isActive ? accentColor : baseColor,
    opacity: word.isPast || word.isActive ? 1 : 0.45,
  });

  const renderWord = (word: DisplayWord, index: number) => {
    const startFrame = Math.max(0, frame - Math.floor(word.start * fps));
    const pop = spring({frame: startFrame, fps, config: {damping: 14, stiffness: 170}});

    switch (subtitleStyle) {
      case "word-fade":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              opacity: interpolate(timeInSeconds, [word.start - 0.06, word.start, word.end], [0, 1, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {word.word}
          </span>
        );
      case "karaoke": {
        const fill = word.isPast
          ? 1
          : interpolate(timeInSeconds, [word.start, word.end], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              backgroundImage: `linear-gradient(${accentColor}, ${accentColor})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${fill * 100}% 7px`,
              backgroundPosition: "0 100%",
              paddingBottom: 8,
            }}
          >
            {word.word}
          </span>
        );
      }
      case "pill":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              padding: "7px 14px",
              borderRadius: 999,
              backgroundColor: word.isActive ? accentColor : "rgba(255,255,255,0.08)",
              color: word.isActive ? "#071017" : baseColor,
              border: `1px solid ${word.isActive ? accentColor : "rgba(255,255,255,0.14)"}`,
              transform: word.isActive ? `scale(${1 + pop * 0.08})` : "scale(1)",
            }}
          >
            {word.word}
          </span>
        );
      case "social-captions":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              fontFamily: editConfig.subtitleFontFamily ? `${editConfig.subtitleFontFamily}, sans-serif` : "Poppins, sans-serif",
              fontSize: editConfig.subtitleSize * 1.1,
              fontWeight: 800,
              textTransform: "uppercase",
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: word.isActive ? "rgba(255,255,255,0.15)" : "transparent",
              transform: word.isActive ? `translateY(${Math.sin(index * 0.5) * 3}px)` : "translateY(0)",
              transition: "all 0.15s ease-out",
            }}
          >
            {word.word}
          </span>
        );
      case "news-crawl":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              fontFamily: "Roboto Mono, monospace",
              fontSize: editConfig.subtitleSize * 0.9,
              fontWeight: 500,
              letterSpacing: 1,
              borderBottom: word.isActive ? `3px solid ${accentColor}` : "none",
              backgroundColor: word.isActive ? "rgba(0,0,0,0.5)" : "transparent",
              padding: "4px 0",
            }}
          >
            {word.word}
          </span>
        );
      case "popup":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              transform: word.isActive ? `scale(${1 + pop * 0.30}) translateY(${interpolate(pop, [0,1], [8, 0])}px)` : "scale(1)",
              display: "inline-block",
              filter: word.isActive ? `drop-shadow(0 0 8px ${accentColor}88)` : "none",
            }}
          >
            {word.word}
          </span>
        );
      case "glitch": {
        const glitchOffset = word.isActive ? Math.sin(frame * 2.4 + index) * 3 : 0;
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              color: word.isActive ? accentColor : baseColor,
              textShadow: word.isActive
                ? `${glitchOffset}px 0 ${accentColor}, ${-glitchOffset}px 0 #ff00ff, 0 ${glitchOffset}px #00ffff`
                : "none",
              transform: word.isActive ? `skewX(${Math.sin(frame * 3) * 4}deg)` : "skewX(0)",
            }}
          >
            {word.word}
          </span>
        );
      }
      case "neon":
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              color: word.isActive ? accentColor : baseColor,
              textShadow: word.isActive
                ? `0 0 8px ${accentColor}, 0 0 18px ${accentColor}, 0 0 38px ${accentColor}99`
                : `0 2px 4px rgba(0,0,0,0.5)`,
              fontFamily: editConfig.subtitleFontFamily ? `${editConfig.subtitleFontFamily}, sans-serif` : "Orbitron, sans-serif",
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {word.word}
          </span>
        );
      case "pop-highlight":
      default:
        return (
          <span
            key={word.key}
            style={{
              ...wordStyle(word),
              display: "inline-block",
              transform: word.isActive
                ? `scale(${1 + pop * 0.18}) rotate(${Math.sin(index * 1.5) * pop * 2}deg)`
                : "scale(1)",
              textShadow: word.isActive
                ? `0 4px 12px ${accentColor}88, 0 8px 30px rgba(0,0,0,0.8)`
                : `0 ${editConfig.subtitleShadowOffsetY ?? 2}px ${editConfig.subtitleShadowBlur ?? 8}px rgba(0,0,0,0.58)`,
              backgroundImage: word.isActive
                ? `linear-gradient(135deg, ${editConfig.subtitleColor ?? "#ffffff"} 0%, ${accentColor} 100%)`
                : "none",
              WebkitBackgroundClip: word.isActive ? "text" : "border-box",
              WebkitTextFillColor: word.isActive ? "transparent" : baseColor,
              color: word.isActive ? "transparent" : baseColor,
              filter: word.isActive ? `drop-shadow(0px 2px 4px rgba(0,0,0,0.5))` : "none",
            }}
          >
            {word.word}
          </span>
        );
    }
  };

  let content: React.ReactNode;

  switch (subtitleStyle) {
    case "full-line":
      content = (
        <div style={{...containerStyle(editConfig), overflow: "hidden"}}>
          <div style={{width: `${lineProgress * 100}%`, overflow: "hidden", whiteSpace: "nowrap", margin: "0 auto"}}>
            <span>{activeLine.text}</span>
          </div>
        </div>
      );
      break;
    case "typewriter":
      content = (
        <div style={containerStyle(editConfig)}>
          <span>{words.slice(0, visibleWords).map((word) => word.word).join(" ")}</span>
          <span style={{marginLeft: 8, opacity: frame % 16 < 8 ? 1 : 0, color: accentColor}}>|</span>
        </div>
      );
      break;
    case "lower-third":
      content = (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          maxWidth: 500,
        }}>
          <div style={{
            padding: "8px 16px",
            backgroundColor: accentColor,
            borderRadius: 4,
            marginBottom: 8,
          }}>
            <span style={{color: "#000", fontWeight: 800, fontSize: editConfig.subtitleSize * 0.7, fontFamily: editConfig.subtitleFontFamily ? `${editConfig.subtitleFontFamily}, sans-serif` : "Inter, sans-serif"}}>
              {activeLine.speaker === "A" ? "SPEAKER A" : "SPEAKER B"}
            </span>
          </div>
          <div style={containerStyle(editConfig)}>
            {words.map(renderWord)}
          </div>
        </div>
      );
      break;
    default:
      content = <div style={containerStyle(editConfig)}>{words.map(renderWord)}</div>;
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        top: `${subtitleY}%`,
        display: "flex",
        justifyContent: "center",
        opacity: containerOpacity,
        transform: `translateY(${containerTranslateY}px)`,
      }}
    >
      {content}
    </div>
  );
};
