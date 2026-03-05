"use client";

import type { ScriptLine } from "@/lib/scriptGen";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type StickerAnim = "bounce" | "slide" | "float" | "pulse" | "shake" | "static" | "spin";

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
  stickerUrlA: string;
  stickerUrlB: string;
  backgroundUrl: string;
  bgDimOpacity: number;
  showProgressBar: boolean;
  assetPackId: string;
  resolution: "720p" | "480p";
  ctaText: string;
  draftId?: string;
};

export type CompletedSteps = Set<WizardStep>;

export type SettingsState = {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  ttsProvider: "fish" | "huggingface" | "elevenlabs";
  fishModelA: string;
  fishModelB: string;
  fishApiKey: string;
  hfModelA: string;
  hfModelB: string;
  hfToken: string;
  elevenLabsVoiceA: string;
  elevenLabsVoiceB: string;
  elevenLabsApiKey: string;
  colabUrl: string;
  hasLlmApiKey?: boolean;
  hasFishApiKey?: boolean;
  hasHfToken?: boolean;
  hasElevenLabsApiKey?: boolean;
};

export type { ScriptLine };