import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { customVoices } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { requireUserFromRequest } from "@/lib/session";
import {
  voiceUpdateSchema,
  generateVoiceDownloadUrls,
  deleteVoiceAssets,
} from "@/lib/voiceUpload";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/voices/custom/[id]
 * Get a specific custom voice with download URLs
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Generate download URLs if bucket exists
    let urls = {};
    if (user.s3Bucket) {
      urls = await generateVoiceDownloadUrls({
        bucket: user.s3Bucket,
        referenceKey: voice.referenceAudioKey,
        previewKey: voice.previewAudioKey,
        region: user.s3Region,
      });
    }

    return NextResponse.json({
      voice: { ...voice, urls },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/voices/custom/[id]
 * Update a custom voice's metadata
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = voiceUpdateSchema.parse(await request.json());

    // Check voice exists and belongs to user
    const [existing] = await db
      .select()
      .from(customVoices)
      .where(and(eq(customVoices.id, id), eq(customVoices.userId, user.id)))
      .limit(1);

    if (!existing) {
      throw new AppError(
        "voice_not_found",
        `Voice ${id} not found`,
        "This voice does not exist or you don't have access to it.",
        404,
      );
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.tone !== undefined) updateData.tone = body.tone;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.recommendedEmotion !== undefined) updateData.recommendedEmotion = body.recommendedEmotion;
    if (body.recommendedRate !== undefined) updateData.recommendedRate = body.recommendedRate;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;

    const [updatedVoice] = await db
      .update(customVoices)
      .set(updateData)
      .where(eq(customVoices.id, id))
      .returning();

    return NextResponse.json({ voice: updatedVoice });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/voices/custom/[id]
 * Delete a custom voice and its associated assets
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;

    // Check voice exists and belongs to user
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

    // Delete S3 assets (best effort - don't fail if assets are missing)
    if (user.s3Bucket) {
      await deleteVoiceAssets({
        bucket: user.s3Bucket,
        referenceKey: voice.referenceAudioKey,
        previewKey: voice.previewAudioKey,
        region: user.s3Region,
      });
    }

    // Delete database record
    await db.delete(customVoices).where(eq(customVoices.id, id));

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
