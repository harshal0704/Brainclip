import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Brainclip",
  description: "Sign in to Brainclip to create AI-powered dual-voice video reels",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
