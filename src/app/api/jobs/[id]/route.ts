import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { jobs } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { buildRenderInputProps, getSpeakerConfigsFromVoiceMap } from "@/lib/jobs";
import { getLambdaRenderProgress, getRenderFailureMessage, triggerLambdaRender, triggerGithubRender, triggerColabRender } from "@/lib/render";
import { copyObject, headObject } from "@/lib/s3";
import { requireOwnedJob } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";

const getProgressWithRetry = async (
  renderId: string,
  bucketName: string,
  maxRetries = 3
) => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getLambdaRenderProgress({
        renderId,
        bucketName,
      });
    } catch (error) {
      lastError = error;
      console.error(`[Render Progress] Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt, 3000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

const pollColabStatus = async (colabUrl: string, jobId: string) => {
  const response = await fetch(new URL(`/voice/job/${jobId}`, colabUrl));

  if (!response.ok) {
    throw new AppError("colab_offline", `Colab status polling failed: ${response.status}`, "Your Colab session seems offline. Restart it or switch to Fish.audio mode.", 502);
  }

  return response.json() as Promise<{
    stage?: string;
    progressPct?: number;
    error?: string;
    gpuMemFreeGb?: number;
  }>;
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
          stage: isVoiceDone
            ? "Voice assets ready"
            : remoteStage + (remote.gpuMemFreeGb ? ` (GPU ${remote.gpuMemFreeGb}GB free)` : ""),
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
        videoMode: nextJob.videoMode ?? "duo-debate",
      });

      try {
        let renderId = "";
        let bucketName = "";
        let stage = "Rendering video";

        if (user.renderProvider === "colab" && user.colabUrl) {
          const render = await triggerColabRender(nextJob, inputProps, user.colabUrl, user.s3Bucket, user.s3Region || "us-east-1");
          renderId = render.renderId;
          bucketName = render.bucketName;
          stage = "Rendering video on Colab server";
        } else if (user.renderProvider === "github" && user.s3Bucket) {
          const githubToken = user.githubToken ? (decryptSecret(user.githubToken) ?? "") : "";
          const githubRepo = user.githubRepo ?? "";
          // triggerGithubRender will fall back to .env values if these are empty
          const render = await triggerGithubRender(nextJob, inputProps, user.s3Bucket!, user.s3Region || "us-east-1", githubToken, githubRepo);
          renderId = render.renderId;
          bucketName = render.bucketName;
          stage = "Rendering video with GitHub Actions";
        } else {
          const render = await triggerLambdaRender(nextJob, inputProps);
          renderId = render.renderId;
          bucketName = render.bucketName;
          stage = "Rendering video with Remotion Lambda";
        }

        const [updatedJob] = await db
          .update(jobs)
          .set({
            status: "rendering",
            stage,
            progressPct: 70,
            lambdaRenderId: renderId,
            lambdaBucket: bucketName,
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
        const isGithub = nextJob.lambdaRenderId.startsWith("github-");
        const isColab = nextJob.lambdaRenderId.startsWith("colab-");

        if ((isGithub || isColab) && user.s3Bucket && nextJob.s3VideoKey) {
          const isDone = await hasObject(user.s3Bucket, nextJob.s3VideoKey, user.s3Region);
          
          if (isDone) {
            const [updatedJob] = await db
              .update(jobs)
              .set({
                status: "done",
                stage: "Render complete",
                progressPct: 100,
                updatedAt: new Date(),
              })
              .where(eq(jobs.id, nextJob.id))
              .returning();
            nextJob = updatedJob;
          } else if (isGithub) {
            // Query actual GitHub Actions run status for real progress
            // Fall back to .env values if user hasn't configured their own
            const githubToken = (user.githubToken ? decryptSecret(user.githubToken) : null) || process.env.GITHUB_TOKEN || "";
            const githubRepo = user.githubRepo || process.env.GITHUB_REPO || "";
            let ghStage = "Rendering video with GitHub Actions";
            let ghProgress = nextJob.progressPct;

            try {
              const runsRes = await fetch(
                `https://api.github.com/repos/${githubRepo}/actions/workflows/render.yml/runs?per_page=3&status=in_progress`,
                {
                  headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github.v3+json",
                  },
                  signal: AbortSignal.timeout(8000),
                }
              );

              if (runsRes.ok) {
                const runsData = await runsRes.json();
                const runs = runsData.workflow_runs ?? [];
                // Find the run for this job (most recent matching run)
                const matchingRun = runs[0];

                if (matchingRun) {
                  const runStatus = matchingRun.status; // queued, in_progress, completed
                  const conclusion = matchingRun.conclusion; // success, failure, cancelled, null

                  if (runStatus === "completed" && conclusion === "success") {
                    // Render done but S3 upload might be propagating, check again soon
                    ghStage = "GitHub Action complete — waiting for S3 upload";
                    ghProgress = 98;
                  } else if (runStatus === "completed" && conclusion === "failure") {
                    const [failedJob] = await db
                      .update(jobs)
                      .set({
                        status: "failed",
                        stage: "GitHub Actions workflow failed",
                        errorMessage: `Workflow run failed (conclusion: ${conclusion}). Check your GitHub Actions logs at: ${matchingRun.html_url}`,
                        updatedAt: new Date(),
                      })
                      .where(eq(jobs.id, nextJob.id))
                      .returning();
                    nextJob = failedJob;
                    // Return early — no further progress update needed
                    return NextResponse.json({
                      job: nextJob,
                      jobId: nextJob.id,
                      status: nextJob.status,
                      progress: nextJob.progressPct,
                      stage: nextJob.stage,
                      error: nextJob.errorMessage,
                    });
                  } else if (runStatus === "queued") {
                    ghStage = "Queued — waiting for GitHub runner";
                    ghProgress = Math.max(ghProgress, 72);
                  } else if (runStatus === "in_progress") {
                    // Try to get the current step from jobs endpoint
                    try {
                      const jobsRes = await fetch(matchingRun.jobs_url, {
                        headers: {
                          Authorization: `Bearer ${githubToken}`,
                          Accept: "application/vnd.github.v3+json",
                        },
                        signal: AbortSignal.timeout(5000),
                      });
                      if (jobsRes.ok) {
                        const jobsData = await jobsRes.json();
                        const runJob = jobsData.jobs?.[0];
                        if (runJob?.steps) {
                          const completedSteps = runJob.steps.filter((s: any) => s.status === "completed").length;
                          const totalSteps = runJob.steps.length;
                          const currentStep = runJob.steps.find((s: any) => s.status === "in_progress");
                          const stepName = currentStep?.name ?? "Processing";
                          // Map real steps to progress: 70 (start) → 97 (about to finish)
                          ghProgress = Math.max(ghProgress, Math.min(97, 70 + Math.round((completedSteps / totalSteps) * 27)));
                          ghStage = `GitHub Actions: ${stepName} (${completedSteps}/${totalSteps} steps)`;
                        }
                      }
                    } catch {
                      // Fallback — just show generic in_progress
                      ghStage = "Rendering on GitHub Actions runner";
                      ghProgress = Math.min(95, ghProgress + 1);
                    }
                  }
                } else {
                  // No in_progress run found — check completed runs
                  ghStage = "Waiting for GitHub runner to pick up the job";
                  ghProgress = Math.min(95, ghProgress + 1);
                }
              }
            } catch {
              // GitHub API unreachable — fall back to gentle progress bump
              ghProgress = Math.min(95, ghProgress + 1);
            }

            if (ghProgress !== nextJob.progressPct || ghStage !== nextJob.stage) {
              const [updatedJob] = await db
                .update(jobs)
                .set({
                  progressPct: ghProgress,
                  stage: ghStage,
                  updatedAt: new Date(),
                })
                .where(eq(jobs.id, nextJob.id))
                .returning();
              nextJob = updatedJob;
            }
          } else {
            // Colab or no GitHub token — gentle progress bump
            const newProgress = Math.min(95, nextJob.progressPct + 1);
            if (newProgress !== nextJob.progressPct) {
              const [updatedJob] = await db
                .update(jobs)
                .set({
                  progressPct: newProgress,
                  updatedAt: new Date(),
                })
                .where(eq(jobs.id, nextJob.id))
                .returning();
              nextJob = updatedJob;
            }
          }
        } else {
          const progress = await getProgressWithRetry(
            nextJob.lambdaRenderId,
            nextJob.lambdaBucket
          );

          if (progress.fatalErrorEncountered) {
            return failJob({
              jobId: nextJob.id,
              progressPct: nextJob.progressPct,
              error: progress.errors[0]?.message ?? new Error("Remotion reported a fatal render error."),
              fallbackStage: "Render failed",
            });
          }

          let copyError: string | null = null;
          if (progress.done && progress.outKey && progress.outBucket && user.s3Bucket && nextJob.s3VideoKey) {
            try {
              await copyObject({
                sourceBucket: progress.outBucket,
                sourceKey: progress.outKey,
                destinationBucket: user.s3Bucket,
                destinationKey: nextJob.s3VideoKey,
                region: user.s3Region,
                contentType: "video/mp4",
              });
            } catch (copyErr) {
              console.error("[S3 Copy] Failed to copy video to user bucket:", copyErr instanceof Error ? copyErr.message : String(copyErr));
              copyError = copyErr instanceof Error ? copyErr.message : "Failed to copy video to user bucket";
            }
          }

          const renderProgressPct = Math.max(70, Math.round(progress.overallProgress * 100));
          const stage = progress.done
            ? (copyError ? "Render complete but copy failed" : "Render complete")
            : `Rendering video with Remotion Lambda (${renderProgressPct}%)`;

          const [updatedJob] = await db
            .update(jobs)
            .set({
              status: progress.done && !copyError ? "done" : "rendering",
              stage,
              progressPct: progress.done ? 100 : renderProgressPct,
              s3VideoKey: nextJob.s3VideoKey ?? progress.outKey,
              lambdaBucket: progress.outBucket ?? nextJob.lambdaBucket,
              errorMessage: copyError,
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, nextJob.id))
            .returning();

          nextJob = updatedJob;
        }
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
