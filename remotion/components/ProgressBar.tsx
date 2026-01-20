import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";

type ProgressBarProps = {
  color: string;
};

export const ProgressBar = ({color}: ProgressBarProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width} = useVideoConfig();

  return (
    <div style={{position: "absolute", left: 0, top: 0, width: "100%", height: 8}}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      />
      <div
        style={{
          height: 4,
          width: interpolate(frame, [0, durationInFrames], [0, width], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          backgroundColor: color,
          boxShadow: `0 0 18px ${color}`,
        }}
      />
    </div>
  );
};
