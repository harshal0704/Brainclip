import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/voices/:path*",
    "/settings/:path*",
    "/api/jobs/:path*",
    "/api/drafts/:path*",
  ],
};
