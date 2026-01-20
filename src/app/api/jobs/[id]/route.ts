import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { jobs } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { buildRenderInputProps, getSpeakerConfigsFromVoiceMap } from "@/lib/jobs";
import { getLambdaRenderProgress, getRenderFailureMessage, triggerLambdaRender } from "@/lib/render";
import { copyObject, headObject } from "@/lib/s3";
import { requireOwnedJob } from "@/lib/session";

const pollColabStatus = async (colabUrl: string, jobId: string) => {
  const response = await fetch(new URL(`/voice/job/${jobId}`, colabUrl));

  if (!response.ok) {
    throw new AppError("colab_offline", `Colab status polling failed: ${response.status}`, "Your Colab session seems offline. Restart it or switch to Fish.audio mode.", 502);
  }

  return response.json() as Promise<{ stage?: string; progressPct?: number; error?: string }>;
};

const hasObject = async (bucket: string, key: string, region?: string) => {
  try {
    await headObject({ bucket, key, region });
    return true;
  } catch {
    return false;
  }
};

const failJob = async ({
  jobId,
  progressPct,
  error,
  fallbackStage,
}: {
  jobId: string;
  progressPct: number;
  error: unknown;
  fallbackStage: string;
}) => {
  const errorMessage = getRenderFailureMessage(error);
  const [failedJob] = await db
    .update(jobs)
    .set({
      status: "failed",
      stage: fallbackStage,
      progressPct,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return NextResponse.json({
    job: failedJob,
    jobId: failedJob.id,
    status: failedJob.status,
    progress: failedJob.progressPct,
    stage: failedJob.stage,
    error: failedJob.errorMessage,
  });
};

const assessVoiceStage = async ({
  bucket,
  region,
  s3AudioKeys,
  transcriptKey,
}: {
  bucket: string;
  region?: string;
  s3AudioKeys: Record<string, string>;
  transcriptKey: string | null;
}) => {
  const masterKey = s3AudioKeys.master;
  const lineEntries = Object.entries(s3AudioKeys).filter(([lineId]) => lineId !== "master");
  const checks = await Promise.all([
    ...lineEntries.map(([, key]) => hasObject(bucket, key, region)),
    masterKey ? hasObject(bucket, masterKey, region) : Promise.resolve(false),
    transcriptKey ? hasObject(bucket, transcriptKey, region) : Promise.resolve(false),
  ]);

  const lineResults = checks.slice(0, lineEntries.length);
  const masterReady = checks[lineEntries.length] ?? false;
  const transcriptReady = checks[lineEntries.length + 1] ?? false;
  const completedCount = lineResults.filter(Boolean).length + Number(masterReady) + Number(transcriptReady);
  const expectedCount = lineEntries.length + 2;
  const allVoiceAssetsReady = lineEntries.length > 0 && lineResults.every(Boolean) && masterReady && transcriptReady;

  if (allVoiceAssetsReady) {
    return {
      status: "voice_done" as const,
      stage: "Voice assets ready",
      progressPct: 60,
    };
  }

  if (completedCount > 0) {
    return {
      status: "voice_processing" as const,
      stage: `Voice assets uploading (${completedCount}/${expectedCount})`,
      progressPct: Math.max(5, Math.min(59, Math.round((completedCount / expectedCount) * 60))),
    };
  }

  return {
    status: "pending" as const,
    stage: "Waiting for voice assets",
    progressPct: 0,
  };
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, job } = await requireOwnedJob(request, params.id);
    let nextJob = job;
    const voiceMap = (job.voiceMap ?? {}) as Record<string, unknown>;

    if (["pending", "voice_processing", "voice_done"].includes(job.status) && user.s3Bucket) {
      const localVoiceStage = await assessVoiceStage({
        bucket: user.s3Bucket,
        region: user.s3Region,
        s3AudioKeys: (job.s3AudioKeys ?? {}) as Record<string, string>,
        transcriptKey: job.s3TranscriptKey,
      });

      let resolvedVoiceStage = localVoiceStage;

      if (localVoiceStage.status !== "voice_done" && voiceMap.mode === "colab" && user.colabUrl) {
        const remote = await pollColabStatus(user.colabUrl, job.id);
        const remoteStage = remote.stage ?? localVoiceStage.stage;
        const remoteProgress = remote.progressPct ?? localVoiceStage.progressPct;
        const isVoiceDone = remoteStage === "voice_done" || remoteProgress >= 100;

        resolvedVoiceStage = {
          status: isVoiceDone ? "voice_done" : (localVoiceStage.status === "pending" ? "voice_processing" : localVoiceStage.status),
          stage: isVoiceDone ? "Voice assets ready" : remoteStage,
          progressPct: isVoiceDone ? 60 : Math.max(localVoiceStage.progressPct, Math.min(59, remoteProgress)),
        };

        if (remote.error) {
          const [failedJob] = await db
            .update(jobs)
            .set({
              status: "failed",
              stage: remoteStage,
              errorMessage: remote.error,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, job.id))
            .returning();

          nextJob = failedJob;
          return NextResponse.json({
            job: nextJob,
            jobId: nextJob.id,
            status: nextJob.status,
            progress: nextJob.progressPct,
            stage: nextJob.stage,
            error: nextJob.errorMessage,
          });
        }
      }

      if (
        resolvedVoiceStage.status !== job.status ||
        resolvedVoiceStage.stage !== job.stage ||
        resolvedVoiceStage.progressPct !== job.progressPct
      ) {
        const [updatedJob] = await db
          .update(jobs)
          .set({
            status: resolvedVoiceStage.status,
            stage: resolvedVoiceStage.stage,
            progressPct: resolvedVoiceStage.progressPct,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id))
          .returning();

        nextJob = updatedJob;
      }
    }

    if (nextJob.status === "voice_done" && !nextJob.lambdaRenderId) {
      if (!user.s3Bucket) {
        throw new AppError("bucket_missing", "User bucket missing during render setup", "Your storage bucket is missing. Please sign in again.", 400);
      }

      const { speakerA, speakerB } = getSpeakerConfigsFromVoiceMap((nextJob.voiceMap ?? {}) as Record<string, unknown>);
      const inputProps = await buildRenderInputProps({
        bucket: user.s3Bucket,
        region: user.s3Region,
        backgroundUrl: nextJob.backgroundUrl,
        subtitleStyle: nextJob.subtitleStyleId,
        editConfig: (nextJob.editConfig ?? {}) as Record<string, unknown>,
        speakerA,
        speakerB,
        scriptLines: ((nextJob.scriptLines ?? []) as Array<{ id?: string; speaker: "A" | "B"; text: string }>),
        s3AudioKeys: (nextJob.s3AudioKeys ?? {}) as Record<string, string>,
        transcriptKey: nextJob.s3TranscriptKey,
        resolution: nextJob.resolution,
      });

      try {
        const render = await triggerLambdaRender(nextJob, inputProps);

        const [updatedJob] = await db
          .update(jobs)
          .set({
            status: "rendering",
            stage: "Rendering video with Remotion Lambda",
            progressPct: 70,
            lambdaRenderId: render.renderId,
            lambdaBucket: render.bucketName,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, nextJob.id))
          .returning();

        nextJob = updatedJob;
      } catch (error) {
        return failJob({
          jobId: nextJob.id,
          progressPct: nextJob.progressPct,
          error,
          fallbackStage: "Render start failed",
        });
      }
    }

    if (nextJob.status === "rendering" && nextJob.lambdaRenderId && nextJob.lambdaBucket) {
      try {
        const progress = await getLambdaRenderProgress({
          renderId: nextJob.lambdaRenderId,
          bucketName: nextJob.lambdaBucket,
        });

        if (progress.fatalErrorEncountered) {
          return failJob({
            jobId: nextJob.id,
            progressPct: nextJob.progressPct,
            error: progress.errors[0]?.message ?? new Error("Remotion reported a fatal render error."),
            fallbackStage: "Render failed",
          });
        }

        if (progress.done && progress.outKey && progress.outBucket && user.s3Bucket && nextJob.s3VideoKey) {
          await copyObject({
            sourceBucket: progress.outBucket,
            sourceKey: progress.outKey,
            destinationBucket: user.s3Bucket,
            destinationKey: nextJob.s3VideoKey,
            region: user.s3Region,
            contentType: "video/mp4",
          });
        }

        const renderProgressPct = Math.max(70, Math.round(progress.overallProgress * 100));
        const stage = progress.done
          ? "Render complete"
          : `Rendering video with Remotion Lambda (${renderProgressPct}%)`;

        const [updatedJob] = await db
          .update(jobs)
          .set({
            status: progress.done ? "done" : "rendering",
            stage,
            progressPct: progress.done ? 100 : renderProgressPct,
            s3VideoKey: nextJob.s3VideoKey ?? progress.outKey,
            lambdaBucket: progress.outBucket ?? nextJob.lambdaBucket,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, nextJob.id))
          .returning();

        nextJob = updatedJob;
      } catch (error) {
        return failJob({
          jobId: nextJob.id,
          progressPct: nextJob.progressPct,
          error,
          fallbackStage: "Render failed",
        });
      }
    }

    return NextResponse.json({
      job: nextJob,
      jobId: nextJob.id,
      status: nextJob.status,
      progress: nextJob.progressPct,
      stage: nextJob.stage,
      error: nextJob.errorMessage,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
