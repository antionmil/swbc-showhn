import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import report from "@/data/report.json";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono-plex", display: "swap" });

const SITE = "https://showhn.onedaybuilt.com";
const TITLE = "Show HN, what actually got attention";
/* Built from the corpus, never typed. A hardcoded total shipped once and was
 * stale the next night, in the one place nobody re-reads: the share card. */
const DESC =
  `Every Show HN post on Hacker News since 2011 \u2014 all ${report.corpus.total.toLocaleString("en-US")} of them, measured. ` +
  `${Math.round(100 - report.window.base)} in 100 are never seen. Paste the title you are about to use and see ` +
  "what happened to the posts shaped like it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: SITE, siteName: TITLE, type: "website", images: ["/api/og"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/api/og"] },
  /* The upvote arrow, in src/app/icon.svg. */
  icons: { icon: "/icon.svg" },
};

/* Paper in light, ink in dark: the browser chrome on a phone matches the page
   instead of framing it in white. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14110e" },
  ],
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
