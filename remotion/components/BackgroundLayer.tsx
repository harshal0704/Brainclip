import {Img, interpolate, useCurrentFrame, useVideoConfig, OffthreadVideo} from "remotion";

import type {BackgroundType, ColorGrading, EditConfig, KenBurnsConfig} from "../types";

type BackgroundLayerProps = {
  backgroundSrc: string;
  editConfig: EditConfig;
  backgroundType?: BackgroundType;
  backgroundImage?: string;
};

const getColorGradingFilter = (colorGrading: ColorGrading): string => {
  switch (colorGrading) {
    case "warm":
      return "sepia(0.25) saturate(1.15) brightness(1.05)";
    case "cool":
      return "saturate(0.85) hue-rotate(12deg) brightness(1.05)";
    case "vintage":
      return "sepia(0.35) contrast(1.1) brightness(0.95)";
    case "cinematic":
      return "contrast(1.15) saturate(0.85) brightness(0.92)";
    case "noir":
      return "grayscale(1) contrast(1.2) brightness(0.9)";
    case "none":
    default:
      return "none";
  }
};

const getGradientStyle = (colors: string[], colorGrading: ColorGrading): React.CSSProperties => {
  const gradient = colors.length >= 2
    ? `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 100%)`
    : `linear-gradient(180deg, #1f3344 0%, #0a1620 100%)`;
  
  return {
    background: gradient,
    filter: getColorGradingFilter(colorGrading),
  };
};

const getKenBurnsStyle = (kenBurns: KenBurnsConfig, frame: number): React.CSSProperties => {
  const cycleFrame = frame % (kenBurns.duration * 30);
  const progress = cycleFrame / (kenBurns.duration * 30);
  
  const scale = interpolate(progress, [0, 1], [kenBurns.zoomStart, kenBurns.zoomEnd], {extrapolateRight: "clamp"});
  const translateX = interpolate(progress, [0, 1], [kenBurns.panStartX, kenBurns.panEndX]);
  const translateY = interpolate(progress, [0, 1], [kenBurns.panStartY, kenBurns.panEndY]);
  
  return {
    position: "absolute" as const,
    inset: 0,
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
  };
};

export const BackgroundLayer = ({
  backgroundSrc,
  editConfig,
  backgroundType = "video",
  backgroundImage,
}: BackgroundLayerProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  
  const {bgDimOpacity, bgBlur, bgSaturation, bgBrightness, bgContrast, bgScale, bgGradientColors, kenBurns, colorGrading} = editConfig;
  
  const hasKenBurns = kenBurns?.enabled;
  const colorGradingFilter = getColorGradingFilter(colorGrading);
  
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  };
  
  // Single unified vignette — combines dim + edge darkening in one layer
  // This replaces the old separate overlayStyle + vignetteStyle
  const unifiedVignetteStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: [
      // Soft radial vignette (edge darkening)
      `radial-gradient(ellipse 72% 65% at 50% 50%, transparent 0%, rgba(3,8,14,${Math.min(0.85, bgDimOpacity + 0.35)}) 100%)`,
      // Top fade for safe area
      `linear-gradient(180deg, rgba(3,8,14,${bgDimOpacity * 0.6}) 0%, transparent 18%)`,
      // Bottom fade for subtitle readability
      `linear-gradient(0deg, rgba(3,8,14,${bgDimOpacity * 0.8}) 0%, transparent 22%)`,
    ].join(", "),
    pointerEvents: "none",
  };
  
  // Build the media filter — applied once on the media container
  const mediaFilterParts: string[] = [];
  if (bgBlur > 0) mediaFilterParts.push(`blur(${bgBlur}px)`);
  if (bgSaturation !== 1) mediaFilterParts.push(`saturate(${bgSaturation})`);
  if (bgBrightness !== 1) mediaFilterParts.push(`brightness(${bgBrightness})`);
  if (bgContrast !== 1) mediaFilterParts.push(`contrast(${bgContrast})`);
  if (colorGradingFilter !== "none") mediaFilterParts.push(colorGradingFilter);
  
  const mediaFilter = mediaFilterParts.length > 0 ? mediaFilterParts.join(" ") : "none";

  const renderBackground = () => {
    switch (backgroundType) {
      case "image":
        return (
          <div style={{...containerStyle, filter: mediaFilter, transform: `scale(${bgScale})`}}>
            {backgroundImage && (
              <Img
                src={backgroundImage}
                style={{width: "100%", height: "100%", objectFit: "cover"}}
              />
            )}
            {hasKenBurns && <div style={getKenBurnsStyle(kenBurns, frame)} />}
          </div>
        );
      
      case "gradient":
        return (
          <div
            style={{
              ...containerStyle,
              ...getGradientStyle(bgGradientColors, colorGrading),
            }}
          />
        );
      
      case "solid":
        return (
          <div
            style={{
              ...containerStyle,
              background: bgGradientColors[0] || "#1f3344",
              filter: colorGradingFilter,
            }}
          />
        );
      
      case "video":
      default:
        return (
          <div style={{...containerStyle, filter: mediaFilter}}>
            {backgroundSrc ? (
              <OffthreadVideo
                src={backgroundSrc}
                muted
                loop
                endAt={durationInFrames}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${bgScale})`,
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 28%), linear-gradient(180deg, #1f3344 0%, #0a1620 54%, #05080c 100%)",
                }}
              />
            )}
            {hasKenBurns && backgroundSrc && (
              <div style={getKenBurnsStyle(kenBurns, frame)} />
            )}
          </div>
        );
    }
  };

  return (
    <div style={{position: "absolute", inset: 0}}>
      {renderBackground()}
      <div style={unifiedVignetteStyle} />
    </div>
  );
};