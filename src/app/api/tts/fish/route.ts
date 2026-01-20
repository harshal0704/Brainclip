import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { jobs } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { putObjectFromBuffer } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";
import { synthesizeFishAudioLine } from "@/lib/voice";

const fishTtsRequestSchema = z.object({
  jobId: z.string().uuid().optional(),
  lineId: z.string().min(1),
  text: z.string().min(1),
  voiceId: z.string().min(1),
  emotion: z.string().optional(),
  speakingRate: z.number().min(0.75).max(1.25).default(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = fishTtsRequestSchema.parse(await request.json());
    const fishApiKey = decryptSecret(user.fishApiKey);

    if (!user.s3Bucket) {
      throw new AppError("bucket_missing", "User does not have a provisioned S3 bucket", "Your storage bucket is not ready yet. Sign out and back in to provision it.", 400);
    }

    if (!fishApiKey) {
      throw new AppError("fish_key_missing", "User has no Fish.audio key", "Add your Fish.audio API key in settings before using Fish TTS.", 400);
    }

    let s3Key = `audio/tts/${Date.now()}-${body.lineId}.wav`;

    if (body.jobId) {
      const [job] = await db
        .select({ s3AudioKeys: jobs.s3AudioKeys })
        .from(jobs)
        .where(and(eq(jobs.id, body.jobId), eq(jobs.userId, user.id)))
        .limit(1);

      if (!job) {
        throw new AppError("job_not_found", "Job does not exist for this user", "We could not find that job.", 404);
      }

      const jobAudioKeys = (job.s3AudioKeys ?? {}) as Record<string, string>;
      s3Key = jobAudioKeys[body.lineId] ?? `audio/${body.jobId}/${body.lineId}.wav`;
    }

    const audioBuffer = await synthesizeFishAudioLine({
      text: body.text,
      voiceId: body.voiceId,
      emotion: body.emotion,
      speakingRate: body.speakingRate,
      apiKey: fishApiKey,
    });

    await putObjectFromBuffer({
      bucket: user.s3Bucket,
      key: s3Key,
      body: audioBuffer,
      contentType: "audio/wav",
      region: user.s3Region,
    });

    return NextResponse.json({ s3Key });
  } catch (error) {
    return toErrorResponse(error);
  }
}
