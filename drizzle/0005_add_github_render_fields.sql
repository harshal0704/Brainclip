ALTER TABLE "users" ADD COLUMN "github_token" text;
ALTER TABLE "users" ADD COLUMN "github_repo" text;
ALTER TABLE "users" ADD COLUMN "github_healthy" boolean DEFAULT false NOT NULL;
