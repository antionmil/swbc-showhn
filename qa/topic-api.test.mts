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
  const d = await (await call("terminal")).json();
  const mine = lines.filter((l) => l.slice(l.indexOf("\t", l.indexOf("\t", l.indexOf("\t", l.indexOf("\t") + 1) + 1) + 1) + 1).toLowerCase().includes("terminal"));
  assert.equal(d.n, mine.length, "the route and a plain scan must agree");
  const worked = mine.filter((l) => +l.split("\t")[2] >= 30).length;
  assert.equal(d.worked, worked);
});

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
  assert.match(res.headers.get("cache-control") ?? "", /s-maxage=\d+/);
});
