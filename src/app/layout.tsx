import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import report from "@/data/report.json";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono-plex", display: "swap" });

const SITE = "https://showhn.onedaybuilt.com";
const TITLE = "Show HN, what actually worked";
/* Built from the corpus, never typed. A hardcoded total shipped once and was
 * stale the next night, in the one place nobody re-reads: the share card. */
const DESC =
  `${Math.round(100 - report.window.base)} in 100 sink. On Hacker News there is a section called Show HN, where ` +
  `people post the thing they built \u2014 all ${report.corpus.total.toLocaleString("en-US")} of them since 2011, measured. ` +
  "Paste the title you are about to use and see what happened to the posts shaped like it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: SITE, siteName: TITLE, type: "website", images: ["/api/og"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/api/og"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plex.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
