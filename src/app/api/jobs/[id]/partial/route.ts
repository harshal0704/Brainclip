import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { jobs } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { presignedGet, headObject } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PartialAsset = {
  type: "audio" | "transcript" | "video";
  key: string;
  exists: boolean;
  url?: string;
  size?: number;
  lastModified?: string;
};

/**
 * GET /api/jobs/[id]/partial
 * Get partial results for a job - useful for recovering assets from failed jobs
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    const assets: PartialAsset[] = [];
    const s3AudioKeys = job.s3AudioKeys as Record<string, string> | null;

    // Check audio files
    if (s3AudioKeys) {
      for (const [lineId, key] of Object.entries(s3AudioKeys)) {
        if (!key) continue;

        try {
          const head = await headObject({
            bucket: user.s3Bucket,
            key,
            region: user.s3Region,
          });

          const url = await presignedGet({
            bucket: user.s3Bucket,
            key,
            expiresIn: 3600,
            region: user.s3Region,
          });

          assets.push({
            type: "audio",
            key,
            exists: true,
            url,
            size: head.ContentLength,
            lastModified: head.LastModified?.toISOString(),
          });
        } catch {
          assets.push({
            type: "audio",
            key,
            exists: false,
          });
        }
      }
    }

    // Check transcript
    if (job.s3TranscriptKey) {
      try {
        const head = await headObject({
          bucket: user.s3Bucket,
          key: job.s3TranscriptKey,
          region: user.s3Region,
        });

        const url = await presignedGet({
          bucket: user.s3Bucket,
          key: job.s3TranscriptKey,
          expiresIn: 3600,
          region: user.s3Region,
        });

        assets.push({
          type: "transcript",
          key: job.s3TranscriptKey,
          exists: true,
          url,
          size: head.ContentLength,
          lastModified: head.LastModified?.toISOString(),
        });
      } catch {
        assets.push({
          type: "transcript",
          key: job.s3TranscriptKey,
          exists: false,
        });
      }
    }

    // Check video
    if (job.s3VideoKey) {
      try {
        const head = await headObject({
          bucket: user.s3Bucket,
          key: job.s3VideoKey,
          region: user.s3Region,
        });

        const url = await presignedGet({
          bucket: user.s3Bucket,
          key: job.s3VideoKey,
          expiresIn: 3600,
          region: user.s3Region,
        });

        assets.push({
          type: "video",
          key: job.s3VideoKey,
          exists: true,
          url,
          size: head.ContentLength,
          lastModified: head.LastModified?.toISOString(),
        });
      } catch {
        assets.push({
          type: "video",
          key: job.s3VideoKey,
          exists: false,
        });
      }
    }

    // Summary
    const existingAssets = assets.filter((a) => a.exists);
    const missingAssets = assets.filter((a) => !a.exists);

    const summary = {
      totalAssets: assets.length,
      existingCount: existingAssets.length,
      missingCount: missingAssets.length,
      hasAudio: existingAssets.some((a) => a.type === "audio"),
      hasMasterAudio: existingAssets.some((a) => a.type === "audio" && a.key.includes("master")),
      hasTranscript: existingAssets.some((a) => a.type === "transcript"),
      hasVideo: existingAssets.some((a) => a.type === "video"),
      recoveryOptions: [] as string[],
    };

    // Determine recovery options
    if (summary.hasVideo) {
      summary.recoveryOptions.push("download_video");
    }
    if (summary.hasMasterAudio) {
      summary.recoveryOptions.push("download_audio");
      summary.recoveryOptions.push("retry_render");
    }
    if (summary.hasAudio && !summary.hasMasterAudio) {
      summary.recoveryOptions.push("retry_voice_concat");
    }
    if (!summary.hasAudio) {
      summary.recoveryOptions.push("retry_full");
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        stage: job.stage,
        progressPct: job.progressPct,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      assets: existingAssets.map((a) => ({
        type: a.type,
        key: a.key,
        url: a.url,
        size: a.size,
        lastModified: a.lastModified,
      })),
      missing: missingAssets.map((a) => ({
        type: a.type,
        key: a.key,
      })),
      summary,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
