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
      return "sepia(0.3) saturate(1.2) brightness(1.05)";
    case "cool":
      return "saturate(0.9) hue-rotate(15deg) brightness(1.05)";
    case "vintage":
      return "sepia(0.4) contrast(1.1) brightness(0.95)";
    case "cinematic":
      return "contrast(1.15) saturate(0.9) brightness(0.95)";
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

const KenBurnsEffect = ({kenBurns, colorGrading}: {kenBurns: KenBurnsConfig; colorGrading: ColorGrading}) => {
  const frame = useCurrentFrame();
  const cycleFrame = frame % (kenBurns.duration * 30);
  const progress = cycleFrame / (kenBurns.duration * 30);
  
  const scale = interpolate(progress, [0, 1], [kenBurns.zoomStart, kenBurns.zoomEnd], {extrapolateRight: "clamp"});
  const translateX = interpolate(progress, [0, 1], [kenBurns.panStartX, kenBurns.panEndX]);
  const translateY = interpolate(progress, [0, 1], [kenBurns.panStartY, kenBurns.panEndY]);
  
  return {
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
    filter: getColorGradingFilter(colorGrading),
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
  
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: `rgba(4, 10, 16, ${bgDimOpacity})`,
  };
  
  const vignetteStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(5,10,15,0.7) 0%, rgba(5,10,15,0.12) 28%, rgba(5,10,15,0.18) 72%, rgba(5,10,15,0.82) 100%)",
  };
  
  const colorFilterStyle: React.CSSProperties = {
    filter: `blur(${bgBlur}px) saturate(${bgSaturation}) brightness(${bgBrightness}) contrast(${bgContrast}) ${colorGradingFilter}`,
  };

  const renderBackground = () => {
    switch (backgroundType) {
      case "image":
        return (
          <div style={{...containerStyle, ...colorFilterStyle, transform: `scale(${bgScale})`}}>
            {backgroundImage && (
              <Img
                src={backgroundImage}
                style={{width: "100%", height: "100%", objectFit: "cover"}}
              />
            )}
            {hasKenBurns && <div style={KenBurnsEffect({kenBurns, colorGrading})} />}
          </div>
        );
      
      case "gradient":
        return (
          <div
            style={{
              ...containerStyle,
              ...getGradientStyle(bgGradientColors, colorGrading),
            }}
          >
            {hasKenBurns && <div style={KenBurnsEffect({kenBurns, colorGrading})} />}
          </div>
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
          <div style={{...containerStyle, ...colorFilterStyle}}>
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
                  filter: colorGradingFilter,
                }}
              />
            )}
            {hasKenBurns && backgroundSrc && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  ...KenBurnsEffect({kenBurns, colorGrading: "none"}),
                }}
              />
            )}
          </div>
        );
    }
  };

  return (
    <div style={{position: "absolute", inset: 0}}>
      {renderBackground()}
      <div style={overlayStyle} />
      <div style={vignetteStyle} />
    </div>
  );
};