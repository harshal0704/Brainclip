import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { customVoices } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { requireUserFromRequest } from "@/lib/session";
import {
  voiceUploadSchema,
  generateVoiceUploadUrls,
  generateVoiceDownloadUrls,
} from "@/lib/voiceUpload";

/**
 * GET /api/voices/custom
 * List all custom voices for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const url = new URL(request.url);
    const includeUrls = url.searchParams.get("includeUrls") === "true";

    const voices = await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.userId, user.id))
      .orderBy(desc(customVoices.createdAt));

    // Optionally include presigned download URLs
    let voicesWithUrls = voices;
    if (includeUrls && user.s3Bucket) {
      voicesWithUrls = await Promise.all(
        voices.map(async (voice) => {
          try {
            const urls = await generateVoiceDownloadUrls({
              bucket: user.s3Bucket!,
              referenceKey: voice.referenceAudioKey,
              previewKey: voice.previewAudioKey,
              region: user.s3Region,
            });
            return { ...voice, urls };
          } catch (err) {
            console.error(`[Voices] Failed to generate URLs for voice ${voice.id}:`, err instanceof Error ? err.message : String(err));
            return { ...voice, urls: null };
          }
        }),
      );
    }

    return NextResponse.json({
      voices: voicesWithUrls,
      total: voices.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/voices/custom
 * Create a new custom voice entry and get presigned upload URLs
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = voiceUploadSchema.parse(await request.json());

    if (!user.s3Bucket) {
      throw new AppError(
        "bucket_missing",
        "User has no S3 bucket",
        "Your storage bucket is not provisioned. Sign out and back in.",
        400,
      );
    }

    // Check user's voice limit (max 50 custom voices per user)
    const existingCount = await db
      .select({ id: customVoices.id })
      .from(customVoices)
      .where(eq(customVoices.userId, user.id));

    if (existingCount.length >= 50) {
      throw new AppError(
        "voice_limit_reached",
        "User has reached maximum voice limit",
        "You can have up to 50 custom voices. Delete some to add more.",
        400,
      );
    }

    const voiceId = crypto.randomUUID();

    // Generate presigned upload URLs
    const { keys, urls } = await generateVoiceUploadUrls({
      bucket: user.s3Bucket,
      userId: user.id,
      voiceId,
      region: user.s3Region,
    });

    // Create the voice record
    const [createdVoice] = await db
      .insert(customVoices)
      .values({
        id: voiceId,
        userId: user.id,
        name: body.name,
        description: body.description,
        source: "upload",
        referenceAudioKey: keys.referenceAudio,
        previewAudioKey: keys.previewAudio,
        language: body.language,
        gender: body.gender,
        tone: body.tone,
        tags: body.tags,
        recommendedEmotion: body.recommendedEmotion,
        recommendedRate: body.recommendedRate,
        fishCloneStatus: "pending",
      })
      .returning();

    return NextResponse.json({
      voice: createdVoice,
      uploadUrls: urls,
      instructions: {
        step1: "Upload your reference audio (WAV format, 10-60 seconds of clear speech) to referenceUpload URL",
        step2: "Optionally upload a shorter preview clip to previewUpload URL",
        step3: "Call POST /api/voices/custom/{id}/finalize to complete the upload",
        requirements: [
          "WAV format (16-bit, 44.1kHz preferred)",
          "Clear speech without background noise",
          "10-60 seconds recommended",
          "Single speaker only",
        ],
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
