import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import "./landing.css";
import { Providers } from "./providers";

const headlineFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Brainclip — Turn Any Idea Into Addictive Reels",
  description: "Type an idea, pick a format, choose AI voices, and get a polished short-form reel in minutes. No editing skills needed.",
  verification: {
    google: "vPdZ1rzMuka8gCZFKRMek5HX04b9Eu4VWJv7tSzcyQg",
  },
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${headlineFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
