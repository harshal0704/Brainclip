CREATE TABLE "drafts" (
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
	"background_url" text,
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
--> statement-breakpoint
ALTER TABLE "custom_voices" ADD COLUMN "colab_ref_text" text;--> statement-breakpoint
ALTER TABLE "custom_voices" ADD COLUMN "colab_clone_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tts_provider" text DEFAULT 'fish' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hf_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hf_model_a" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hf_model_b" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "eleven_labs_api_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "eleven_labs_voice_a" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "eleven_labs_voice_b" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "polly_voice_a" text DEFAULT 'Matthew';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "polly_voice_b" text DEFAULT 'Joanna';--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;