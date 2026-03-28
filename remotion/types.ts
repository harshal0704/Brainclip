import {z} from "zod";

export const speakerIdSchema = z.enum(["A", "B"]);

// Video composition modes
export const videoModeSchema = z.enum([
  "duo-debate",
  "duo-interview",
  "duo-side-by-side",
  "duo-split-screen",
  "single-host",
  "single-presenter",
]);

// Video style presets
export const videoStyleSchema = z.enum([
  "default",
  "social-reels",
  "news-anchor",
  "podcast",
  "tutorial",
  "vlog",
]);

// Speaker layout options
export const speakerLayoutSchema = z.enum([
  "top-bottom",
  "left-right",
  "split-left",
  "split-right",
  "center-focus",
  "bottom-anchored",
]);

// Background types
export const backgroundTypeSchema = z.enum(["video", "image", "gradient", "solid"]);

// Ken Burns effect config
export const kenBurnsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  zoomStart: z.number().min(1).max(2).default(1),
  zoomEnd: z.number().min(1).max(2).default(1.1),
  panStartX: z.number().min(-50).max(50).default(0),
  panEndX: z.number().min(-50).max(50).default(0),
  panStartY: z.number().min(-50).max(50).default(0),
  panEndY: z.number().min(-50).max(50).default(0),
  duration: z.number().min(1).max(30).default(10),
});

// Color grading presets
export const colorGradingSchema = z.enum(["none", "warm", "cool", "vintage", "cinematic", "noir"]);

// Single speaker config
export const singleSpeakerConfigSchema = z.object({
  enabled: z.boolean().default(false),
  position: z.enum(["center", "left", "right", "bottom"]).default("center"),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  showNameTag: z.boolean().default(true),
  lowerThirdEnabled: z.boolean().default(true),
});

// Overlay element schema
export const overlayElementSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "emoji", "image", "watermark"]),
  content: z.string(),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]),
  startFrame: z.number().nonnegative(),
  endFrame: z.number().nonnegative(),
  opacity: z.number().min(0).max(1).default(1),
  scale: z.number().min(0.1).max(3).default(1),
});

// Intro config
export const introConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["logo", "text", "fade"]).default("fade"),
  duration: z.number().min(0.5).max(5).default(2),
  text: z.string().optional(),
  logoUrl: z.string().optional(),
});

// Outro config
export const outroConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["subscribe", "cta", "fade"]).default("subscribe"),
  duration: z.number().min(1).max(10).default(3),
  ctaText: z.string().default("Subscribe for more!"),
  showWatermark: z.boolean().default(true),
});

// End card config
export const endCardConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["subscribe", "link", "qr"]).default("subscribe"),
  title: z.string().default("Thanks for watching!"),
  subtitle: z.string().default("Like and subscribe for more content"),
  buttonText: z.string().default("Subscribe"),
  showSocialIcons: z.boolean().default(true),
});

