import {OffthreadVideo, useVideoConfig} from "remotion";

type BackgroundLayerProps = {
  backgroundSrc: string;
  bgDimOpacity: number;
};

export const BackgroundLayer = ({backgroundSrc, bgDimOpacity}: BackgroundLayerProps) => {
  const {durationInFrames} = useVideoConfig();

  return (
    <div style={{position: "absolute", inset: 0}}>
      {backgroundSrc ? (
        <OffthreadVideo
          src={backgroundSrc}
          muted
          loop
          endAt={durationInFrames}
          style={{width: "100%", height: "100%", objectFit: "cover"}}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 28%), linear-gradient(180deg, #1f3344 0%, #0a1620 54%, #05080c 100%)",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(4, 10, 16, ${bgDimOpacity})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,10,15,0.7) 0%, rgba(5,10,15,0.12) 28%, rgba(5,10,15,0.18) 72%, rgba(5,10,15,0.82) 100%)",
        }}
      />
    </div>
  );
};
