import {NextResponse} from "next/server";

import {AppError, toErrorResponse} from "@/lib/errors";
import {getLambdaFunctions} from "@/lib/render";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") || "lambda";

    const functionName = process.env.REMOTION_FUNCTION_NAME;
    const githubToken = process.env.GITHUB_TOKEN;

    if (provider === "github") {
      if (!githubToken) {
        throw new AppError(
          "github_not_configured",
          "GITHUB_TOKEN is not configured",
          "GitHub Actions render requires GITHUB_TOKEN to be configured in environment.",
          500,
        );
      }

      return NextResponse.json({
        ok: true,
        provider: "github",
        note: "GitHub Actions render is configured and ready.",
      });
    }

    if (!functionName) {
      throw new AppError(
        "render_function_missing",
        "REMOTION_FUNCTION_NAME is not configured",
        "Remotion Lambda is not configured yet. Add `REMOTION_FUNCTION_NAME` to your environment.",
        500,
      );
    }

    const functions = await getLambdaFunctions();
    const deployedFunction = functions.find((entry) => entry.functionName === functionName);

    if (!deployedFunction) {
      throw new AppError(
        "lambda_function_not_found",
        `Remotion Lambda function ${functionName} was not found in AWS`,
        "The configured Remotion Lambda function was not found. Deploy it again and update your environment values.",
        404,
      );
    }

    return NextResponse.json({
      ok: true,
      functionName: deployedFunction.functionName,
      memorySizeInMb: deployedFunction.memorySizeInMb,
      diskSizeInMb: deployedFunction.diskSizeInMb,
      timeoutInSeconds: deployedFunction.timeoutInSeconds,
      version: deployedFunction.version,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
