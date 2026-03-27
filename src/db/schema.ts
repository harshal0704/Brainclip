import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "voice_processing",
  "voice_done",
  "rendering",
  "done",
  "failed",
]);

export const resolutionEnum = pgEnum("video_resolution", ["720p", "480p"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: text("google_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  passwordHash: text("password_hash"),
  s3Bucket: text("s3_bucket"),
  s3Region: text("s3_region").default("us-east-1").notNull(),
  colabUrl: text("colab_url"),
  colabHealthy: boolean("colab_healthy").default(false).notNull(),
  ttsProvider: text("tts_provider").default("fish").notNull(),
  renderProvider: text("render_provider").default("lambda").notNull(),
  fishApiKey: text("fish_api_key"),
  fishModelA: text("fish_model_a"),
  fishModelB: text("fish_model_b"),
  hfToken: text("hf_token"),
  hfModelA: text("hf_model_a"),
  hfModelB: text("hf_model_b"),
  elevenLabsApiKey: text("eleven_labs_api_key"),
  elevenLabsVoiceA: text("eleven_labs_voice_a"),
  elevenLabsVoiceB: text("eleven_labs_voice_b"),
  pollyVoiceA: text("polly_voice_a").default("Matthew"),
  pollyVoiceB: text("polly_voice_b").default("Joanna"),
  llmApiKey: text("llm_api_key"),
  llmBaseUrl: text("llm_base_url"),
  llmModel: text("llm_model"),
  driveRefreshToken: text("drive_refresh_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: jobStatusEnum("status").default("pending").notNull(),
  stage: text("stage"),
  progressPct: integer("progress_pct").default(0).notNull(),
  scriptLines: jsonb("script_lines").$type<Record<string, unknown>[]>().default([]).notNull(),
  voiceMap: jsonb("voice_map").$type<Record<string, unknown>>().default({}).notNull(),
  editConfig: jsonb("edit_config").$type<Record<string, unknown>>().default({}).notNull(),
  subtitleStyleId: text("subtitle_style_id"),
  backgroundUrl: text("background_url"),
  assetPackId: text("asset_pack_id"),
  resolution: resolutionEnum("resolution").default("720p").notNull(),
  s3AudioKeys: jsonb("s3_audio_keys").$type<Record<string, string>>().default({}).notNull(),
  s3TranscriptKey: text("s3_transcript_key"),
  s3VideoKey: text("s3_video_key"),
  lambdaRenderId: text("lambda_render_id"),
  lambdaBucket: text("lambda_bucket"),
  errorMessage: text("error_message"),
  // New video mode fields
  videoMode: text("video_mode").default("duo-debate"),
  videoStyle: text("video_style").default("default"),
  speakerLayout: text("speaker_layout").default("bottom-anchored"),
  singleSpeakerConfig: jsonb("single_speaker_config").$type<Record<string, unknown>>().default({}),
  introConfig: jsonb("intro_config").$type<Record<string, unknown>>().default({}),
  outroConfig: jsonb("outro_config").$type<Record<string, unknown>>().default({}),
  endCardConfig: jsonb("end_card_config").$type<Record<string, unknown>>().default({}),
  overlays: jsonb("overlays").$type<Record<string, unknown>[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const voicePacks = pgTable("voice_packs", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  persona: text("persona").notNull(),
  language: text("language").notNull(),
  gender: text("gender"),
  tags: text("tags").array().default([]).notNull(),
  previewUrl: text("preview_url"),
  colabRefUrl: text("colab_ref_url"),
  fishModelId: text("fish_model_id"),
  recommendedEmotion: text("recommended_emotion"),
  recommendedRate: real("recommended_rate"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const drafts = pgTable("drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  duoId: text("duo_id"),
  speakerAPersona: text("speaker_a_persona"),
  speakerBPersona: text("speaker_b_persona"),
  voiceMode: text("voice_mode"),
  subtitleStyle: text("subtitle_style"),
  stickerAnim: text("sticker_anim"),
  stickerUrlA: text("sticker_url_a"),
  stickerUrlB: text("sticker_url_b"),
  backgroundUrl: text("background_url"),
  bgDimOpacity: real("bg_dim_opacity"),
  showProgressBar: boolean("show_progress_bar"),
  assetPackId: text("asset_pack_id"),
  resolution: text("resolution"),
  ctaText: text("cta_text"),
  scriptLines: jsonb("script_lines").$type<Record<string, unknown>[]>().default([]).notNull(),
  fishModelA: text("fish_model_a"),
  fishModelB: text("fish_model_b"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const voiceSourceEnum = pgEnum("voice_source", ["upload", "clone", "preset"]);

export const customVoices = pgTable("custom_voices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  source: voiceSourceEnum("source").default("upload").notNull(),
  // S3 keys for stored audio
  referenceAudioKey: text("reference_audio_key"),
  previewAudioKey: text("preview_audio_key"),
  // Fish.audio model ID (after voice cloning via API)
  fishModelId: text("fish_model_id"),
  fishCloneStatus: text("fish_clone_status"), // pending, processing, ready, failed
  // Colab S2-Pro encoding (replaces Fish.audio for cloning)
  colabRefText: text("colab_ref_text"), // reference text used for encoding
  colabCloneStatus: text("colab_clone_status"), // pending, encoding, ready, failed
  // Audio metadata
  durationSec: real("duration_sec"),
  sampleRate: integer("sample_rate"),
  format: text("format"), // wav, mp3, etc.
  fileSizeBytes: integer("file_size_bytes"),
  // Voice characteristics (user-defined or auto-detected)
  language: text("language").default("en"),
  gender: text("gender"),
  tone: text("tone"), // warm, energetic, calm, etc.
  tags: text("tags").array().default([]).notNull(),
  // Settings
  recommendedEmotion: text("recommended_emotion").default("neutral"),
  recommendedRate: real("recommended_rate").default(1.0),
  isPublic: boolean("is_public").default(false).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customVoicesRelations = relations(customVoices, ({ one }) => ({
  user: one(users, {
    fields: [customVoices.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  customVoices: many(customVoices),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
}));
