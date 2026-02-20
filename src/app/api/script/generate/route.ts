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

    let baseUrl = user.llmBaseUrl || "https://generativelanguage.googleapis.com/v1beta";
    if (baseUrl.includes("api.openai.com") || baseUrl.includes("/v1beta/openai")) {
      baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    }
    
    let model = user.llmModel || "gemini-1.5-flash";
    if (model === "gpt-4o-mini" || model.includes("gpt")) {
      model = "gemini-1.5-flash";
    }

    const scriptLines = await generateScript({
      ...body,
      llmApiKey,
      llmBaseUrl: baseUrl,
      llmModel: model,
    });

    return NextResponse.json({ scriptLines });
  } catch (error) {
    console.error("Script generation route error:", error);
    return toErrorResponse(error);
  }
}
