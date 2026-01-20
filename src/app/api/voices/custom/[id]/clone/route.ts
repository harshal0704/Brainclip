import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { customVoices } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { presignedGet } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";
import { cloneVoiceWithFishAudio } from "@/lib/voiceUpload";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/voices/custom/[id]/clone
 * Trigger voice cloning with Fish.audio for a finalized voice
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;

    if (!user.s3Bucket) {
      throw new AppError(
        "bucket_missing",
        "User has no S3 bucket",
        "Your storage bucket is not provisioned.",
        400,
      );
    }

    const fishApiKey = decryptSecret(user.fishApiKey);
    if (!fishApiKey) {
      throw new AppError(
        "fish_key_missing",
        "No Fish.audio API key",
        "Add your Fish.audio API key in settings to use voice cloning.",
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
        "no_reference_audio",
        "Voice has no reference audio",
        "Please upload reference audio before cloning.",
        400,
      );
    }

    if (voice.fishCloneStatus === "processing") {
      throw new AppError(
        "clone_in_progress",
        "Voice cloning already in progress",
        "Please wait for the current cloning process to complete.",
        409,
      );
    }

    if (voice.fishCloneStatus === "ready" && voice.fishModelId) {
      throw new AppError(
        "already_cloned",
        "Voice has already been cloned",
        "This voice already has a Fish.audio model. Delete it first to re-clone.",
        409,
      );
    }

    // Get presigned URL for reference audio
    const audioUrl = await presignedGet({
      bucket: user.s3Bucket,
      key: voice.referenceAudioKey,
      expiresIn: 300,
      region: user.s3Region,
    });

    // Update status to processing
    await db
      .update(customVoices)
      .set({
        fishCloneStatus: "processing",
        updatedAt: new Date(),
      })
      .where(eq(customVoices.id, id));

    try {
      // Trigger voice cloning
      const cloneResult = await cloneVoiceWithFishAudio({
        referenceAudioUrl: audioUrl,
        name: voice.name,
        description: voice.description ?? undefined,
        apiKey: fishApiKey,
      });

      // Update with clone result
      const [updatedVoice] = await db
        .update(customVoices)
        .set({
          fishModelId: cloneResult.modelId,
          fishCloneStatus: "ready",
          updatedAt: new Date(),
        })
        .where(eq(customVoices.id, id))
        .returning();

      return NextResponse.json({
        voice: updatedVoice,
        cloning: {
          status: "ready",
          modelId: cloneResult.modelId,
          message: "Voice cloned successfully! You can now use this voice for TTS.",
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
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/voices/custom/[id]/clone
 * Remove the Fish.audio model association (does not delete from Fish.audio)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;

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

    const [updatedVoice] = await db
      .update(customVoices)
      .set({
        fishModelId: null,
        fishCloneStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(customVoices.id, id))
      .returning();

    return NextResponse.json({
      voice: updatedVoice,
      message: "Clone association removed. You can re-clone this voice.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
