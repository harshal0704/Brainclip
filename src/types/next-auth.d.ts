import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      googleId: string | null;
      s3Bucket: string | null;
      s3Region: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string | null;
    s3Bucket?: string | null;
    s3Region?: string | null;
  }
}
