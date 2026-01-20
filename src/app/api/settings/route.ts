import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { users } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import { requireUserFromRequest } from "@/lib/session";

const settingsSchema = z.object({
  llmBaseUrl: z.string().url().optional().or(z.literal("")),
  llmModel: z.string().min(1),
  llmApiKey: z.string().optional(),
  fishModelA: z.string().optional(),
  fishModelB: z.string().optional(),
  fishApiKey: z.string().optional(),
  colabUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    return NextResponse.json({
      settings: {
        llmBaseUrl: user.llmBaseUrl ?? "https://api.openai.com/v1",
        llmModel: user.llmModel ?? "gpt-4o-mini",
        fishModelA: user.fishModelA ?? "",
        fishModelB: user.fishModelB ?? "",
        colabUrl: user.colabUrl ?? "",
        hasLlmApiKey: Boolean(decryptSecret(user.llmApiKey)),
        hasFishApiKey: Boolean(decryptSecret(user.fishApiKey)),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = settingsSchema.parse(await request.json());

    const [updatedUser] = await db
      .update(users)
      .set({
        llmBaseUrl: body.llmBaseUrl || "https://api.openai.com/v1",
        llmModel: body.llmModel,
        llmApiKey: body.llmApiKey?.trim() ? encryptSecret(body.llmApiKey.trim()) : user.llmApiKey,
        fishModelA: body.fishModelA?.trim() ? body.fishModelA : null,
        fishModelB: body.fishModelB?.trim() ? body.fishModelB : null,
        fishApiKey: body.fishApiKey?.trim() ? encryptSecret(body.fishApiKey.trim()) : user.fishApiKey,
        colabUrl: body.colabUrl?.trim() ? body.colabUrl : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      settings: {
        llmBaseUrl: updatedUser.llmBaseUrl,
        llmModel: updatedUser.llmModel,
        fishModelA: updatedUser.fishModelA,
        fishModelB: updatedUser.fishModelB,
        colabUrl: updatedUser.colabUrl,
        hasLlmApiKey: Boolean(updatedUser.llmApiKey),
        hasFishApiKey: Boolean(updatedUser.fishApiKey),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
