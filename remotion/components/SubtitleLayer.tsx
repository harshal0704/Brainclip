import type {CSSProperties} from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

import type {EditConfig, ScriptLine, SubtitleStyleId, WordTiming} from "../types";

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
  justifyContent: "center",
  gap: "10px 12px",
  maxWidth: 640,
  padding: "18px 22px",
  borderRadius: 28,
  backgroundColor: "rgba(7, 12, 17, 0.42)",
  backdropFilter: "blur(12px)",
  textAlign: "center",
  lineHeight: 1.18,
  fontSize: editConfig.subtitleSize,
  fontWeight: 900,
  color: "#f7f5ef",
  textShadow: "0 8px 30px rgba(0,0,0,0.58)",
});

export const SubtitleLayer = ({wordTimings, scriptLines, subtitleStyle, editConfig, accentColor}: SubtitleLayerProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeInSeconds = frame / fps;
  const activeLine = getActiveLine(timeInSeconds, scriptLines);

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

  const wordStyle = (word: DisplayWord): CSSProperties => ({
    display: "inline-block",
    color: word.isActive ? accentColor : "#f7f5ef",
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
              color: word.isActive ? "#071017" : "#f7f5ef",
              border: `1px solid ${word.isActive ? accentColor : "rgba(255,255,255,0.14)"}`,
              transform: word.isActive ? `scale(${1 + pop * 0.08})` : "scale(1)",
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
              transform: word.isActive ? `scale(${1 + pop * 0.12})` : "scale(1)",
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
        top: `${editConfig.subtitleY}%`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {content}
    </div>
  );
};
