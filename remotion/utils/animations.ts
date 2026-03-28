import {interpolate, spring} from "remotion";

export const animationTypes = {
  entry: "entry",
  exit: "exit",
  highlight: "highlight",
  reaction: "reaction",
  pulse: "pulse",
  shake: "shake",
  bounce: "bounce",
  float: "float",
  spin: "spin",
  glitch: "glitch",
} as const;

export type AnimationType = keyof typeof animationTypes;

export const createEntryAnimation = (
  frame: number,
  startFrame: number,
  animType: AnimationType = "entry"
): React.CSSProperties => {
  const elapsed = frame - startFrame;
  const progress = Math.max(0, Math.min(1, elapsed / 30));
  const springProgress = spring({frame: elapsed, fps: 30, config: {damping: 15, stiffness: 150}});

  switch (animType) {
    case "bounce":
      return {
        transform: `translateY(${interpolate(springProgress, [0, 1], [50, 0])}px) scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
        opacity: progress,
      };
    case "fade":
      return {opacity: progress};
    case "slide":
      return {
        transform: `translateX(${interpolate(springProgress, [0, 1], [100, 0])}px)`,
        opacity: progress,
      };
    case "zoom":
      return {
        transform: `scale(${interpolate(springProgress, [0, 1], [0.5, 1])})`,
        opacity: progress,
      };
    default:
      return {opacity: progress};
  }
};

export const createExitAnimation = (
  frame: number,
  startFrame: number,
  durationFrames: number = 30
): React.CSSProperties => {
  const elapsed = frame - startFrame;
  const progress = Math.max(0, Math.min(1, elapsed / durationFrames));
  
  return {
    opacity: 1 - progress,
    transform: `translateY(${progress * 20}px) scale(${1 - progress * 0.2})`,
  };
};

export const createHighlightAnimation = (
  frame: number,
  startFrame: number,
  durationFrames: number = 60
): React.CSSProperties => {
  const elapsed = frame - startFrame;
  const progress = Math.max(0, Math.min(1, elapsed / durationFrames));
  const pulse = Math.sin(progress * Math.PI);
  
  return {
    transform: `scale(${1 + pulse * 0.1})`,
    filter: `brightness(${1 + pulse * 0.3})`,
  };
};

export const createReactionAnimation = (
  frame: number,
  startFrame: number
): React.CSSProperties => {
  const elapsed = frame - startFrame;
  const bounce = spring({frame: elapsed, fps: 30, config: {damping: 8, stiffness: 300}});
  
  return {
    transform: `translateY(${interpolate(bounce, [0, 1], [0, -30, 0])}px) scale(${1 + bounce * 0.2})`,
  };
};

export const createBeatSyncAnimation = (
  frame: number,
  bpm: number = 120
): number => {
  const beatInterval = (60 / bpm) * 30;
  const beatProgress = (frame % beatInterval) / beatInterval;
  return interpolate(beatProgress, [0, 0.5, 1], [1, 1.15, 1], {extrapolateRight: "clamp"});
};

export const createFloatAnimation = (frame: number, amplitude: number = 10, speed: number = 0.1): number => {
  return Math.sin(frame * speed) * amplitude;
};

export const createPulseAnimation = (frame: number, minScale: number = 0.95, maxScale: number = 1.05, speed: number = 0.15): number => {
  return interpolate(Math.sin(frame * speed), [-1, 1], [minScale, maxScale], {extrapolateRight: "clamp"});
};

export const createGlitchAnimation = (frame: number, intensity: number = 1): React.CSSProperties => {
  const shouldGlitch = Math.random() < 0.1 * intensity;
  if (!shouldGlitch) {
    return {};
  }
  
  const offsetX = (Math.random() - 0.5) * 10 * intensity;
  const offsetY = (Math.random() - 0.5) * 5 * intensity;
  
  return {
    transform: `translate(${offsetX}px, ${offsetY}px)`,
    textShadow: `${offsetX}px 0 cyan, ${-offsetX}px 0 magenta`,
  };
};