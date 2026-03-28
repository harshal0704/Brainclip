import {interpolate, spring} from "remotion";

export const transitionTypes = {
  fade: "fade",
  slideUp: "slide-up",
  slideDown: "slide-down",
  slideLeft: "slide-left",
  slideRight: "slide-right",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
  blur: "blur",
  wipe: "wipe",
  bounce: "bounce",
} as const;

export type TransitionType = keyof typeof transitionTypes;

export const getTransitionStyle = (
  transitionType: TransitionType,
  progress: number,
  direction: "in" | "out" = "in"
): React.CSSProperties => {
  const p = direction === "in" ? progress : 1 - progress;

  switch (transitionType) {
    case "fade":
      return {opacity: p};
    case "slide-up":
      return {transform: `translateY(${interpolate(p, [0, 1], [50, 0])}px)`, opacity: p};
    case "slide-down":
      return {transform: `translateY(${interpolate(p, [0, 1], [-50, 0])}px)`, opacity: p};
    case "slide-left":
      return {transform: `translateX(${interpolate(p, [0, 1], [50, 0])}px)`, opacity: p};
    case "slide-right":
      return {transform: `translateX(${interpolate(p, [0, 1], [-50, 0])}px)`, opacity: p};
    case "zoom-in":
      return {transform: `scale(${interpolate(p, [0, 1], [0.8, 1])}), opacity: p`};
    case "zoom-out":
      return {transform: `scale(${interpolate(p, [0, 1], [1.2, 1])}), opacity: p`};
    case "blur":
      return {
        opacity: p,
        filter: `blur(${interpolate(p, [0, 1], [10, 0])}px)`,
      };
    case "wipe":
      return {clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`};
    case "bounce":
      const bounce = spring({frame: p * 30, fps: 30, config: {damping: 10, stiffness: 200}});
      return {
        transform: `translateY(${interpolate(bounce, [0, 1], [20, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
        opacity: p,
      };
    default:
      return {opacity: p};
  }
};

export const getTransitionDuration = (transitionType: TransitionType): number => {
  switch (transitionType) {
    case "bounce":
      return 0.6;
    case "zoom-in":
    case "zoom-out":
      return 0.4;
    case "blur":
      return 0.5;
    default:
      return 0.3;
  }
};

export const calculateTransitionProgress = (
  frame: number,
  transitionStart: number,
  duration: number
): number => {
  const elapsed = frame - transitionStart;
  return Math.max(0, Math.min(1, elapsed / (duration * 30)));
};