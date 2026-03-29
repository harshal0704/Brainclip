import { NextResponse, NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/session";
import { presignedPut, presignedGet } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    if (!user?.s3Bucket) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 400 });
    }

    const { filename, contentType } = await request.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    const key = `stickers/${crypto.randomUUID()}-${filename}`;

    const uploadUrl = await presignedPut({
      bucket: user.s3Bucket,
      key,
      contentType,
      region: user.s3Region || "us-east-1",
    });

    const publicUrl = await presignedGet({
      bucket: user.s3Bucket,
      key,
      region: user.s3Region || "us-east-1",
      expiresIn: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error: any) {
    console.error("Failed to generate upload URL", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
