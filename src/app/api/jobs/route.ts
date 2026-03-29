import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { jobs } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { buildJobPresignedOutputs, normalizeCreateJobInput } from "@/lib/jobs";
import { requireUserFromRequest } from "@/lib/session";
import { dispatchColabVoiceJob, dispatchElevenLabsVoiceJob, dispatchFishApiVoiceJob, dispatchHuggingFaceVoiceJob, dispatchPollyVoiceJob, resolvePresetRefUrl } from "@/lib/voice";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = normalizeCreateJobInput(await request.json());

    if (!user.s3Bucket) {
      throw new AppError("bucket_missing", "User does not have a provisioned S3 bucket", "Your storage bucket is not ready yet. Sign out and back in to provision it.", 400);
    }

    const jobId = crypto.randomUUID();
    const presigned = await buildJobPresignedOutputs({
      bucket: user.s3Bucket,
      jobId,
      lineIds: body.scriptLines.map((line) => line.id),
      region: user.s3Region,
    });

    const [createdJob] = await db
      .insert(jobs)
      .values({
        id: jobId,
        userId: user.id,
        status: "pending",
        stage: "Waiting for voice assets",
        progressPct: 0,
        scriptLines: body.scriptLines,
        voiceMap: body.voiceMap,
        editConfig: {
          ...body.editConfig,
          topic: body.topic,
          duoId: body.duoId,
        },
        subtitleStyleId: body.subtitleStyleId,
        backgroundUrl: body.backgroundUrl,
        resolution: body.resolution,
        s3AudioKeys: {
          ...presigned.keys.audioFiles,
          master: presigned.keys.masterAudio,
        },
        s3TranscriptKey: presigned.keys.transcriptJson,
        s3VideoKey: presigned.keys.finalVideo,
      })
      .returning();

    let nextJob = createdJob;
    const voiceMode = String(body.voiceMap.mode ?? "fish-api");

    try {
      if (voiceMode === "colab") {
        const speakerAMap = body.voiceMap.speakerA as { modelId?: string } | undefined;
        const speakerBMap = body.voiceMap.speakerB as { modelId?: string } | undefined;
        const speakerAModelId = speakerAMap?.modelId;
        const speakerBModelId = speakerBMap?.modelId;

        const [refAudioUrlA, refAudioUrlB] = await Promise.all([
          speakerAModelId ? resolvePresetRefUrl(speakerAModelId, user.id) : null,
          speakerBModelId ? resolvePresetRefUrl(speakerBModelId, user.id) : null,
        ]);

        const speakerAConfig = {
          ...speakerAMap,
          refAudioUrl: refAudioUrlA ?? undefined,
        };
        const speakerBConfig = {
          ...speakerBMap,
          refAudioUrl: refAudioUrlB ?? undefined,
        };

        await dispatchColabVoiceJob(
          {
            jobId,
            userId: user.id,
            bucket: user.s3Bucket,
            region: user.s3Region,
            colabUrl: user.colabUrl ?? undefined,
            lines: body.scriptLines,
            speakerA: speakerAConfig as Parameters<typeof dispatchColabVoiceJob>[0]["speakerA"],
            speakerB: speakerBConfig as Parameters<typeof dispatchColabVoiceJob>[0]["speakerB"],
            presignedUrls: {
              lines: presigned.urls.audioFiles,
              master: presigned.urls.masterAudio,
              transcript: presigned.urls.transcriptJson,
            },
          },
          {
            lines: presigned.urls.audioFiles,
            master: presigned.urls.masterAudio,
            transcript: presigned.urls.transcriptJson,
          },
        );

        const [updatedJob] = await db
          .update(jobs)
          .set({
            status: "voice_processing",
            stage: "Colab accepted the voice job",
            progressPct: 8,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId))
          .returning();

        nextJob = updatedJob;
      } else {
        if (user.ttsProvider === "huggingface") {
          const hfToken = decryptSecret(user.hfToken);

          if (!hfToken) {
            throw new AppError("hf_key_missing", "User has no Hugging Face Token", "Add your Hugging Face Token in settings before starting the HF voice pipeline.", 400);
          }

          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Generating voice assets with Hugging Face",
              progressPct: 12,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId));

          await dispatchHuggingFaceVoiceJob(
            {
              jobId,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              lines: body.scriptLines,
              speakerA: body.voiceMap.speakerA as Parameters<typeof dispatchHuggingFaceVoiceJob>[0]["speakerA"],
              speakerB: body.voiceMap.speakerB as Parameters<typeof dispatchHuggingFaceVoiceJob>[0]["speakerB"],
              presignedUrls: {
                lines: presigned.urls.audioFiles,
                master: presigned.urls.masterAudio,
                transcript: presigned.urls.transcriptJson,
              },
            },
            hfToken,
          );

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: "voice_done",
              stage: "Voice assets ready",
              progressPct: 60,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId))
            .returning();

          nextJob = updatedJob;
        } else if (user.ttsProvider === "elevenlabs") {
          const elevenLabsApiKey = decryptSecret(user.elevenLabsApiKey);

          if (!elevenLabsApiKey) {
            throw new AppError("elevenlabs_key_missing", "User has no Eleven Labs API Key", "Add your Eleven Labs API Key in settings before starting the Eleven Labs voice pipeline.", 400);
          }

          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Generating voice assets with Eleven Labs",
              progressPct: 12,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId));

          await dispatchElevenLabsVoiceJob(
            {
              jobId,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              lines: body.scriptLines,
              speakerA: body.voiceMap.speakerA as Parameters<typeof dispatchElevenLabsVoiceJob>[0]["speakerA"],
              speakerB: body.voiceMap.speakerB as Parameters<typeof dispatchElevenLabsVoiceJob>[0]["speakerB"],
              presignedUrls: {
                lines: presigned.urls.audioFiles,
                master: presigned.urls.masterAudio,
                transcript: presigned.urls.transcriptJson,
              },
            },
            elevenLabsApiKey,
          );

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: "voice_done",
              stage: "Voice assets ready",
              progressPct: 60,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId))
            .returning();

          nextJob = updatedJob;
        } else if (user.ttsProvider === "polly") {
          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Generating voice assets with Amazon Polly",
              progressPct: 12,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId));

          await dispatchPollyVoiceJob(
            {
              jobId,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              lines: body.scriptLines,
              speakerA: body.voiceMap.speakerA as Parameters<typeof dispatchPollyVoiceJob>[0]["speakerA"],
              speakerB: body.voiceMap.speakerB as Parameters<typeof dispatchPollyVoiceJob>[0]["speakerB"],
              presignedUrls: {
                lines: presigned.urls.audioFiles,
                master: presigned.urls.masterAudio,
                transcript: presigned.urls.transcriptJson,
              },
            },
            {
              voiceIdA: user.pollyVoiceA ?? undefined,
              voiceIdB: user.pollyVoiceB ?? undefined,
              region: user.s3Region,
            },
          );

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: "voice_done",
              stage: "Voice assets ready",
              progressPct: 60,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId))
            .returning();

          nextJob = updatedJob;
        } else {
          const fishApiKey = decryptSecret(user.fishApiKey);

          if (!fishApiKey) {
            throw new AppError("fish_key_missing", "User has no Fish.audio key", "Add your Fish.audio API key in settings before starting the Fish voice pipeline.", 400);
          }

          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Generating voice assets with Fish.audio",
              progressPct: 12,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId));

          await dispatchFishApiVoiceJob(
            {
              jobId,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              lines: body.scriptLines,
              speakerA: body.voiceMap.speakerA as Parameters<typeof dispatchFishApiVoiceJob>[0]["speakerA"],
              speakerB: body.voiceMap.speakerB as Parameters<typeof dispatchFishApiVoiceJob>[0]["speakerB"],
              presignedUrls: {
                lines: presigned.urls.audioFiles,
                master: presigned.urls.masterAudio,
                transcript: presigned.urls.transcriptJson,
              },
            },
            fishApiKey,
          );

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: "voice_done",
              stage: "Voice assets ready",
              progressPct: 60,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId))
            .returning();

          nextJob = updatedJob;
        }
      }
    } catch (error) {
      // Auto-fallback: if primary provider failed and AWS creds exist, try Polly
      const hasAwsCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      const notPollyAlready = voiceMode !== "polly" && user.ttsProvider !== "polly";

      if (hasAwsCreds && notPollyAlready) {
        try {
          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Fallback: Generating voice assets with Amazon Polly",
              progressPct: 12,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId));

          await dispatchPollyVoiceJob(
            {
              jobId,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              lines: body.scriptLines,
              speakerA: body.voiceMap.speakerA as Parameters<typeof dispatchPollyVoiceJob>[0]["speakerA"],
              speakerB: body.voiceMap.speakerB as Parameters<typeof dispatchPollyVoiceJob>[0]["speakerB"],
              presignedUrls: {
                lines: presigned.urls.audioFiles,
                master: presigned.urls.masterAudio,
                transcript: presigned.urls.transcriptJson,
              },
            },
            {
              voiceIdA: user.pollyVoiceA ?? undefined,
              voiceIdB: user.pollyVoiceB ?? undefined,
              region: user.s3Region,
            },
          );

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: "voice_done",
              stage: "Voice assets ready (Polly fallback)",
              progressPct: 60,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, jobId))
            .returning();

          nextJob = updatedJob;
          return NextResponse.json({
            job: nextJob,
            presignedUrls: presigned.urls,
          });
        } catch {
          // Polly fallback also failed — fall through to normal error handling
        }
      }

      const errorMessage = error instanceof AppError ? error.userMessage : "Voice dispatch failed. Review your routing settings and try again.";

      await db
        .update(jobs)
        .set({
          status: "failed",
          stage: "Voice dispatch failed",
          progressPct: 0,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      throw error;
    }

    return NextResponse.json({
      job: nextJob,
      presignedUrls: presigned.urls,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const userJobs = await db.select().from(jobs).where(eq(jobs.userId, user.id));

    return NextResponse.json({
      jobs: userJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "cleanup-old") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldJobs = await db
        .select({ id: jobs.id, createdAt: jobs.createdAt })
        .from(jobs)
        .where(eq(jobs.userId, user.id));

      const deletableJobs = oldJobs.filter(job => {
        const jobDate = job.createdAt ? new Date(job.createdAt) : null;
        return jobDate && jobDate < thirtyDaysAgo;
      });

      if (deletableJobs.length === 0) {
        return NextResponse.json({ message: "No old jobs to delete", deletedCount: 0 });
      }

      const idsToDelete = deletableJobs.map(j => j.id);

      await db
        .delete(jobs)
        .where(eq(jobs.userId, user.id));

      return NextResponse.json({
        message: `Deleted ${idsToDelete.length} old jobs`,
        deletedCount: idsToDelete.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
