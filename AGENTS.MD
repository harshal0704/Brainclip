## Project: svgen — Short Video Generator

### Architecture
- Next.js 14 App Router on Vercel (frontend + API)
- Google Colab FastAPI server (Fish S2-Pro TTS only, BYOK GPU)
- AWS Lambda + Remotion (video render engine, ~$0.03/video)
- AWS S3 per-user buckets (svgen-{userId}, ap-south-1)
- Postgres + Drizzle ORM for job/user state
- Fish.audio API as Colab fallback (BYOK key)
- Read the plan.html in the main folder for complete understanding 

### Key files
- /src/lib/s3.ts          — AWS S3 helpers (presigned URLs, bucket provision)
- /src/lib/render.ts      — renderMediaOnLambda wrapper
- /src/lib/voice.ts       — Fish S2-Pro Colab proxy + fish.audio API proxy
- /src/lib/scriptGen.ts   — LLM script generation with Fish Audio params
- /src/db/schema.ts       — Drizzle schema (users, jobs, voice_packs)
- /remotion/index.tsx     — Remotion composition entry (ReelComposition)
- /remotion/components/   — SubtitleLayer, SpeakerSticker, BackgroundLayer

### Conventions
- All S3 operations use presigned URLs — never expose bucket credentials to client
- Job status enum: pending|voice_processing|voice_done|rendering|done|failed
- Colab never holds AWS credentials — only receives presigned PUT URLs per job
- All LLM API keys stored encrypted in DB (AES-256 via crypto lib)
- TypeScript strict mode. Zod for all API input validation.
- Resolution: 720×1280 (720p default), 480×854 (480p draft)

### Environment variables
DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
REMOTION_SERVE_URL, REMOTION_FUNCTION_NAME,
NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
ENCRYPTION_KEY

### Skills & MCP Servers

#### UI/UX & Design
- **ui-ux-pro-max** — Use when designing sticker animations, subtitle styles, or visual components
- **frontend-design** — Use when building React components in /src/app or /src/components
- **figma** MCP — Use to read Figma files for design implementation (requires FIGMA_API_KEY env var)
- **stitch** MCP — Use for AI-powered UI design generation with Google Stitch (requires STITCH_API_KEY env var)

#### Framework & Performance
- **remotion-best-practices** — Use when editing files in /remotion/*
- **vercel-react-best-practices** — Use when optimizing Next.js performance, avoiding async waterfalls

#### AWS Infrastructure
- **aws-cdk-development** — Use when creating/modifying AWS infrastructure (S3, Lambda, IAM)
- **aws-serverless-eda** — Use when designing event-driven architectures (Lambda triggers, S3 events)
- **aws-cost-operations** — Use when optimizing costs, setting up CloudWatch monitoring

#### Data & Database
- **supabase** MCP — Use when exploring/querying Postgres schema (requires Supabase auth)

#### Research & External Data
- **firecrawl** MCP — Use for web scraping and research (requires FIRECRAWL_API_KEY env var)
- **sequential-thinking** MCP — Use for complex multi-step reasoning (delta re-TTS logic, orchestration)

#### Vercel Integration
- **vercel** MCP — Use for deployment analysis and build log debugging