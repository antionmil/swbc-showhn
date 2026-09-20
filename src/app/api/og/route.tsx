import { ImageResponse } from "next/og";
import report from "@/data/report.json";

export const runtime = "nodejs";

/**
 * THE FONT TRAP (kept from the scaffold, because it costs an hour every time
 * it is forgotten). ImageResponse needs real font bytes — it cannot use a CSS
 * font-family, and a missing font falls back to something that looks nothing
 * like the site. Google's CSS endpoint returns a stylesheet, not a font, so
 * the src URL is parsed out of it first, and a modern User-Agent gets woff2,
 * which ImageResponse cannot read.
 */
const cache = new Map<string, ArrayBuffer | null>();

async function font(weight: number): Promise<ArrayBuffer | null> {
  const key = `inter-${weight}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SWBC/1.0)" },
      })
    ).text();
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    const data = url ? await (await fetch(url)).arrayBuffer() : null;
    cache.set(key, data);
    return data;
  } catch {
    cache.set(key, null);
    return null; // never let a font failure take down the image
  }
}

const n0 = (x: number) => x.toLocaleString("en-US");
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const spell = (n: number) => (n >= 0 && n <= 10 ? WORDS[n] : String(n));

export async function GET() {
  const [bold, regular] = await Promise.all([font(700), font(400)]);
  const ai = report.flags.find((f) => f.key === "ai")!;
  const fonts = [
    ...(bold ? [{ name: "Inter", data: bold, style: "normal" as const, weight: 700 as const }] : []),
    ...(regular ? [{ name: "Inter", data: regular, style: "normal" as const, weight: 400 as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%", width: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: "#FAF7F2", color: "#17130F",
          padding: "70px 76px", fontFamily: fonts.length ? "Inter" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 25 }}>
          <div style={{ display: "flex", fontWeight: 700 }}>
            Show HN <span style={{ color: "#C6350B", marginLeft: 10 }}>/ what actually worked</span>
          </div>
          <div style={{ display: "flex", color: "#6B625A" }}>{n0(report.corpus.total)} posts since 2011</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
            {Math.round(100 - report.window.base)} in 100 sink.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#6B625A", maxWidth: 900, lineHeight: 1.35 }}>
            On Hacker News there is a section called Show HN, where people post the thing they built.
            {" "}{spell(Math.round(report.window.base))[0].toUpperCase() + spell(Math.round(report.window.base)).slice(1)} posts in a hundred are ever really seen.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 54 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: "#C6350B", letterSpacing: "-0.03em" }}>
              {ai.share.toFixed(0)}%
            </div>
            <div style={{ display: "flex", fontSize: 25, color: "#6B625A", maxWidth: 330 }}>of titles now say AI</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 700, letterSpacing: "-0.03em" }}>
              {ai.rate.toFixed(1)}%
            </div>
            <div style={{ display: "flex", fontSize: 25, color: "#6B625A", maxWidth: 380 }}>
              of those reach {report.window.WORKED} upvotes, against {ai.rateOther.toFixed(1)}% for the rest
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      /* The card changes once a night at most, and every render fetches a font
         from Google. Uncached, each social scrape paid for that. The lifetime
         goes on the CDN headers because Next rewrites cache-control here too. */
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
        "cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "vercel-cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
