import {NextResponse} from "next/server";

import {AppError, toErrorResponse} from "@/lib/errors";
import {getLambdaFunctions} from "@/lib/render";

export async function GET() {
  try {
    const functionName = process.env.REMOTION_FUNCTION_NAME;

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
