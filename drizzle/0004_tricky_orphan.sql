ALTER TABLE "jobs" ADD COLUMN "video_mode" text DEFAULT 'duo-debate';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "video_style" text DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "speaker_layout" text DEFAULT 'bottom-anchored';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "single_speaker_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "intro_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "outro_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "end_card_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "overlays" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_repo" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_healthy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "render_provider" text DEFAULT 'lambda' NOT NULL;