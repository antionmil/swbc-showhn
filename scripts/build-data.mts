/* Every number the site shows is produced here, from the monthly store, at
 * build time. Nothing is computed per request and there is no database.
 *
 * Outputs
 *   src/data/report.json   the aggregates and the chart series
 *   src/data/cells.json    posts and wins per title shape, for the checker
 *   src/data/winners.json  the posts that worked in the window, for examples
 *   src/data/words.json    word counts, so the page can pick a title's topic
 *   data/search.txt        one line per post, read by the topic API at runtime
 */
import { writeFileSync, statSync } from "node:fs";
import { FLAGS, WORKED, SANK, CELLS, cellIndex, shapeOf, bandOf, titleBody } from "../src/lib/flags.ts";
import { readAll, ensureDirs, SRC_DATA, DATA_DIR, PUB_DATA, type Post } from "./corpus.mts";

const DAY = 86400;
const now = Math.floor(Date.now() / 1000);
/* Points move for about a day after a post lands. Every RATE on the site is
 * measured on posts at least 48 hours old, or a quiet Tuesday would look like
 * a collapse in quality. The corpus COUNT still includes everything. */
const SETTLED = now - 2 * DAY;
const FROM = now - 365 * DAY;

ensureDirs();
const all = readAll();
const win = all.filter((p) => p.s >= FROM && p.s <= SETTLED);
const N = win.length;
const rate = (rows: Post[]) => (rows.length ? (100 * rows.filter((p) => p.p >= WORKED).length) / rows.length : 0);
const pct = (k: number, of: number) => (100 * k) / of;
const r2 = (x: number) => Math.round(x * 100) / 100;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/* ---------- cells: posts and wins per shape ---------- */
const cells: [number, number][] = Array.from({ length: CELLS }, () => [0, 0] as [number, number]);
for (const p of win) {
  const { flags, band } = shapeOf(p.t);
  const won = p.p >= WORKED ? 1 : 0;
  // every cell this post belongs to: each flag as itself or "not looked at",
  // and the band as itself or "not looked at" (2^6 * 2 = 128 cells)
  for (let mask = 0; mask < 64; mask++) {
    const trits = flags.map((v, i) => ((mask >> i) & 1 ? 2 : v ? 1 : 0));
    for (const b of [band, 3]) {
      const c = cells[cellIndex(trits, b)];
      c[0]++; c[1] += won;
    }
  }
}

/* ---------- per-flag headline numbers ---------- */
const flagStats = FLAGS.map((f, i) => {
  const yes = win.filter((p) => shapeOf(p.t).flags[i]);
  const no = win.filter((p) => !shapeOf(p.t).flags[i]);
  const ry = rate(yes) / 100, rn = rate(no) / 100;
  const pooled = (ry * yes.length + rn * no.length) / N;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / yes.length + 1 / no.length));
  return {
    key: f.key, label: f.label,
    n: yes.length, share: r2(pct(yes.length, N)),
    rate: r2(ry * 100), rateOther: r2(rn * 100),
    lift: r2(ry / rn), z: r2(se ? (ry - rn) / se : 0),
  };
});

/* ---------- series ---------- */
const hours = Array.from({ length: 24 }, (_, h) => {
  const rows = win.filter((p) => new Date(p.s * 1000).getUTCHours() === h);
  return { h, n: rows.length, rate: r2(rate(rows)) };
});
const weekdays = Array.from({ length: 7 }, (_, d) => {
  const rows = win.filter((p) => new Date(p.s * 1000).getUTCDay() === d);
  return { d, n: rows.length, rate: r2(rate(rows)) };
});
const lengths = [10, 20, 30, 40, 50, 60, 70, 80].map((lo) => {
  const rows = win.filter((p) => Math.min(Math.floor(p.t.length / 10) * 10, 80) === lo);
  return { lo, n: rows.length, share: r2(pct(rows.length, N)), rate: r2(rate(rows)) };
});
const aiIdx = FLAGS.findIndex((f) => f.key === "ai");
const years: { y: number; n: number; rate: number; ai: number; median: number }[] = [];
for (let y = new Date(all[0].s * 1000).getUTCFullYear(); y <= new Date().getUTCFullYear(); y++) {
  const rows = all.filter((p) => new Date(p.s * 1000).getUTCFullYear() === y && p.s <= SETTLED);
  if (!rows.length) continue;
  years.push({
    y, n: rows.length, rate: r2(rate(rows)),
    ai: r2(pct(rows.filter((p) => shapeOf(p.t).flags[aiIdx]).length, rows.length)),
    median: median(rows.map((p) => p.p)),
  });
}

/* ---------- words, so the page can name a title's topic ---------- */
const STOP = new Set(("show hn a an the and or for with without your you my our their that this these those " +
  "to of in on at by from into over under is are was were be been being it its as not no " +
  "new free open source app tool site web online simple easy fast best using use used make makes made " +
  "build built builds i we they he she what which who how why when where all any can could would should " +
  "just like more most less than then there here about across after before between during " +
  "get gets got let lets run runs running turn turns write writes written read reads").split(" "));
