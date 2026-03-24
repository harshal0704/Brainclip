import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { drafts } from "@/db/schema";
import { requireUserFromRequest } from "@/lib/session";
import { toErrorResponse, AppError } from "@/lib/errors";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserFromRequest(request);

    const [draft] = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, params.id), eq(drafts.userId, user.id)));

    if (!draft) {
      throw new AppError("draft_not_found", "Draft not found", "Could not find the requested draft.", 404);
    }

    return NextResponse.json({ draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserFromRequest(request);
    const body = await request.json();

    const {
      topic,
      duoId,
      speakerAPersona,
      speakerBPersona,
      voiceMode,
      subtitleStyle,
      stickerAnim,
      stickerUrlA,
      stickerUrlB,
      backgroundUrl,
      bgDimOpacity,
      showProgressBar,
      assetPackId,
      resolution,
      ctaText,
      scriptLines,
      fishModelA,
      fishModelB,
    } = body;

    const [updatedDraft] = await db
      .update(drafts)
      .set({
        ...(topic && { topic }),
        ...(duoId && { duoId }),
        ...(speakerAPersona && { speakerAPersona }),
        ...(speakerBPersona && { speakerBPersona }),
        ...(voiceMode && { voiceMode }),
        ...(subtitleStyle && { subtitleStyle }),
        ...(stickerAnim && { stickerAnim }),
        ...(stickerUrlA && { stickerUrlA }),
        ...(stickerUrlB && { stickerUrlB }),
        ...(backgroundUrl !== undefined && { backgroundUrl }),
        ...(bgDimOpacity !== undefined && { bgDimOpacity }),
        ...(showProgressBar !== undefined && { showProgressBar }),
        ...(assetPackId && { assetPackId }),
        ...(resolution && { resolution }),
        ...(ctaText !== undefined && { ctaText }),
        ...(scriptLines && { scriptLines }),
        ...(fishModelA && { fishModelA }),
        ...(fishModelB && { fishModelB }),
        updatedAt: new Date(),
      })
      .where(and(eq(drafts.id, params.id), eq(drafts.userId, user.id)))
      .returning();

    if (!updatedDraft) {
      throw new AppError("draft_not_found", "Draft not found", "Could not find the draft to update.", 404);
    }

    return NextResponse.json({ draft: updatedDraft });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserFromRequest(request);

    const [deleted] = await db
      .delete(drafts)
      .where(and(eq(drafts.id, params.id), eq(drafts.userId, user.id)))
      .returning();

    if (!deleted) {
      throw new AppError("draft_not_found", "Draft not found", "Could not find the draft to delete.", 404);
    }

    return NextResponse.json({ success: true, deletedId: deleted.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}