import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { jobs, users } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  driveExportSchema,
  refreshDriveAccessToken,
  uploadVideoToDrive,
  shareDriveFile,
} from "@/lib/drive";
import { AppError, toErrorResponse } from "@/lib/errors";
import { presignedGet } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";

const exportRequestSchema = z.object({
  jobId: z.string().uuid(),
  fileName: z.string().min(1).max(255).optional(),
  folderId: z.string().optional(),
  description: z.string().max(500).optional(),
  makePublic: z.boolean().default(false),
});

/**
 * POST /api/export/drive
 * Export a completed video to Google Drive
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = exportRequestSchema.parse(await request.json());

    // Check if user has Drive connected
    if (!user.driveRefreshToken) {
      throw new AppError(
        "drive_not_connected",
        "User has no Drive refresh token",
        "Connect your Google Drive account in settings first.",
        400,
      );
    }

    if (!user.s3Bucket) {
      throw new AppError(
        "bucket_missing",
        "User has no S3 bucket",
        "Your storage bucket is not provisioned.",
        400,
      );
    }

    // Get the job
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, body.jobId), eq(jobs.userId, user.id)))
      .limit(1);

    if (!job) {
      throw new AppError(
        "job_not_found",
        `Job ${body.jobId} not found`,
        "This video does not exist or you don't have access to it.",
        404,
      );
    }

    if (job.status !== "done") {
      throw new AppError(
        "job_not_complete",
        `Job status is ${job.status}`,
        "This video is not ready for export yet.",
        400,
      );
    }

    if (!job.s3VideoKey) {
      throw new AppError(
        "no_video_key",
        "Job has no video key",
        "This video file could not be found.",
        404,
      );
    }

    // Get fresh access token
    const refreshToken = decryptSecret(user.driveRefreshToken);
    if (!refreshToken) {
      throw new AppError(
        "drive_token_invalid",
        "Could not decrypt refresh token",
        "Your Google Drive connection needs to be re-established.",
        401,
      );
    }

    const tokens = await refreshDriveAccessToken(refreshToken);

    // Get presigned URL for video
    const videoUrl = await presignedGet({
      bucket: user.s3Bucket,
      key: job.s3VideoKey,
      expiresIn: 3600, // 1 hour
      region: user.s3Region,
    });

    // Generate filename
    const editConfig = job.editConfig as { topic?: string } | null;
    const defaultFileName = editConfig?.topic
      ? `${editConfig.topic.slice(0, 50)}-${job.id.slice(0, 8)}`
      : `svgen-video-${job.id.slice(0, 8)}`;

    const fileName = body.fileName || defaultFileName;

    // Upload to Drive
    const uploadedFile = await uploadVideoToDrive({
      accessToken: tokens.accessToken,
      videoUrl,
      fileName,
      folderId: body.folderId,
      description: body.description,
    });

    // Optionally make public
    let shareLink = uploadedFile.webViewLink;
    if (body.makePublic) {
      const shared = await shareDriveFile(tokens.accessToken, uploadedFile.id);
      shareLink = shared.webViewLink;
    }

    // Update refresh token if it was rotated
    if (tokens.refreshToken !== refreshToken) {
      await db
        .update(users)
        .set({
          driveRefreshToken: encryptSecret(tokens.refreshToken),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    return NextResponse.json({
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        webViewLink: shareLink,
        webContentLink: uploadedFile.webContentLink,
      },
      message: "Video exported to Google Drive successfully!",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
