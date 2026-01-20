import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/errors";
import { provisionUser } from "@/lib/s3";

const provisionRequestSchema = z.object({
  googleId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).optional().nullable(),
  image: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const internalSecret = request.headers.get("x-brainclip-internal");

    if (process.env.NEXTAUTH_SECRET && internalSecret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = provisionRequestSchema.parse(await request.json());
    const result = await provisionUser(body);

    return NextResponse.json({
      created: result.created,
      user: {
        id: result.user.id,
        email: result.user.email,
        googleId: result.user.googleId,
        s3Bucket: result.user.s3Bucket,
        s3Region: result.user.s3Region,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