export const wordTimingSchema = z.object({
  id: z.string().optional(),
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export const scriptLineSchema = z.object({
  id: z.string(),
  speaker: speakerIdSchema,
  text: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
});

export const speakerConfigSchema = z.object({
  label: z.string(),
  stickerUrl: z.string(),
  color: z.string(),
  stickerEnabled: z.boolean().default(true),
});

export const subtitleStyleSchema = z.enum([
  "pop-highlight",
  "word-fade",
  "karaoke",
  "full-line",
  "typewriter",
  "pill",
  "social-captions",
  "news-crawl",
  "lower-third",
  "popup",
  "glitch",
  "neon",
]);

export const stickerAnimSchema = z.enum(["bounce", "slide", "float", "pulse", "shake", "static", "spin"]);

// Speaker sticker position
export const stickerPositionSchema = z.enum(["left", "center", "right", "bottom"]);

// Speaker sticker shape
export const stickerShapeSchema = z.enum(["circle", "rounded-square", "hexagon"]);

export const fontFamilySchema = z.enum([
  "Inter",
  "Montserrat",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lato",
  "Oswald",
  "Playfair Display",
  "Bebas Neue",
  "Anton",
]);

export const textAlignSchema = z.enum(["left", "center", "right"]);

export const transitionStyleSchema = z.enum(["none", "fade", "slide-up", "slide-down", "zoom", "blur"]);

export const subtitlePositionSchema = z.enum(["top", "middle", "bottom", "custom"]);

export const editConfigSchema = z.object({
  // Sticker settings
  stickerAnim: stickerAnimSchema,
  stickerPosition: stickerPositionSchema.default("center"),
  stickerShape: stickerShapeSchema.default("circle"),
  stickerScale: z.number().min(0.5).max(2.0).default(1.0),
  stickerGlowIntensity: z.number().min(0).max(1).default(0.5),
  stickerBorderWidth: z.number().min(0).max(10).default(3),
  stickerOffsetX: z.number().min(-200).max(200).default(0),
  stickerOffsetY: z.number().min(-200).max(200).default(0),
  showStickerLabels: z.boolean().default(true),
  stickerSize: z.number().min(60).max(250).default(152),
  stickerGap: z.number().min(10).max(150).default(20),
  
  // Subtitle settings
  subtitlePosition: subtitlePositionSchema.default("bottom"),
  subtitleSize: z.number().min(18).max(120),
  subtitleY: z.number().min(0).max(100),
  subtitleFontFamily: fontFamilySchema.default("Inter"),
  subtitleFontWeight: z.number().min(400).max(900).default(700),
  subtitleLetterSpacing: z.number().min(-2).max(10).default(0),
  subtitleLineHeight: z.number().min(0.8).max(2).default(1.2),
  subtitleTextAlign: textAlignSchema.default("center"),
  subtitlePadding: z.number().min(0).max(100).default(20),
  subtitleShadowBlur: z.number().min(0).max(30).default(8),
  subtitleShadowOffsetY: z.number().min(0).max(20).default(2),
  subtitleBackgroundOpacity: z.number().min(0).max(1).default(0),
  subtitleBackgroundBlur: z.number().min(0).max(20).default(0),
  
  // Background settings
  bgDimOpacity: z.number().min(0).max(1),
  bgBlur: z.number().min(0).max(30).default(0),
  bgSaturation: z.number().min(0).max(2).default(1),
  bgBrightness: z.number().min(0).max(2).default(1),
  bgContrast: z.number().min(0).max(2).default(1),
  bgScale: z.number().min(1).max(1.5).default(1),
  bgType: backgroundTypeSchema.default("video"),
  bgGradientColors: z.array(z.string()).default(["#1f3344", "#0a1620"]),
  kenBurns: kenBurnsConfigSchema,
  colorGrading: colorGradingSchema.default("none"),
  
  // Layout settings
  safeAreaPadding: z.number().min(0).max(100).default(36),
  progressBarHeight: z.number().min(2).max(12).default(4),
  progressBarY: z.number().min(0).max(100).default(0),
  showProgressBar: z.boolean().default(true),
  showIntroBadge: z.boolean().default(true),
  introBadgeDuration: z.number().min(0).max(5).default(3),
  
  // Animation timing
  transitionStyle: transitionStyleSchema.default("fade"),
  transitionDuration: z.number().min(0.1).max(1).default(0.3),
  speakerHighlightDelay: z.number().min(0).max(0.5).default(0.05),
  
  // Color overrides
  subtitleColor: z.string().default("#ffffff"),
  subtitleOutlineColor: z.string().default("#000000"),
  subtitleOutlineWidth: z.number().min(0).max(10).default(0),
  progressBarBgColor: z.string().default("rgba(255,255,255,0.2)"),
  
  // Watermark
  watermarkText: z.string().max(50).default(""),
  watermarkPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("bottom-right"),
  watermarkOpacity: z.number().min(0).max(1).default(0.6),
  watermarkSize: z.number().min(8).max(24).default(12),
});

// Simple edit config for backward compatibility
export const simpleEditConfigSchema = z.object({
  stickerAnim: stickerAnimSchema,
  subtitleSize: z.number().min(18).max(120),
  subtitleY: z.number().min(0).max(100),
  bgDimOpacity: z.number().min(0).max(1),
});

export const reelCompositionSchema = z.object({
  audioSrc: z.string(),
  backgroundSrc: z.string(),
  wordTimings: z.array(wordTimingSchema),
  scriptLines: z.array(scriptLineSchema),
  speakerA: speakerConfigSchema,
  speakerB: speakerConfigSchema,
  subtitleStyle: subtitleStyleSchema,
  editConfig: editConfigSchema,
  // New fields for enhanced video modes
  videoMode: videoModeSchema.default("duo-debate"),
  videoStyle: videoStyleSchema.default("default"),
  speakerLayout: speakerLayoutSchema.default("bottom-anchored"),
  singleSpeakerConfig: singleSpeakerConfigSchema.optional(),
  introConfig: introConfigSchema.optional(),
  outroConfig: outroConfigSchema.optional(),
  endCardConfig: endCardConfigSchema.optional(),
  overlays: z.array(overlayElementSchema).default([]),
});

export type SpeakerId = z.infer<typeof speakerIdSchema>;
export type VideoMode = z.infer<typeof videoModeSchema>;
export type VideoStyle = z.infer<typeof videoStyleSchema>;
export type SpeakerLayout = z.infer<typeof speakerLayoutSchema>;
export type BackgroundType = z.infer<typeof backgroundTypeSchema>;
export type KenBurnsConfig = z.infer<typeof kenBurnsConfigSchema>;
export type ColorGrading = z.infer<typeof colorGradingSchema>;
export type SingleSpeakerConfig = z.infer<typeof singleSpeakerConfigSchema>;
export type OverlayElement = z.infer<typeof overlayElementSchema>;
export type IntroConfig = z.infer<typeof introConfigSchema>;
export type OutroConfig = z.infer<typeof outroConfigSchema>;
export type EndCardConfig = z.infer<typeof endCardConfigSchema>;
export type WordTiming = z.infer<typeof wordTimingSchema>;
export type ScriptLine = z.infer<typeof scriptLineSchema>;
export type SpeakerConfig = z.infer<typeof speakerConfigSchema>;
export type SubtitleStyleId = z.infer<typeof subtitleStyleSchema>;
export type StickerAnim = z.infer<typeof stickerAnimSchema>;
export type StickerPosition = z.infer<typeof stickerPositionSchema>;
export type StickerShape = z.infer<typeof stickerShapeSchema>;
export type FontFamily = z.infer<typeof fontFamilySchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type TransitionStyle = z.infer<typeof transitionStyleSchema>;
export type SubtitlePosition = z.infer<typeof subtitlePositionSchema>;
export type EditConfig = z.infer<typeof editConfigSchema>;
export type SimpleEditConfig = z.infer<typeof simpleEditConfigSchema>;
export type ReelCompositionProps = z.infer<typeof reelCompositionSchema>;

// Helper to get subtitle Y position from position preset
export const getSubtitleYFromPosition = (position: SubtitlePosition, customY?: number): number => {
  switch (position) {
    case "top": return 15;
    case "middle": return 45;
    case "bottom": return 75;
    case "custom": return customY ?? 65;
  }
};

// Default edit config values
export const defaultEditConfig: EditConfig = {
  stickerAnim: "bounce",
  stickerPosition: "center",
  stickerShape: "circle",
  stickerScale: 1.0,
  stickerGlowIntensity: 0.5,
  stickerBorderWidth: 3,
  stickerOffsetX: 0,
  stickerOffsetY: 0,
  showStickerLabels: true,
  stickerSize: 152,
  stickerGap: 20,
  subtitlePosition: "bottom",
  subtitleSize: 48,
  subtitleY: 75,
  subtitleFontFamily: "Inter",
  subtitleFontWeight: 700,
  subtitleLetterSpacing: 0,
  subtitleLineHeight: 1.2,
  subtitleTextAlign: "center",
  subtitlePadding: 20,
  subtitleShadowBlur: 8,
  subtitleShadowOffsetY: 2,
  subtitleBackgroundOpacity: 0,
  subtitleBackgroundBlur: 0,
  bgDimOpacity: 0.4,
  bgBlur: 0,
  bgSaturation: 1,
  bgBrightness: 1,
  bgContrast: 1,
  bgScale: 1,
  bgType: "video",
  bgGradientColors: ["#1f3344", "#0a1620"],
  kenBurns: {enabled: false, zoomStart: 1, zoomEnd: 1.1, panStartX: 0, panEndX: 0, panStartY: 0, panEndY: 0, duration: 10},
  colorGrading: "none",
  safeAreaPadding: 36,
  progressBarHeight: 4,
  progressBarY: 0,
  showProgressBar: true,
  showIntroBadge: true,
  introBadgeDuration: 3,
  transitionStyle: "fade",
  transitionDuration: 0.3,
  speakerHighlightDelay: 0.05,
  subtitleColor: "#ffffff",
  subtitleOutlineColor: "#000000",
  subtitleOutlineWidth: 0,
  progressBarBgColor: "rgba(255,255,255,0.2)",
  watermarkText: "",
  watermarkPosition: "bottom-right",
  watermarkOpacity: 0.6,
  watermarkSize: 12,
};

// Merge simple config with defaults
export const mergeEditConfig = (simple: Partial<SimpleEditConfig>): EditConfig => ({
  ...defaultEditConfig,
  ...simple,
});
