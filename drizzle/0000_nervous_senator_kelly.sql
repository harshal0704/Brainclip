CREATE TYPE "public"."job_status" AS ENUM('pending', 'voice_processing', 'voice_done', 'rendering', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_resolution" AS ENUM('720p', '480p');--> statement-breakpoint
CREATE TYPE "public"."voice_source" AS ENUM('upload', 'clone', 'preset');--> statement-breakpoint
CREATE TABLE "custom_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" "voice_source" DEFAULT 'upload' NOT NULL,
	"reference_audio_key" text,
	"preview_audio_key" text,
	"fish_model_id" text,
	"fish_clone_status" text,
	"duration_sec" real,
	"sample_rate" integer,
	"format" text,
	"file_size_bytes" integer,
	"language" text DEFAULT 'en',
	"gender" text,
	"tone" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"recommended_emotion" text DEFAULT 'neutral',
	"recommended_rate" real DEFAULT 1,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"stage" text,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"script_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"edit_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subtitle_style_id" text,
	"background_url" text,
	"asset_pack_id" text,
	"resolution" "video_resolution" DEFAULT '720p' NOT NULL,
	"s3_audio_keys" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"s3_transcript_key" text,
	"s3_video_key" text,
	"lambda_render_id" text,
	"lambda_bucket" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" text,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"password_hash" text,
	"s3_bucket" text,
	"s3_region" text DEFAULT 'ap-south-1' NOT NULL,
	"colab_url" text,
	"colab_healthy" boolean DEFAULT false NOT NULL,
	"fish_api_key" text,
	"fish_model_a" text,
	"fish_model_b" text,
	"llm_api_key" text,
	"llm_base_url" text,
	"llm_model" text,
	"drive_refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "voice_packs" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"persona" text NOT NULL,
	"language" text NOT NULL,
	"gender" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"preview_url" text,
	"colab_ref_url" text,
	"fish_model_id" text,
	"recommended_emotion" text,
	"recommended_rate" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_voices" ADD CONSTRAINT "custom_voices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;