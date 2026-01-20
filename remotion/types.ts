import {z} from "zod";

export const speakerIdSchema = z.enum(["A", "B"]);

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
});

export const subtitleStyleSchema = z.enum([
  "pop-highlight",
  "word-fade",
  "karaoke",
  "full-line",
  "typewriter",
  "pill",
]);

export const stickerAnimSchema = z.enum(["bounce", "slide", "float", "pulse", "shake", "static"]);

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

export const editConfigSchema = z.object({
  // Sticker settings
  stickerAnim: stickerAnimSchema,
  stickerScale: z.number().min(0.5).max(2.0).default(1.0),
  stickerGlowIntensity: z.number().min(0).max(1).default(0.5),
  stickerBorderWidth: z.number().min(0).max(10).default(3),
  stickerOffsetX: z.number().min(-200).max(200).default(0),
  stickerOffsetY: z.number().min(-200).max(200).default(0),
  showStickerLabels: z.boolean().default(true),
  
  // Subtitle settings
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
});

export type SpeakerId = z.infer<typeof speakerIdSchema>;
export type WordTiming = z.infer<typeof wordTimingSchema>;
export type ScriptLine = z.infer<typeof scriptLineSchema>;
export type SpeakerConfig = z.infer<typeof speakerConfigSchema>;
export type SubtitleStyleId = z.infer<typeof subtitleStyleSchema>;
export type StickerAnim = z.infer<typeof stickerAnimSchema>;
export type FontFamily = z.infer<typeof fontFamilySchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type TransitionStyle = z.infer<typeof transitionStyleSchema>;
export type EditConfig = z.infer<typeof editConfigSchema>;
export type SimpleEditConfig = z.infer<typeof simpleEditConfigSchema>;
export type ReelCompositionProps = z.infer<typeof reelCompositionSchema>;

// Default edit config values
export const defaultEditConfig: EditConfig = {
  stickerAnim: "bounce",
  stickerScale: 1.0,
  stickerGlowIntensity: 0.5,
  stickerBorderWidth: 3,
  stickerOffsetX: 0,
  stickerOffsetY: 0,
  showStickerLabels: true,
  subtitleSize: 48,
  subtitleY: 65,
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
