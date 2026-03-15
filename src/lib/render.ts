import {z} from "zod";

import {jobs} from "@/db/schema";
import {AppError} from "@/lib/errors";

export const renderProgressRequestSchema = z.object({
  bucketName: z.string(),
  renderId: z.string(),
});

type JobRecord = typeof jobs.$inferSelect;

const getRenderEnv = () => {
  const region = process.env.AWS_REGION as "us-east-1" | undefined;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;

  if (!region || !functionName || !serveUrl) {
    throw new AppError(
      "render_env_missing",
      "Missing Remotion Lambda environment variables",
      "Remotion Lambda is not configured yet. Add the AWS and Remotion settings first.",
      500,
    );
  }

  return {region, functionName, serveUrl};
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const toReadableRenderError = (error: unknown, phase: "trigger" | "progress" | "health" = "trigger") => {
  if (error instanceof AppError) {
    return error;
  }

  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("task timed out") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  ) {
    return new AppError(
      "lambda_timeout",
      message,
      "The Remotion render timed out. Try a shorter video, a smaller draft render, or redeploy the Lambda function with more resources.",
      504,
    );
  }

  if (
    normalized.includes("resource not found") ||
    normalized.includes("resourcenotfoundexception") ||
    normalized.includes("function not found") ||
    normalized.includes("cannot find function")
  ) {
    return new AppError(
      "lambda_function_not_found",
      message,
      "The configured Remotion Lambda function was not found. Deploy the function again and update `REMOTION_FUNCTION_NAME`.",
      phase === "health" ? 404 : 502,
    );
  }

  if (
    normalized.includes("accessdenied") ||
    normalized.includes("access denied") ||
    normalized.includes("not authorized") ||
    normalized.includes("forbidden")
  ) {
    return new AppError(
      "s3_permission_denied",
      message,
      "AWS denied access while reading or writing render assets. Check the Lambda role and S3 bucket permissions.",
      502,
    );
  }

  return new AppError(
    phase === "health" ? "render_health_failed" : "render_failed",
    message,
    phase === "health"
      ? "The Remotion Lambda deployment could not be verified. Check your AWS credentials, region, and function name."
      : "The render could not be started or checked. Verify the Lambda deployment, S3 access, and asset URLs.",
    502,
  );
};

export const getRenderFailureMessage = (error: unknown) => {
  return toReadableRenderError(error).userMessage;
};

export async function triggerLambdaRender(job: JobRecord, inputProps: Record<string, unknown>) {
  const env = getRenderEnv();
  const {renderMediaOnLambda} = await import("@remotion/lambda/client");

  try {
    const render = await renderMediaOnLambda({
      region: env.region,
      functionName: env.functionName,
      serveUrl: env.serveUrl,
      composition: "ReelComposition",
      inputProps,
      codec: "h264",
      imageFormat: "jpeg",
      framesPerLambda: 10,
      privacy: "private",
      deleteAfter: "7-days",
      outName: job.s3VideoKey?.split("/").pop() ?? "final.mp4",
      downloadBehavior: {type: "play-in-browser"},
      timeoutInMilliseconds: 110000,
    });

    return {
      renderId: render.renderId,
      bucketName: render.bucketName,
    };
  } catch (error) {
    throw toReadableRenderError(error, "trigger");
  }
}

export async function getLambdaRenderProgress(input: z.infer<typeof renderProgressRequestSchema>) {
  const payload = renderProgressRequestSchema.parse(input);
  const env = getRenderEnv();
  const {getRenderProgress} = await import("@remotion/lambda/client");

  try {
    return await getRenderProgress({
      region: env.region,
      functionName: env.functionName,
      bucketName: payload.bucketName,
      renderId: payload.renderId,
    });
  } catch (error) {
    throw toReadableRenderError(error, "progress");
  }
}

export async function getLambdaFunctions() {
  const env = getRenderEnv();
  const {getFunctions} = await import("@remotion/lambda/client");

  try {
    return await getFunctions({
      region: env.region,
      compatibleOnly: false,
    });
  } catch (error) {
    throw toReadableRenderError(error, "health");
  }
}
