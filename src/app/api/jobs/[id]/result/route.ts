import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AppError, toErrorResponse } from "@/lib/errors";
import { headObject, presignedGet } from "@/lib/s3";
import { requireOwnedJob } from "@/lib/session";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, job } = await requireOwnedJob(request, params.id);

    if (job.status !== "done") {
      throw new AppError("job_not_ready", `Job status is ${job.status}`, "This video is not ready yet. Keep polling the job until rendering finishes.", 409);
    }

    const bucket = user.s3Bucket ?? job.lambdaBucket;
    const key = job.s3VideoKey;

    if (!bucket || !key) {
      throw new AppError("video_missing", "Rendered video location is missing", "We could not find the rendered video. Please re-render the job.", 404);
    }

    try {
      await headObject({ bucket, key, region: user.s3Region });
    } catch {
      throw new AppError("video_expired", "Rendered video object no longer exists", "This video has expired. Re-render to generate a new copy.", 404);
    }

    const url = await presignedGet({ bucket, key, region: user.s3Region, expiresIn: 3600 });

    return NextResponse.json({
      url,
      expiresIn: 3600,
      bucket,
      key,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
