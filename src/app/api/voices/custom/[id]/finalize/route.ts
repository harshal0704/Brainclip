import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { customVoices } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { getObjectJson, headObject, presignedGet } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";
import {
  checkVoiceAudioExists,
  parseWavMetadata,
  validateAudioForCloning,
  cloneVoiceWithFishAudio,
} from "@/lib/voiceUpload";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const finalizeSchema = z.object({
  triggerCloning: z.boolean().default(false),
  skipValidation: z.boolean().default(false),
});

/**
 * POST /api/voices/custom/[id]/finalize
 * Finalize a voice upload - validates audio and optionally triggers voice cloning
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = finalizeSchema.parse(await request.json());

    if (!user.s3Bucket) {
      throw new AppError(
        "bucket_missing",
        "User has no S3 bucket",
        "Your storage bucket is not provisioned.",
        400,
      );
    }

    // Get the voice record
    const [voice] = await db
      .select()
      .from(customVoices)
      .where(and(eq(customVoices.id, id), eq(customVoices.userId, user.id)))
      .limit(1);

    if (!voice) {
      throw new AppError(
        "voice_not_found",
        `Voice ${id} not found`,
        "This voice does not exist or you don't have access to it.",
        404,
      );
    }

    if (!voice.referenceAudioKey) {
      throw new AppError(
        "no_reference_key",
        "Voice has no reference audio key",
        "This voice entry is corrupted. Please create a new one.",
        400,
      );
    }

    // Check if reference audio was uploaded
    const audioExists = await checkVoiceAudioExists({
      bucket: user.s3Bucket,
      key: voice.referenceAudioKey,
      region: user.s3Region,
    });

    if (!audioExists) {
      throw new AppError(
        "audio_not_uploaded",
        "Reference audio not found in S3",
        "Please upload your reference audio file before finalizing.",
        400,
      );
    }

    // Get file metadata from S3
    const headResult = await headObject({
      bucket: user.s3Bucket,
      key: voice.referenceAudioKey,
      region: user.s3Region,
    });

    const fileSizeBytes = headResult.ContentLength ?? 0;
    
    // Get presigned URL to fetch and validate audio
    const audioUrl = await presignedGet({
      bucket: user.s3Bucket,
      key: voice.referenceAudioKey,
      expiresIn: 300,
      region: user.s3Region,
    });

    // Fetch audio to parse metadata (only first 100KB for metadata)
    const audioResponse = await fetch(audioUrl, {
      headers: { Range: "bytes=0-102400" },
    });
    
    if (!audioResponse.ok) {
      throw new AppError(
        "audio_fetch_failed",
        "Failed to fetch audio for validation",
        "Could not retrieve your uploaded audio for validation.",
        500,
      );
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    
    let metadata;
    let validationResult = { valid: true, issues: [] as string[], warnings: [] as string[] };

    try {
      metadata = parseWavMetadata(audioBuffer);
      
      if (!body.skipValidation) {
        validationResult = validateAudioForCloning(metadata);
      }
    } catch (parseError) {
      if (!body.skipValidation) {
        throw new AppError(
          "invalid_audio",
          parseError instanceof Error ? parseError.message : "Audio parsing failed",
          "The uploaded file could not be parsed as valid audio.",
          400,
        );
      }
      // If skipping validation, use default metadata
      metadata = {
        durationSec: 0,
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
        format: "wav",
      };
    }

    // Update voice record with audio metadata
    const updateData: Record<string, unknown> = {
      durationSec: metadata.durationSec,
      sampleRate: metadata.sampleRate,
      format: metadata.format,
      fileSizeBytes,
      updatedAt: new Date(),
    };

    // If validation passed and cloning is requested
    if (body.triggerCloning && validationResult.valid) {
      const fishApiKey = decryptSecret(user.fishApiKey);

      if (!fishApiKey) {
        throw new AppError(
          "fish_key_missing",
          "No Fish.audio API key",
          "Add your Fish.audio API key in settings to use voice cloning.",
          400,
        );
      }

      updateData.fishCloneStatus = "processing";

      // Update status before starting clone
      await db
        .update(customVoices)
        .set(updateData)
        .where(eq(customVoices.id, id));

      try {
        // Trigger voice cloning with Fish.audio
        const cloneResult = await cloneVoiceWithFishAudio({
          referenceAudioUrl: audioUrl,
          name: voice.name,
          description: voice.description ?? undefined,
          apiKey: fishApiKey,
        });

        // Update with clone result
        const [finalVoice] = await db
          .update(customVoices)
          .set({
            fishModelId: cloneResult.modelId,
            fishCloneStatus: "ready",
            updatedAt: new Date(),
          })
          .where(eq(customVoices.id, id))
          .returning();

        return NextResponse.json({
          voice: finalVoice,
          validation: validationResult,
          cloning: {
            status: "ready",
            modelId: cloneResult.modelId,
          },
        });
      } catch (cloneError) {
        // Update status to failed
        await db
          .update(customVoices)
          .set({
            fishCloneStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(customVoices.id, id));

        throw cloneError;
      }
    }

    // Just finalize without cloning
    updateData.fishCloneStatus = validationResult.valid ? "pending" : "invalid";

    const [updatedVoice] = await db
      .update(customVoices)
      .set(updateData)
      .where(eq(customVoices.id, id))
      .returning();

    return NextResponse.json({
      voice: updatedVoice,
      validation: validationResult,
      cloning: body.triggerCloning
        ? { status: "not_started", reason: "Validation issues must be resolved first" }
        : { status: "not_requested" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
