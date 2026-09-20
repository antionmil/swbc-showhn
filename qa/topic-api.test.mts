import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GET } from "../src/app/api/topic/route.ts";

const call = (q: string) => GET(new Request(`https://x.test/api/topic?q=${encodeURIComponent(q)}`));
const lines = readFileSync("data/search.txt", "utf8").split("\n").filter(Boolean);

/* Fire at the guard, do not read it. */
test("the guard refuses what it says it refuses", async () => {
  for (const bad of ["", "a", " ", "!!", "  #  "]) {
    const res = await call(bad);
    assert.equal(res.status, 400, `"${bad}" should have been refused`);
    assert.equal((await res.json()).error, "short");
  }
});

test("a query is cut to 40 characters and four terms, and still answers", async () => {
  const res = await call("terminal ".repeat(12));
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.ok(d.q.length <= 40);
  assert.ok(d.n > 0);
});

test("the counts match the corpus, counted a different way", async () => {
  // Independent re-implementation of the rule the route uses: the term has to
  // start a word. Written as a regex here and as a space-prefixed substring
  // there, so a bug in one does not hide in the other.
  const startsAWord = /(^|[^a-z0-9+#.])terminal/;
  const title = (l: string) => {
    let i = -1;
    for (let k = 0; k < 4; k++) i = l.indexOf("\t", i + 1);
    return l.slice(i + 1).toLowerCase();
  };
  const mine = lines.filter((l) => startsAWord.test(title(l)));
  assert.equal(d_n(await (await call("terminal")).json()), mine.length, "the route and an independent scan must agree");
  const worked = mine.filter((l) => +l.split("\t")[2] >= 30).length;
  assert.equal((await (await call("terminal")).json()).worked, worked);
});

const d_n = (d: { n: number }) => d.n;

test("both columns come back, and they are the right way round", async () => {
  const d = await (await call("terminal")).json();
  assert.ok(d.topWorked.length > 0 && d.topSank.length > 0);
  assert.ok(d.topWorked.every((p: { p: number }) => p.p >= 30), "the worked column must all have worked");
  assert.ok(d.topSank.every((p: { p: number }) => p.p <= 2), "the sank column must all have sunk");
  assert.ok(d.topWorked[0].p >= d.topWorked[d.topWorked.length - 1].p, "worked is sorted by points");
});

test("a word nobody has posted about answers honestly rather than inventing a rate", async () => {
  const d = await (await call("zzzqqxq")).json();
  assert.equal(d.n, 0);
  assert.equal(d.rate, null);
  assert.deepEqual(d.topWorked, []);
});

test("the commonest word in the corpus does not blow up the route", async () => {
  // "app" matches tens of thousands of titles. Spreading that many arguments
  // into Math.min overflows the stack, so the busiest query is the one that
  // has to be attempted, not assumed.
  const res = await call("app");
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.ok(d.n > 5000, `expected a big match, got ${d.n}`);
  assert.equal(typeof d.first, "number");
  assert.ok(d.topWorked.length <= 5 && d.topSank.length <= 5, "the answer stays small however big the match");
});

test("the answer is cacheable, because it is the same for everyone", async () => {
  const res = await call("chess");
  // The lifetime lives on the CDN headers: Next rewrites cache-control on a
  // dynamic route and the edge cached nothing at all until this moved.
  assert.match(res.headers.get("vercel-cdn-cache-control") ?? "", /s-maxage=\d+/);
  assert.match(res.headers.get("cdn-cache-control") ?? "", /s-maxage=\d+/);
});

test("a word is matched at the start of a word, never inside one", () => {
  // Found in the audit: "seo" matched ExpenseOwl and Joseon, and the panel
  // said 406 posts where the tokenised league table said 122.
  return (async () => {
    const d = await (await call("seo")).json();
    const wrong = [...d.topWorked, ...d.topSank].filter(
      (p: { t: string }) => !/(^|[^a-z])seo/i.test(p.t),
    );
    assert.deepEqual(wrong.map((p: { t: string }) => p.t), [], "these matched inside another word");
    assert.ok(d.n < 406, `the inflated substring count was 406, got ${d.n}`);
  })();
});

test("plurals and compounds that start with the word still match", async () => {
  const d = await (await call("terminal")).json();
  const titles = [...d.topWorked, ...d.topSank].map((p: { t: string }) => p.t.toLowerCase());
  assert.ok(titles.length > 0);
  assert.ok(titles.every((t: string) => /(^|[^a-z])terminal/.test(t)), "every hit starts the word 'terminal'");
  const pg = await (await call("postgres")).json();
  assert.ok(pg.n > 200, `postgres should still find postgresql titles, got ${pg.n}`);
});
