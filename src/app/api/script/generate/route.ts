import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decryptSecret } from "@/lib/crypto";
import { AppError, toErrorResponse } from "@/lib/errors";
import { generateScript, scriptRequestSchema } from "@/lib/scriptGen";
import { requireUserFromRequest } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = scriptRequestSchema.parse(await request.json());
    const llmApiKey = decryptSecret(user.llmApiKey);

    if (!llmApiKey) {
      throw new AppError("llm_key_missing", "User is missing llmApiKey", "Add your LLM API key in settings before generating a script.", 400);
    }

    const scriptLines = await generateScript({
      ...body,
      llmApiKey,
      llmBaseUrl: user.llmBaseUrl ?? "https://api.openai.com/v1",
      llmModel: user.llmModel ?? "gpt-4o-mini",
    });

    return NextResponse.json({ scriptLines });
  } catch (error) {
    return toErrorResponse(error);
  }
}
