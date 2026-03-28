import {interpolate} from "remotion";

export const effectTypes = {
  vignette: "vignette",
  grain: "grain",
  colorGrading: "color-grading",
  blur: "blur",
  glow: "glow",
  shadow: "shadow",
} as const;

export type EffectType = keyof typeof effectTypes;

export const vignetteEffect = (intensity: number = 0.5): React.CSSProperties => ({
  boxShadow: `inset 0 0 ${interpolate(intensity, [0, 1], [100, 300])}px ${interpolate(intensity, [0, 1], [0.3, 0.8])} rgba(0,0,0,${intensity})`,
});

export const grainEffect = (frame: number, intensity: number = 0.1): React.CSSProperties => {
  const noise = Math.random() * intensity;
  return {
    filter: `contrast(${1 + noise}) brightness(${1 + noise * 0.5})`,
  };
};

export const colorGradingEffect = (
  brightness: number = 1,
  contrast: number = 1,
  saturation: number = 1,
  hueShift: number = 0,
  sepia: number = 0
): React.CSSProperties => ({
  filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hueShift}deg) sepia(${sepia})`,
});

export const blurEffect = (radius: number): React.CSSProperties => ({
  filter: `blur(${radius}px)`,
});

export const glowEffect = (color: string, intensity: number = 1): React.CSSProperties => ({
  boxShadow: `0 0 ${20 * intensity}px ${color}, 0 0 ${40 * intensity}px ${color}, 0 0 ${60 * intensity}px ${color}`,
});

export const shadowEffect = (
  offsetX: number = 0,
  offsetY: number = 4,
  blur: number = 8,
  color: string = "rgba(0,0,0,0.3)"
): React.CSSProperties => ({
  boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${color}`,
});

export const createAnimatedVignette = (frame: number, maxIntensity: number = 0.6): React.CSSProperties => {
  const pulse = (Math.sin(frame * 0.05) + 1) / 2;
  const intensity = maxIntensity * (0.7 + pulse * 0.3);
  
  return {
    boxShadow: `inset 0 0 200px rgba(0,0,0,${intensity})`,
  };
};

export const createAnimatedGrain = (frame: number, intensity: number = 0.15): string => {
  const noise = Math.sin(frame * 0.7) * intensity;
  return `contrast(${1 + noise})`;
};

export const createKenBurnsTransform = (
  frame: number,
  startScale: number = 1,
  endScale: number = 1.2,
  panStartX: number = 0,
  panEndX: number = 0,
  panStartY: number = 0,
  panEndY: number = 0,
  durationFrames: number = 300
): React.CSSProperties => {
  const progress = Math.min(1, frame / durationFrames);
  const scale = startScale + (endScale - startScale) * progress;
  const translateX = panStartX + (panEndX - panStartX) * progress;
  const translateY = panStartY + (panEndY - panStartY) * progress;
  
  return {
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
  };
};