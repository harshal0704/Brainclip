import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { jobs } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { buildJobPresignedOutputs } from "@/lib/jobs";
import { requireUserFromRequest } from "@/lib/session";
import { dispatchColabVoiceJob, dispatchElevenLabsVoiceJob, dispatchFishApiVoiceJob, dispatchHuggingFaceVoiceJob } from "@/lib/voice";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const retrySchema = z.object({
  stage: z.enum(["voice", "render", "all"]).default("all"),
  forceVoiceRegeneration: z.boolean().default(false),
});

/**
 * POST /api/jobs/[id]/retry
 * Retry a failed job from a specific stage
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const body = retrySchema.parse(await request.json());

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

    // Only allow retry for failed jobs (or stuck jobs)
    const retryableStatuses = ["failed", "pending", "voice_processing", "rendering"];
    if (!retryableStatuses.includes(job.status)) {
      throw new AppError(
        "job_not_retryable",
        `Job status ${job.status} is not retryable`,
        "This job cannot be retried because it has already completed successfully.",
        400,
      );
    }

    const scriptLines = job.scriptLines as Array<{
      id: string;
      speaker: "A" | "B";
      text: string;
      emotion?: string;
      speaking_rate?: number;
      pause_ms?: number;
      temperature?: number;
      chunk_length?: number;
      normalize?: boolean;
    }>;

    const voiceMap = job.voiceMap as {
      mode?: string;
      speakerA: { label: string; color: string; stickerUrl: string; position: string; modelId?: string };
      speakerB: { label: string; color: string; stickerUrl: string; position: string; modelId?: string };
    };

    // Determine what to retry based on current status and requested stage
    let startFromVoice = body.stage === "all" || body.stage === "voice" || body.forceVoiceRegeneration;
    
    // If voice is already done and not forcing regeneration, skip voice stage
    if (job.status === "voice_done" || job.status === "rendering") {
      startFromVoice = body.forceVoiceRegeneration;
    }

    if (startFromVoice) {
      // Regenerate presigned URLs
      const presigned = await buildJobPresignedOutputs({
        bucket: user.s3Bucket,
        jobId: id,
        lineIds: scriptLines.map((line) => line.id),
        region: user.s3Region,
      });

      // Update job to pending
      await db
        .update(jobs)
        .set({
          status: "pending",
          stage: "Retrying from voice generation",
          progressPct: 0,
          errorMessage: null,
          s3AudioKeys: {
            ...presigned.keys.audioFiles,
            master: presigned.keys.masterAudio,
          },
          s3TranscriptKey: presigned.keys.transcriptJson,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));

      // Dispatch voice job
      const voiceMode = String(voiceMap.mode ?? "fish-api");

      try {
        if (voiceMode === "colab") {
          await dispatchColabVoiceJob(
            {
              jobId: id,
              userId: user.id,
              bucket: user.s3Bucket,
              region: user.s3Region,
              colabUrl: user.colabUrl ?? undefined,
              lines: scriptLines.map((line) => ({
                ...line,
                emotion: line.emotion ?? "neutral",
                speaking_rate: line.speaking_rate ?? 1,
                pause_ms: line.pause_ms ?? 250,
                temperature: line.temperature ?? 0.7,
                chunk_length: line.chunk_length ?? 200,
                normalize: line.normalize ?? true,
              })),
              speakerA: voiceMap.speakerA as Parameters<typeof dispatchColabVoiceJob>[0]["speakerA"],
              speakerB: voiceMap.speakerB as Parameters<typeof dispatchColabVoiceJob>[0]["speakerB"],
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

          await db
            .update(jobs)
            .set({
              status: "voice_processing",
              stage: "Colab accepted retry job",
              progressPct: 8,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, id));
        } else {
          if (user.ttsProvider === "huggingface") {
            const hfToken = decryptSecret(user.hfToken);

            if (!hfToken) {
              throw new AppError(
                "hf_key_missing",
                "No Hugging Face Token",
                "Add your Hugging Face Token in settings.",
                400,
              );
            }

            await db
              .update(jobs)
              .set({
                status: "voice_processing",
                stage: "Retrying voice generation with Hugging Face",
                progressPct: 12,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));

            await dispatchHuggingFaceVoiceJob(
              {
                jobId: id,
                userId: user.id,
                bucket: user.s3Bucket,
                region: user.s3Region,
                lines: scriptLines.map((line) => ({
                  ...line,
                  emotion: line.emotion ?? "neutral",
                  speaking_rate: line.speaking_rate ?? 1,
                  pause_ms: line.pause_ms ?? 250,
                  temperature: line.temperature ?? 0.7,
                  chunk_length: line.chunk_length ?? 200,
                  normalize: line.normalize ?? true,
                })),
                speakerA: voiceMap.speakerA as Parameters<typeof dispatchHuggingFaceVoiceJob>[0]["speakerA"],
                speakerB: voiceMap.speakerB as Parameters<typeof dispatchHuggingFaceVoiceJob>[0]["speakerB"],
                presignedUrls: {
                  lines: presigned.urls.audioFiles,
                  master: presigned.urls.masterAudio,
                  transcript: presigned.urls.transcriptJson,
                },
              },
              hfToken,
            );

            await db
              .update(jobs)
              .set({
                status: "voice_done",
                stage: "Voice assets regenerated successfully",
                progressPct: 60,
                errorMessage: null,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));
          } else if (user.ttsProvider === "elevenlabs") {
            const elevenLabsApiKey = decryptSecret(user.elevenLabsApiKey);

            if (!elevenLabsApiKey) {
              throw new AppError(
                "elevenlabs_key_missing",
                "No Eleven Labs API Key",
                "Add your Eleven Labs API Key in settings.",
                400,
              );
            }

            await db
              .update(jobs)
              .set({
                status: "voice_processing",
                stage: "Retrying voice generation with Eleven Labs",
                progressPct: 12,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));

            await dispatchElevenLabsVoiceJob(
              {
                jobId: id,
                userId: user.id,
                bucket: user.s3Bucket,
                region: user.s3Region,
                lines: scriptLines.map((line) => ({
                  ...line,
                  emotion: line.emotion ?? "neutral",
                  speaking_rate: line.speaking_rate ?? 1,
                  pause_ms: line.pause_ms ?? 250,
                  temperature: line.temperature ?? 0.7,
                  chunk_length: line.chunk_length ?? 200,
                  normalize: line.normalize ?? true,
                })),
                speakerA: voiceMap.speakerA as Parameters<typeof dispatchElevenLabsVoiceJob>[0]["speakerA"],
                speakerB: voiceMap.speakerB as Parameters<typeof dispatchElevenLabsVoiceJob>[0]["speakerB"],
                presignedUrls: {
                  lines: presigned.urls.audioFiles,
                  master: presigned.urls.masterAudio,
                  transcript: presigned.urls.transcriptJson,
                },
              },
              elevenLabsApiKey,
            );

            await db
              .update(jobs)
              .set({
                status: "voice_done",
                stage: "Voice assets regenerated successfully",
                progressPct: 60,
                errorMessage: null,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));
          } else {
            const fishApiKey = decryptSecret(user.fishApiKey);

            if (!fishApiKey) {
              throw new AppError(
                "fish_key_missing",
                "No Fish API key",
                "Add your Fish.audio API key in settings.",
                400,
              );
            }

            await db
              .update(jobs)
              .set({
                status: "voice_processing",
                stage: "Retrying voice generation with Fish.audio",
                progressPct: 12,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));

            await dispatchFishApiVoiceJob(
              {
                jobId: id,
                userId: user.id,
                bucket: user.s3Bucket,
                region: user.s3Region,
                lines: scriptLines.map((line) => ({
                  ...line,
                  emotion: line.emotion ?? "neutral",
                  speaking_rate: line.speaking_rate ?? 1,
                  pause_ms: line.pause_ms ?? 250,
                  temperature: line.temperature ?? 0.7,
                  chunk_length: line.chunk_length ?? 200,
                  normalize: line.normalize ?? true,
                })),
                speakerA: voiceMap.speakerA as Parameters<typeof dispatchFishApiVoiceJob>[0]["speakerA"],
                speakerB: voiceMap.speakerB as Parameters<typeof dispatchFishApiVoiceJob>[0]["speakerB"],
                presignedUrls: {
                  lines: presigned.urls.audioFiles,
                  master: presigned.urls.masterAudio,
                  transcript: presigned.urls.transcriptJson,
                },
              },
              fishApiKey,
            );

            await db
              .update(jobs)
              .set({
                status: "voice_done",
                stage: "Voice assets regenerated successfully",
                progressPct: 60,
                errorMessage: null,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, id));
          }
        }
      } catch (voiceError) {
        const errorMessage =
          voiceError instanceof AppError
            ? voiceError.userMessage
            : "Voice retry failed. Check your settings.";

        await db
          .update(jobs)
          .set({
            status: "failed",
            stage: "Voice retry failed",
            progressPct: 0,
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, id));

        throw voiceError;
      }
    } else {
      // Just retry from render stage
      await db
        .update(jobs)
        .set({
          status: "voice_done",
          stage: "Retrying from render stage",
          progressPct: 60,
          errorMessage: null,
          lambdaRenderId: null,
          lambdaBucket: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    }

    // Fetch updated job
    const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

    return NextResponse.json({
      job: updatedJob,
      retryInfo: {
        retriedFrom: startFromVoice ? "voice" : "render",
        message: startFromVoice
          ? "Job restarted from voice generation"
          : "Job restarted from render stage",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
