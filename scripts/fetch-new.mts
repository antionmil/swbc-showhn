/* The nightly job. It does two things:
 *   1. adds every Show HN posted since the newest one in the store
 *   2. re-reads the last 8 days, because points keep moving for about a day
 *      and a post fetched an hour after it landed is recorded at nearly zero
 *
 * Two traps, both met during prep and both still live:
 *   - Always date-bound the query. An unbounded one returns a garbage nbHits.
 *   - Algolia will not return more than ~1000 hits for one query whatever
 *     nbPages claims, so any window over the cap is split until it fits.
 */
import { writeFileSync } from "node:fs";
import { DATA_DIR, monthFiles, monthKey, readMonth, type Post } from "./corpus.mts";

const API = "https://hn.algolia.com/api/v1/search";
const CAP = 950;
const UA = { "User-Agent": "showhn.onedaybuilt.com nightly refresh (one post per day, contact via the site)" };

async function q(params: Record<string, string | number>): Promise<{ hits: RawHit[]; nbHits: number; nbPages: number }> {
  const url = `${API}?${new URLSearchParams(params as Record<string, string>)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

type RawHit = { objectID: string; title: string | null; points: number | null; num_comments: number | null; created_at_i: number };

async function window_(from: number, to: number, depth = 0): Promise<RawHit[]> {
  const nf = `created_at_i>${from},created_at_i<${to}`;
  const head = await q({ tags: "show_hn", numericFilters: nf, hitsPerPage: 1 });
  if (head.nbHits === 0) return [];
  if (head.nbHits > CAP && depth < 12) {
    const mid = Math.floor((from + to) / 2);
    return [...(await window_(from, mid, depth + 1)), ...(await window_(mid, to, depth + 1))];
  }
  const out: RawHit[] = [];
  for (let page = 0; ; page++) {
    const d = await q({ tags: "show_hn", numericFilters: nf, hitsPerPage: 1000, page });
    out.push(...d.hits);
    if (page + 1 >= (d.nbPages || 1)) break;
  }
  return out;
}

const before = monthFiles().flatMap(readMonth);
/* Math.max(...200k) overflows the call stack. It did, here, on the first run. */
let newest = 0;
for (const p of before) if (p.s > newest) newest = p.s;
const now = Math.floor(Date.now() / 1000);
const from = Math.min(newest, now - 8 * 86400) - 60;

console.log(`store: ${before.length} posts, newest ${new Date(newest * 1000).toISOString()}`);
console.log(`fetching from ${new Date(from * 1000).toISOString()} to now`);

const hits = await window_(from, now + 60);
console.log(`api returned ${hits.length} posts`);

/* The guard. An empty or tiny answer means the API changed, throttled us or
 * broke — not that Hacker News stopped posting. Writing that would delete the
 * most recent month. Exit 0 either way: a job that cannot fix anything must
 * not page anyone at 04:00. */
const expected = Math.max(3, Math.floor((now - from) / 86400) * 20);
if (hits.length < expected) {
  console.log(`REFUSED: expected at least ${expected} posts over that window, got ${hits.length}. Nothing written.`);
  process.exit(0);
}

const byId = new Map(before.map((p) => [p.i, p]));
let added = 0, updated = 0;
for (const h of hits) {
  if (!h.title || !h.created_at_i) continue;
  const row: Post = { i: h.objectID, t: h.title, p: h.points ?? 0, c: h.num_comments ?? 0, s: h.created_at_i };
  const old = byId.get(row.i);
  if (!old) { byId.set(row.i, row); added++; }
  else if (old.p !== row.p || old.c !== row.c || old.t !== row.t) { byId.set(row.i, row); updated++; }
}

if (byId.size < before.length) {
  console.log(`REFUSED: the store would shrink from ${before.length} to ${byId.size}. Nothing written.`);
  process.exit(1);
}

const months = new Map<string, Post[]>();
for (const p of byId.values()) {
  const k = monthKey(p.s);
  if (!months.has(k)) months.set(k, []);
  months.get(k)!.push(p);
}
let files = 0;
for (const [k, rows] of months) {
  rows.sort((a, b) => a.s - b.s);
  const next = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const path = `${DATA_DIR}${k}.jsonl`;
  let current = "";
  try { current = (await import("node:fs")).readFileSync(path, "utf8"); } catch { /* new month */ }
  if (current !== next) { writeFileSync(path, next); files++; }
}

console.log(`${added} new, ${updated} updated, ${files} monthly files rewritten, ${byId.size} posts in the store`);
