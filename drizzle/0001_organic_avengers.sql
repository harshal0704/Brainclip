-- Rename background_url to background_game in drafts table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drafts' AND column_name = 'background_url'
    ) THEN
        ALTER TABLE "drafts" RENAME COLUMN "background_url" TO "background_game";
    END IF;
END $$;

-- Add missing columns to users table if they don't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tts_provider" text DEFAULT 'fish' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "render_provider" text DEFAULT 'lambda' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hf_token" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hf_model_a" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hf_model_b" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "eleven_labs_api_key" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "eleven_labs_voice_a" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "eleven_labs_voice_b" text;

-- Create drafts table if it doesn't exist
CREATE TABLE IF NOT EXISTS "drafts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "topic" text NOT NULL,
    "duo_id" text,
    "speaker_a_persona" text,
    "speaker_b_persona" text,
    "voice_mode" text,
    "subtitle_style" text,
    "sticker_anim" text,
    "sticker_url_a" text,
    "sticker_url_b" text,
    "background_game" text,
    "bg_dim_opacity" real,
    "show_progress_bar" boolean,
    "asset_pack_id" text,
    "resolution" text,
    "cta_text" text,
    "script_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "fish_model_a" text,
    "fish_model_b" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'drafts_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;