const wordCount = new Map<string, [number, number]>(); // word -> [posts, worked]
for (const p of win) {
  const seen = new Set<string>();
  for (const raw of titleBody(p.t).toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const w = raw.replace(/^[.+#]+|[.+#]+$/g, "");
    if (w.length < 3 || w.length > 20 || STOP.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
    seen.add(w);
    const e = wordCount.get(w) ?? [0, 0];
    e[0]++; if (p.p >= WORKED) e[1]++;
    wordCount.set(w, e);
  }
}
const words = [...wordCount.entries()]
  .filter(([, v]) => v[0] >= 12)
  .sort((a, b) => b[1][0] - a[1][0])
  .map(([w, v]) => [w, v[0], v[1]] as [string, number, number]);

/* ---------- artifacts ---------- */
const lastDay = all[all.length - 1].s;
const report = {
  built: new Date().toISOString(),
  corpus: {
    total: all.length,
    firstDay: new Date(all[0].s * 1000).toISOString().slice(0, 10),
    lastDay: new Date(lastDay * 1000).toISOString().slice(0, 10),
    week: all.filter((p) => p.s > now - 7 * DAY).length,
    month: all.filter((p) => p.s > now - 30 * DAY).length,
  },
  window: {
    from: new Date(FROM * 1000).toISOString().slice(0, 10),
    to: new Date(SETTLED * 1000).toISOString().slice(0, 10),
    n: N,
    base: r2(rate(win)),
    median: median(win.map((p) => p.p)),
    pctLE1: r2(pct(win.filter((p) => p.p <= 1).length, N)),
    pctNoComment: r2(pct(win.filter((p) => p.c === 0).length, N)),
    pct10: r2(pct(win.filter((p) => p.p >= 10).length, N)),
    pct100: r2(pct(win.filter((p) => p.p >= 100).length, N)),
    worked: win.filter((p) => p.p >= WORKED).length,
    sank: win.filter((p) => p.p <= SANK).length,
    WORKED, SANK,
  },
  hours, weekdays, lengths, years, flags: flagStats,
  best: hours.reduce((a, b) => (b.rate > a.rate ? b : a)),
  worst: hours.reduce((a, b) => (b.rate < a.rate ? b : a)),
  bestDay: weekdays.reduce((a, b) => (b.rate > a.rate ? b : a)),
  worstDay: weekdays.reduce((a, b) => (b.rate < a.rate ? b : a)),
  topAllTime: [...all].sort((a, b) => b.p - a.p).slice(0, 12),
  /* Three REAL titles for the "try one" row. Never an invented example: the
     whole site is an argument that these numbers are measured. */
  samples: [
    [...win].filter((p) => p.t.length < 30).sort((a, b) => b.p - a.p)[0],
    [...win].filter((p) => shapeOf(p.t).flags[aiIdx] && p.t.length >= 70 && p.p <= 2)
      .sort((a, b) => b.s - a.s)[0],
    [...win].filter((p) => !shapeOf(p.t).flags[aiIdx] && p.t.length >= 70 && p.p >= WORKED)
      .sort((a, b) => b.p - a.p)[0],
  ].filter(Boolean),
  /* Which SUBJECT worked, not which wording. Only words carried by enough
     posts to mean something; the cut is stated on the page. */
  league: (() => {
    const rows = words.filter(([, n]) => n >= 120).map(([w, n, k]) => ({ w, n, rate: r2((100 * k) / n) }));
    const sorted = [...rows].sort((a, b) => b.rate - a.rate);
    return { min: 120, best: sorted.slice(0, 8), worst: sorted.slice(-8).reverse() };
  })(),
  topics: ["terminal", "postgres", "chess", "resume", "browser", "game"],
  newest: [...all].filter((p) => p.s > now - 7 * DAY).sort((a, b) => b.p - a.p).slice(0, 8),
};

const winners = win.filter((p) => p.p >= WORKED).sort((a, b) => b.p - a.p);

writeFileSync(SRC_DATA + "report.json", JSON.stringify(report));
writeFileSync(SRC_DATA + "cells.json", JSON.stringify(cells));
writeFileSync(PUB_DATA + "winners.json", JSON.stringify(winners));
writeFileSync(PUB_DATA + "words.json", JSON.stringify(words));
writeFileSync(DATA_DIR + "search.txt", all.map((p) => `${p.i}\t${p.s}\t${p.p}\t${p.c}\t${p.t.replace(/[\t\n]/g, " ")}`).join("\n"));

const kb = (f: string, dir = SRC_DATA) => Math.round(statSync(dir + f).size / 1024);
console.log(`corpus ${all.length} posts, window ${N} settled posts, base ${report.window.base}% reached ${WORKED} points`);
console.log(`report.json ${kb("report.json")} KB · cells.json ${kb("cells.json")} KB · winners.json ${kb("winners.json", PUB_DATA)} KB (${winners.length}) · words.json ${kb("words.json", PUB_DATA)} KB (${words.length}) · search.txt ${kb("search.txt", DATA_DIR)} KB`);
