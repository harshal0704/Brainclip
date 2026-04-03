import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";

type ProgressBarProps = {
  color: string;
};

export const ProgressBar = ({color}: ProgressBarProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width} = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, width], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{position: "absolute", left: 0, top: 0, width: "100%", height: 4, overflow: "hidden"}}>
      {/* Track */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />
      {/* Fill */}
      <div
        style={{
          height: "100%",
          width: progress,
          background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)`,
          boxShadow: `0 0 12px ${color}88, 0 0 4px ${color}44`,
          borderRadius: "0 2px 2px 0",
          position: "relative",
        }}
      >
        {/* Leading glow dot */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: -2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
          }}
        />
      </div>
    </div>
  );
};
