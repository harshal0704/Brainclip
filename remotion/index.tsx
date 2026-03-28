import {Composition, registerRoot} from "remotion";

import {ReelComposition} from "./ReelComposition";
import {SingleHostComposition} from "./compositions/SingleHostComposition";
import {DuoInterviewComposition} from "./compositions/DuoInterviewComposition";
import {SideBySideComposition} from "./compositions/SideBySideComposition";
import {reelCompositionSchema, defaultEditConfig, mergeEditConfig, getSubtitleYFromPosition, type ReelCompositionProps, videoModeSchema} from "./types";

const getDurationInFrames = (props: ReelCompositionProps) => {
  const lastWord = props.wordTimings.reduce((max, word) => Math.max(max, word.end), 0);
  const lastLine = props.scriptLines.reduce((max, line) => Math.max(max, line.endSec), 0);
  return Math.max(90, Math.ceil(Math.max(lastWord, lastLine) * 30));
};

const defaultProps: ReelCompositionProps = {
  audioSrc: "",
  backgroundSrc: "",
  wordTimings: [
    {id: "word-0", word: "This", start: 0, end: 0.28},
    {id: "word-1", word: "reel", start: 0.28, end: 0.62},
    {id: "word-2", word: "switches", start: 0.62, end: 1.04},
    {id: "word-3", word: "between", start: 1.04, end: 1.42},
    {id: "word-4", word: "two", start: 1.42, end: 1.72},
    {id: "word-5", word: "speakers.", start: 1.72, end: 2.18},
    {id: "word-6", word: "Every", start: 2.4, end: 2.72},
    {id: "word-7", word: "word", start: 2.72, end: 3.02},
    {id: "word-8", word: "lands", start: 3.02, end: 3.36},
    {id: "word-9", word: "on", start: 3.36, end: 3.56},
    {id: "word-10", word: "the", start: 3.56, end: 3.76},
    {id: "word-11", word: "beat.", start: 3.76, end: 4.12},
  ],
  scriptLines: [
    {id: "line-1", speaker: "A", text: "This reel switches between two speakers.", startSec: 0, endSec: 2.18},
    {id: "line-2", speaker: "B", text: "Every word lands on the beat.", startSec: 2.4, endSec: 4.12},
  ],
  speakerA: {label: "Speaker A", stickerUrl: "", color: "#61d6ff", stickerEnabled: false},
  speakerB: {label: "Speaker B", stickerUrl: "", color: "#ffb259", stickerEnabled: false},
  subtitleStyle: "pop-highlight",
  editConfig: mergeEditConfig({
    stickerAnim: "bounce",
    subtitleSize: 48,
    subtitleY: 75,
    bgDimOpacity: 0.34,
  }),
  videoMode: "duo-debate",
  videoStyle: "default",
  speakerLayout: "bottom-anchored",
  overlays: [],
};

const getCompositionComponent = (videoMode: string) => {
  switch (videoMode) {
    case "single-host":
    case "single-presenter":
      return SingleHostComposition;
    case "duo-interview":
      return DuoInterviewComposition;
    case "duo-side-by-side":
    case "duo-split-screen":
      return SideBySideComposition;
    case "duo-debate":
    default:
      return ReelComposition;
  }
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ReelComposition"
        component={ReelComposition}
        width={720}
        height={1280}
        fps={30}
        durationInFrames={getDurationInFrames(defaultProps)}
        schema={reelCompositionSchema}
        defaultProps={defaultProps}
        calculateMetadata={({props}: {props: ReelCompositionProps}) => ({
          durationInFrames: getDurationInFrames(props),
        })}
      />
      <Composition
        id="SingleHostComposition"
        component={SingleHostComposition}
        width={720}
        height={1280}
        fps={30}
        durationInFrames={getDurationInFrames(defaultProps)}
        schema={reelCompositionSchema}
        defaultProps={defaultProps}
        calculateMetadata={({props}: {props: ReelCompositionProps}) => ({
          durationInFrames: getDurationInFrames(props),
        })}
      />
      <Composition
        id="DuoInterviewComposition"
        component={DuoInterviewComposition}
        width={720}
        height={1280}
        fps={30}
        durationInFrames={getDurationInFrames(defaultProps)}
        schema={reelCompositionSchema}
        defaultProps={defaultProps}
        calculateMetadata={({props}: {props: ReelCompositionProps}) => ({
          durationInFrames: getDurationInFrames(props),
        })}
      />
      <Composition
        id="SideBySideComposition"
        component={SideBySideComposition}
        width={720}
        height={1280}
        fps={30}
        durationInFrames={getDurationInFrames(defaultProps)}
        schema={reelCompositionSchema}
        defaultProps={defaultProps}
        calculateMetadata={({props}: {props: ReelCompositionProps}) => ({
          durationInFrames: getDurationInFrames(props),
        })}
      />
    </>
  );
};

registerRoot(RemotionRoot);