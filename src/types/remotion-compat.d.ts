declare module "remotion" {
  export const Composition: any;
  export const registerRoot: (component: unknown) => void;
  export const Audio: any;
  export const Img: any;
  export const Sequence: any;
  export const OffthreadVideo: any;
  export const interpolate: (...args: any[]) => number;
  export const spring: (...args: any[]) => number;
  export const useCurrentFrame: () => number;
  export const useVideoConfig: () => {
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };
}
