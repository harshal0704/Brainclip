import {NextResponse} from "next/server";
import type { NextRequest } from "next/server";

import {AppError, toErrorResponse} from "@/lib/errors";
import {getLambdaFunctions} from "@/lib/render";
import {requireUserFromRequest} from "@/lib/session";
import {decryptSecret} from "@/lib/crypto";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") || "lambda";

    const functionName = process.env.REMOTION_FUNCTION_NAME;

    if (provider === "github") {
      const user = await requireUserFromRequest(request);
      const userGithubToken = user.githubToken ? decryptSecret(user.githubToken) : null;
      const userGithubRepo = user.githubRepo;

      // Fall back to .env values if user hasn't configured their own
      const githubToken = userGithubToken || process.env.GITHUB_TOKEN || null;
      const githubRepo = userGithubRepo || process.env.GITHUB_REPO || null;

      if (!githubToken || !githubRepo) {
        return NextResponse.json({
          ok: false,
          provider: "github",
          needsConfig: true,
          note: "Configure your GitHub token and repository in Settings to enable GitHub Actions rendering.",
        }, { status: 200 });
      }

      try {
        const res = await fetch(`https://api.github.com/repos/${githubRepo}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            provider: "github",
            note: `GitHub API returned ${res.status}. Check your token and repository settings.`,
          }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json({
          ok: true,
          provider: "github",
          note: `Connected to ${data.full_name}. Ready to render.`,
        });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          provider: "github",
          note: err instanceof Error ? err.message : "Could not connect to GitHub. Check your token and repository.",
        }, { status: 200 });
      }
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
