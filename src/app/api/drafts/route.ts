import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drafts } from "@/db/schema";
import { requireUserFromRequest } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = await request.json();

    const {
      draftId,
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

    if (draftId) {
      const existing = await db
        .select()
        .from(drafts)
        .where(eq(drafts.id, draftId))
        .limit(1);

      if (existing.length > 0 && existing[0].userId === user.id) {
        const [updated] = await db
          .update(drafts)
          .set({
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
            updatedAt: new Date(),
          })
          .where(eq(drafts.id, draftId))
          .returning();

        return NextResponse.json({ draft: updated });
      }
    }

    const [newDraft] = await db
      .insert(drafts)
      .values({
        userId: user.id,
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
      })
      .returning();

    return NextResponse.json({ draft: newDraft });
  } catch (error) {
    console.error("Draft save error:", error);
    return NextResponse.json(
      { error: { message: "Failed to save draft" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    
    const userDrafts = await db
      .select()
      .from(drafts)
      .where(eq(drafts.userId, user.id))
      .orderBy(drafts.updatedAt)
      .limit(10);

    return NextResponse.json({ drafts: userDrafts });
  } catch (error) {
    console.error("Draft fetch error:", error);
    return NextResponse.json(
      { error: { message: "Failed to fetch drafts" } },
      { status: 500 }
    );
  }
}