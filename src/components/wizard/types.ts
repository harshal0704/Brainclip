"use client";

import type { ScriptLine } from "@/lib/scriptGen";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type StickerAnim = "bounce" | "slide" | "float" | "pulse" | "shake" | "static" | "spin";
export type SubtitlePosition = "top" | "middle" | "bottom";
export type StickerShape = "circle" | "rounded-square" | "hexagon";
export type ColorGrading = "none" | "warm" | "cool" | "vintage" | "cinematic" | "noir";
export type FontFamily = "Inter" | "Montserrat" | "Poppins" | "Roboto" | "Oswald" | "Bebas Neue" | "Anton";

export type EditorForm = {
  topic: string;
  tone: string;
  language: string;
  duoId: string;
  speakerAPersona: string;
  speakerBPersona: string;
  voiceMode: "fish-api" | "colab";
  subtitleStyle: string;
  stickerAnim: StickerAnim;
  stickerShape: StickerShape;
  stickerUrlA: string;
  stickerUrlB: string;
  backgroundUrl: string;
  backgroundGameId: string;
  bgDimOpacity: number;
  showProgressBar: boolean;
  assetPackId: string;
  resolution: "720p" | "480p";
  ctaText: string;
  draftId?: string;
  // New creative fields
  subtitlePosition: SubtitlePosition;
  subtitleSize: number;
  subtitleColor: string;
  subtitleOutlineColor: string;
  subtitleOutlineWidth: number;
  subtitleFontFamily: FontFamily;
  colorGrading: ColorGrading;
};

export type CompletedSteps = Set<WizardStep>;

export type SettingsState = {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  ttsProvider: "fish" | "huggingface" | "elevenlabs" | "polly" | "colab";
  renderProvider: "lambda" | "colab" | "github";
  fishModelA: string;
  fishModelB: string;
  fishApiKey: string;
  hfModelA: string;
  hfModelB: string;
  hfToken: string;
  elevenLabsVoiceA: string;
  elevenLabsVoiceB: string;
  elevenLabsApiKey: string;
  pollyVoiceA: string;
  pollyVoiceB: string;
  colabUrl: string;
  githubToken: string;
  githubRepo: string;
  hasLlmApiKey?: boolean;
  hasFishApiKey?: boolean;
  hasHfToken?: boolean;
  hasElevenLabsApiKey?: boolean;
  hasGithubToken?: boolean;
};

export type { ScriptLine };