import { db } from "../src/lib/db";
import { jobs, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { triggerLambdaRender } from "../src/lib/render";
import { buildRenderInputProps, getSpeakerConfigsFromVoiceMap } from "../src/lib/jobs";

const JOB_ID = "f4716b7a-7d9a-4992-95c6-15b5dc11615a";

const main = async () => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, JOB_ID as any));
  if (!job) { console.error("Job not found"); return; }
  console.log("Job found:", job.id, job.status);

  const [user] = await db.select().from(users).where(eq(users.id, job.userId as any));
  if (!user) { console.error("User not found"); return; }

  const j = job as any;
  const u = user as any;
  console.log(`Job status: ${j.status}, renderId: ${j.lambdaRenderId}`);
  console.log(`User bucket: ${u.s3Bucket}, region: ${u.s3Region}`);

  const { speakerA, speakerB } = getSpeakerConfigsFromVoiceMap((j.voiceMap ?? {}) as Record<string, unknown>);
  const inputProps = await buildRenderInputProps({
    bucket: u.s3Bucket ?? "",
    region: u.s3Region ?? "us-east-1",
    backgroundUrl: j.backgroundUrl,
    subtitleStyle: j.subtitleStyleId,
    editConfig: (j.editConfig ?? {}) as Record<string, unknown>,
    speakerA,
    speakerB,
    scriptLines: (j.scriptLines ?? []) as Array<{ id?: string; speaker: "A" | "B"; text: string }>,
    s3AudioKeys: (j.s3AudioKeys ?? {}) as Record<string, string>,
    transcriptKey: j.s3TranscriptKey,
    resolution: j.resolution ?? "720p",
  });

  console.log("Input props built, triggering Lambda...");
  console.log("  audioSrc:", inputProps.audioSrc ? "(presigned URL)" : "(empty)");
  console.log("  backgroundSrc:", inputProps.backgroundSrc || "(empty)");
  console.log("  wordTimings:", inputProps.wordTimings.length, "words");
  console.log("  scriptLines:", inputProps.scriptLines.length, "lines");

  const result = await triggerLambdaRender(j, inputProps);
  console.log("Render triggered! renderId:", result.renderId, "bucket:", result.bucketName);

  await db.update(jobs).set({
    status: "rendering",
    stage: "Rendering video with Remotion Lambda",
    progressPct: 70,
    lambdaRenderId: result.renderId,
    lambdaBucket: result.bucketName,
    updatedAt: new Date(),
  }).where(eq(jobs.id, JOB_ID));

  console.log("Job updated to rendering. Poll /api/jobs/" + JOB_ID + " for progress.");
};

main().catch(e => { console.error(e.message); process.exit(1); });
