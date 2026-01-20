import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { users } from "@/db/schema";
import { db } from "@/lib/db";

const buildAuthOptions = (request: NextRequest): NextAuthOptions => ({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== "google" || !user.email || !account.providerAccountId) {
        return false;
      }

      const response = await fetch(new URL("/api/auth/provision", request.nextUrl.origin), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-brainclip-internal": process.env.NEXTAUTH_SECRET ?? "",
        },
        body: JSON.stringify({
          googleId: account.providerAccountId,
          email: user.email,
          name: user.name,
          image: user.image,
        }),
      });

      return response.ok;
    },
    async jwt({ token, account, user }) {
      const googleId = account?.providerAccountId ?? (token.googleId as string | undefined);
      const email = user?.email ?? token.email;

      if (!googleId && !email) {
        return token;
      }

      const lookupCondition = googleId
        ? email
          ? or(eq(users.googleId, googleId), eq(users.email, email))
          : eq(users.googleId, googleId)
        : eq(users.email, email!);

      const [dbUser] = await db
        .select({
          id: users.id,
          googleId: users.googleId,
          s3Bucket: users.s3Bucket,
          s3Region: users.s3Region,
        })
        .from(users)
        .where(lookupCondition)
        .limit(1);

      if (!dbUser) {
        return token;
      }

      token.sub = dbUser.id;
      token.googleId = dbUser.googleId;
      token.s3Bucket = dbUser.s3Bucket;
      token.s3Region = dbUser.s3Region;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.googleId = (token.googleId as string | undefined) ?? null;
        session.user.s3Bucket = (token.s3Bucket as string | undefined) ?? null;
        session.user.s3Region = (token.s3Region as string | undefined) ?? null;
      }

      return session;
    },
  },
});

type RouteContext = {
  params: {
    nextauth: string[];
  };
};

const handler = (request: NextRequest, context: RouteContext) => {
  const authHandler = NextAuth(buildAuthOptions(request));
  return authHandler(request, context);
};

export { handler as GET, handler as POST };
