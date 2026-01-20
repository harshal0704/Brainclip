import { and, eq } from "drizzle-orm";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { users } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const requireUserFromRequest = async (request: NextRequest) => {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.sub) {
    throw new AppError("unauthorized", "Missing session token", "Please sign in to continue.", 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, token.sub)).limit(1);

  if (!user) {
    throw new AppError("user_not_found", "Authenticated user record not found", "Please sign in again.", 401);
  }

  return user;
};

export const requireOwnedJob = async (request: NextRequest, jobId: string) => {
  const user = await requireUserFromRequest(request);
  const { jobs } = await import("@/db/schema");

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);

  if (!job) {
    throw new AppError("job_not_found", "Job does not exist for this user", "We could not find that job.", 404);
  }

  return { user, job };
};
