import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { jobs } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { deleteObject } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/jobs/[id]/cancel
 * Cancel a running job and optionally clean up assets
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { cleanupAssets?: boolean };

    // Get the job
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
      .limit(1);

    if (!job) {
      throw new AppError(
        "job_not_found",
        `Job ${id} not found`,
        "This job does not exist or you don't have access to it.",
        404,
      );
    }

    // Only allow cancellation for in-progress jobs
    const cancellableStatuses = ["pending", "voice_processing", "rendering"];
    if (!cancellableStatuses.includes(job.status)) {
      if (job.status === "done") {
        throw new AppError(
          "job_completed",
          "Job has already completed",
          "This job has already finished. Use delete to remove it.",
          400,
        );
      }
      if (job.status === "failed") {
        throw new AppError(
          "job_already_failed",
          "Job has already failed",
          "This job has already failed. Use retry or delete.",
          400,
        );
      }
    }

    // Update job status to failed with cancellation reason
    await db
      .update(jobs)
      .set({
        status: "failed",
        stage: "Cancelled by user",
        progressPct: 0,
        errorMessage: "Job was cancelled by the user.",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));

    // Optionally clean up S3 assets
    let cleanedUp = false;
    if (body.cleanupAssets && user.s3Bucket) {
      const s3AudioKeys = job.s3AudioKeys as Record<string, string> | null;
      const deletionPromises: Promise<void>[] = [];

      // Delete audio files
      if (s3AudioKeys) {
        for (const key of Object.values(s3AudioKeys)) {
          if (key) {
            deletionPromises.push(
              deleteObject({
                bucket: user.s3Bucket,
                key,
                region: user.s3Region,
              }).catch(() => {}),
            );
          }
        }
      }

      // Delete transcript
      if (job.s3TranscriptKey) {
        deletionPromises.push(
          deleteObject({
            bucket: user.s3Bucket,
            key: job.s3TranscriptKey,
            region: user.s3Region,
          }).catch(() => {}),
        );
      }

      // Delete video (if any)
      if (job.s3VideoKey) {
        deletionPromises.push(
          deleteObject({
            bucket: user.s3Bucket,
            key: job.s3VideoKey,
            region: user.s3Region,
          }).catch(() => {}),
        );
      }

      await Promise.allSettled(deletionPromises);
      cleanedUp = true;
    }

    // Fetch updated job
    const [cancelledJob] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

    return NextResponse.json({
      job: cancelledJob,
      cancelled: true,
      assetsCleanedUp: cleanedUp,
      message: cleanedUp
        ? "Job cancelled and assets cleaned up."
        : "Job cancelled. Assets were preserved.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/jobs/[id]/cancel
 * Actually delete a job and all its assets
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;

    // Get the job
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
      .limit(1);

    if (!job) {
      throw new AppError(
        "job_not_found",
        `Job ${id} not found`,
        "This job does not exist or you don't have access to it.",
        404,
      );
    }

    // Clean up S3 assets
    if (user.s3Bucket) {
      const s3AudioKeys = job.s3AudioKeys as Record<string, string> | null;
      const deletionPromises: Promise<void>[] = [];

      if (s3AudioKeys) {
        for (const key of Object.values(s3AudioKeys)) {
          if (key) {
            deletionPromises.push(
              deleteObject({
                bucket: user.s3Bucket,
                key,
                region: user.s3Region,
              }).catch(() => {}),
            );
          }
        }
      }

      if (job.s3TranscriptKey) {
        deletionPromises.push(
          deleteObject({
            bucket: user.s3Bucket,
            key: job.s3TranscriptKey,
            region: user.s3Region,
          }).catch(() => {}),
        );
      }

      if (job.s3VideoKey) {
        deletionPromises.push(
          deleteObject({
            bucket: user.s3Bucket,
            key: job.s3VideoKey,
            region: user.s3Region,
          }).catch(() => {}),
        );
      }

      await Promise.allSettled(deletionPromises);
    }

    // Delete the job record
    await db.delete(jobs).where(eq(jobs.id, id));

    return NextResponse.json({
      deleted: true,
      jobId: id,
      message: "Job and all associated assets have been deleted.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
