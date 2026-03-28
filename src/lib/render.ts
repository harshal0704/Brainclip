import { z } from "zod";

import { jobs } from "@/db/schema";
import { AppError } from "@/lib/errors";

import { presignedPut } from "@/lib/s3";

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

  return { region, functionName, serveUrl };
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
      "The Remotion render timed out. The video may be too long (over 3 minutes). Try a shorter script or redeploy the Lambda function with more memory/timeout.",
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
  const { renderMediaOnLambda } = await import("@remotion/lambda/client");

  const videoMode = (inputProps.videoMode as string) || "duo-debate";
  const compositionName = getCompositionName(videoMode);

  try {
    const render = await renderMediaOnLambda({
      region: env.region,
      functionName: env.functionName,
      serveUrl: env.serveUrl,
      composition: compositionName,
      inputProps,
      codec: "h264",
      imageFormat: "jpeg",
      framesPerLambda: 200,
      privacy: "private",
      deleteAfter: "7-days",
      outName: job.s3VideoKey?.split("/").pop() ?? "final.mp4",
      downloadBehavior: { type: "play-in-browser" },
      timeoutInMilliseconds: 890000,
      crf: 28,
      logLevel: "verbose",
    });

    return {
      renderId: render.renderId,
      bucketName: render.bucketName,
    };
  } catch (error) {
    throw toReadableRenderError(error, "trigger");
  }
}

function getCompositionName(videoMode: string): string {
  switch (videoMode) {
    case "single-host":
    case "single-presenter":
      return "SingleHostComposition";
    case "duo-interview":
      return "DuoInterviewComposition";
    case "duo-side-by-side":
    case "duo-split-screen":
      return "SideBySideComposition";
    case "duo-debate":
    default:
      return "ReelComposition";
  }
}

export async function getLambdaRenderProgress(input: z.infer<typeof renderProgressRequestSchema>) {
  const payload = renderProgressRequestSchema.parse(input);
  const env = getRenderEnv();
  const { getRenderProgress } = await import("@remotion/lambda/client");

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
  const { getFunctions } = await import("@remotion/lambda/client");

  try {
    return await getFunctions({
      region: env.region,
      compatibleOnly: false,
    });
  } catch (error) {
    throw toReadableRenderError(error, "health");
  }
}

export async function triggerGithubRender(
  job: JobRecord,
  inputProps: Record<string, unknown>,
  bucketName: string,
  region: string
) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "harshal0704/Brainclip";

  if (!token) {
    throw new AppError(
      "github_token_missing",
      "Missing GITHUB_TOKEN environment variable",
      "Add GITHUB_TOKEN to use GitHub Actions renderer.",
      500
    );
  }

  const outKey = job.s3VideoKey || `jobs/${job.id}/final.mp4`;

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/render.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        jobId: job.id,
        inputProps: JSON.stringify(inputProps),
        outKey,
        bucketName,
        region,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new AppError(
      "github_dispatch_failed",
      errorBody || `GitHub API failed with status ${response.status}`,
      "Failed to trigger GitHub Actions render.",
      502
    );
  }

  return {
    renderId: `github-${job.id}-${Date.now()}`,
    bucketName,
    outKey,
  };
}

export async function triggerColabRender(
  job: JobRecord,
  inputProps: Record<string, unknown>,
  colabUrl: string,
  bucketName: string,
  region: string
) {
  if (!colabUrl) {
    throw new AppError(
      "colab_url_missing",
      "Missing Colab URL",
      "Add a valid Ngrok or LocalTunnel Colab URL to your profile.",
      400
    );
  }

  const outKey = job.s3VideoKey || `jobs/${job.id}/final.mp4`;

  // Get a presigned put URL so colab can upload the final MP4
  const presignedPutUrl = await presignedPut({
    bucket: bucketName,
    key: outKey,
    contentType: "video/mp4",
    region,
    expiresIn: 3600, // 1 hour is plenty for render
  });

  const response = await fetch(`${colabUrl.replace(/\/$/, '')}/render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: job.id,
      inputProps,
      s3PutUrl: presignedPutUrl,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new AppError(
      "colab_render_failed",
      errorBody || `Colab API failed with status ${response.status}`,
      "Failed to trigger Colab render engine. Is your Colab notebook running?",
      502
    );
  }

  return {
    renderId: `colab-${job.id}-${Date.now()}`,
    bucketName,
    outKey,
  };
}
