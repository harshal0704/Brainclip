-- Add missing video mode columns to jobs table
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "video_mode" text DEFAULT 'duo-debate';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "video_style" text DEFAULT 'default';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "speaker_layout" text DEFAULT 'bottom-anchored';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "single_speaker_config" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "intro_config" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "outro_config" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "end_card_config" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "overlays" jsonb DEFAULT '[]'::jsonb NOT NULL;
