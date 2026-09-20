/* The only server function on this site. It answers "what happened to the
 * other posts about X" over the whole corpus — winners AND the ones that
 * sank, which is the half nobody shows you.
 *
 * The corpus is a 17 MB text file built at deploy time and read once per
 * instance. There is no database, so there is no quota to run into and no
 * cold Neon connection to wait for. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { WORKED, SANK } from "@/lib/flags";
import report from "@/data/report.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { i: string; s: number; p: number; c: number; t: string };

let LINES: string[] | null = null;
let LOWER: string[] | null = null;

/* Each title is reduced to its words, separated and surrounded by single
 * spaces, so a search for " seo" can only start at a word.
 *
 * A plain substring match found "seo" inside ExpenseOwl and Joseon, and
 * reported 406 posts about SEO where the tokenised word count says 122. The
 * leading space makes the match start at a word; leaving the END open keeps
 * plurals and compounds that begin with the word, so "terminal" still finds
 * terminals and "postgres" still finds postgresql. */
function words(title: string): string {
  return " " + title.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim() + " ";
}

function titleOf(line: string): string {
  let i = -1;
  for (let k = 0; k < 4; k++) i = line.indexOf("\t", i + 1);
  return line.slice(i + 1);
}

function load() {
  if (LINES && LOWER) return { LINES, LOWER };
  const file = path.join(process.cwd(), "data", "search.txt");
  LINES = readFileSync(file, "utf8").split("\n").filter(Boolean);
  LOWER = LINES.map((l) => words(titleOf(l)));
  return { LINES, LOWER };
}

function parse(line: string): Row {
  const [i, s, p, c, ...rest] = line.split("\t");
  return { i, s: +s, p: +p, c: +c, t: rest.join("\t") };
}

const trim = (r: Row) => ({ i: r.i, t: r.t, p: r.p, c: r.c, s: r.s });

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("q") ?? "";
  const q = raw.toLowerCase().replace(/[^\p{L}\p{N}+#. -]/gu, " ").trim().slice(0, 40);
  if (q.length < 2) return Response.json({ error: "short" }, { status: 400 });

  const terms = q.split(/\s+/).map((t) => t.replace(/[^a-z0-9+#.]/g, "")).filter((t) => t.length >= 2).slice(0, 4);
  if (!terms.length) return Response.json({ error: "short" }, { status: 400 });

  const { LINES: lines, LOWER: lower } = load();
  const hits: Row[] = [];
  for (let k = 0; k < lower.length; k++) {
    const t = lower[k];
    let ok = true;
    for (const term of terms) if (!t.includes(" " + term)) { ok = false; break; }
    if (ok) hits.push(parse(lines[k]));
  }

  const worked = hits.filter((r) => r.p >= WORKED).sort((a, b) => b.p - a.p);
  const sank = hits.filter((r) => r.p <= SANK).sort((a, b) => b.s - a.s);
  const settled = hits.filter((r) => r.s <= Date.now() / 1000 - 2 * 86400);

  return Response.json(
    {
      q,
      n: hits.length,
      settled: settled.length,
      worked: worked.length,
      sank: sank.length,
      rate: settled.length ? Math.round((1000 * settled.filter((r) => r.p >= WORKED).length) / settled.length) / 10 : null,
      base: report.window.base,
      topWorked: worked.slice(0, 5).map(trim),
      topSank: sank.slice(0, 5).map(trim),
      // a loop, not Math.min(...hits): a common word matches tens of
      // thousands of posts and spreading that many arguments overflows the
      // call stack — which is a 500 on the one query most likely to be tried
      first: hits.reduce<number | null>((m, r) => (m === null || r.s < m ? r.s : m), null),
    },
    {
      /* Next strips s-maxage from cache-control on a dynamic route handler —
       * the header went out as a bare "public" and every repeat search was a
       * MISS on the edge. Vercel's own CDN headers are not rewritten, so the
       * lifetime goes there. The answer is identical for everyone, so a day
       * at the edge costs nothing and saves the function. */
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
        "cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "vercel-cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
