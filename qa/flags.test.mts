import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAGS, bandOf, describe, prefixAdded, shapeOf, titleBody, titleLength, resolve, cellIndex, MIN_N, IGNORED, type Cell } from "../src/lib/flags.ts";
import cells from "../src/data/cells.json" with { type: "json" };

const flag = (key: string) => FLAGS.findIndex((f) => f.key === key);
const has = (title: string, key: string) => shapeOf(title).flags[flag(key)];

test("the Show HN prefix is stripped, in every form it is written", () => {
  assert.equal(titleBody("Show HN: Elevators"), "Elevators");
  assert.equal(titleBody("Show HN – Elevators"), "Elevators");
  assert.equal(titleBody("show hn: elevators"), "elevators");
  assert.equal(titleBody("ShowHN: Elevators"), "Elevators");
  assert.equal(titleBody("Elevators"), "Elevators");
});

test("the prefix cannot make a flag fire by itself", () => {
  // "Show HN" contains no flag words, but a naive test on the whole title
  // would still be wrong the day a flag matches "show" or "hn".
  assert.equal(shapeOf("Show HN: Elevators").flags.some(Boolean), false);
});

test("AI fires on the words it claims, and not inside other words", () => {
  assert.ok(has("Show HN: An AI that writes tests", "ai"));
  assert.ok(has("Show HN: A tiny LLM on a phone", "ai"));
  assert.ok(has("Show HN: My coding agent", "ai"));
  assert.ok(!has("Show HN: A chain of custody tool", "ai"), "'chain' must not match 'ai'");
  assert.ok(!has("Show HN: Plaid alternative", "ai"), "'Plaid' must not match 'ai'");
  assert.ok(!has("Show HN: Email client for Maildir", "ai"), "'Maildir' must not match 'ai'");
});

test("a language name is a language, not a common word", () => {
  assert.ok(has("Show HN: A parser in Rust", "lang"));
  assert.ok(has("Show HN: Python bindings for libfoo", "lang"));
  assert.ok(has("Show HN: Go library for X", "lang"), "Go is a language and must count");
  assert.ok(!has("Show HN: A budgeting app", "lang"), "no language named, no flag");
  assert.ok(!has("Show HN: Rusty pipes, a plumbing sim", "lang"), "'Rusty' is not Rust");
});

test("'I built' fires on the forms people write, not on 'It'", () => {
  assert.ok(has("Show HN: I built a synth for my daughter", "person"));
  assert.ok(has("Show HN: I made an open-source laptop", "person"));
  assert.ok(has("Show HN: I'm releasing my notes app", "person"));
  assert.ok(!has("Show HN: It builds itself", "person"));
});

test("length bands split where they say they do, on the title as Hacker News shows it", () => {
  // The prefix is nine characters and counts, so the bands are checked on the
  // whole thing — typed with the prefix or not, which must not matter.
  const full = (n: number) => "Show HN: " + "x".repeat(n - 9);
  assert.equal(bandOf(full(49)), 0);
  assert.equal(bandOf(full(50)), 1);
  assert.equal(bandOf(full(69)), 1);
  assert.equal(bandOf(full(70)), 2);
  assert.equal(bandOf("x".repeat(40)), 0, "40 + 9 = 49, still under 50");
  assert.equal(bandOf("x".repeat(41)), 1, "41 + 9 = 50, the band above");
  assert.equal(bandOf("x".repeat(61)), 2, "61 + 9 = 70");
});

/* ---- the cell table ---- */
const C = cells as Cell[];
const ALL = cellIndex([IGNORED, IGNORED, IGNORED, IGNORED, IGNORED, IGNORED], 3);

test("the table's totals are the corpus totals", async () => {
  const report = (await import("../src/data/report.json", { with: { type: "json" } })).default;
  assert.equal(C[ALL][0], report.window.n, "the all-ignored cell must hold every post in the window");
  assert.equal(C[ALL][1], report.window.worked, "and every post that worked");
});

test("a cell never holds more wins than posts, anywhere", () => {
  for (let i = 0; i < C.length; i++) assert.ok(C[i][1] <= C[i][0], `cell ${i} has more wins than posts`);
});

test("splitting a flag conserves the count", () => {
  for (let f = 0; f < FLAGS.length; f++) {
    const base = Array(FLAGS.length).fill(IGNORED);
    const yes = [...base]; yes[f] = 1;
    const no = [...base]; no[f] = 0;
    assert.equal(
      C[cellIndex(yes, 3)][0] + C[cellIndex(no, 3)][0], C[ALL][0],
      `flag ${FLAGS[f].key}: present + absent must equal every post`,
    );
  }
});

test("the back-off always lands on a group big enough to quote", () => {
  const titles = [
    "Show HN: Elevators",
    "Show HN: I built an open-source AI agent in Rust with 3 free tools and no signup at all",
    "Show HN: A free AI SEO agent that writes 100 open-source posts, built in Python, no account",
    "Show HN: Chess",
    "Show HN: My weekend project",
  ];
  for (const t of titles) {
    const r = resolve(C, shapeOf(t));
    assert.ok(r.n >= MIN_N, `"${t}" resolved to a group of ${r.n}, under the ${MIN_N} floor`);
    assert.ok(r.worked <= r.n);
  }
});

test("the back-off keeps the strongest signal and drops the weakest first", () => {
  // A title carrying every flag cannot be counted as-is; "ai" must survive.
  const loaded = "Show HN: I built a free open-source AI agent in Rust with 12 tools and no signup whatsoever";
  const r = resolve(C, shapeOf(loaded));
  assert.ok(r.kept.includes("ai"), "the flag with the largest effect must never be dropped");
  assert.ok(!r.kept.includes("person"), "the weakest flag should go first");
});

test("a group is described by what it IS, absent flags included", () => {
  // The bug this catches shipped live: a flag kept as ABSENT was printed in
  // the positive, so a group with no number in it read "has a number in it".
  const line = describe(["ai", "number", "lang"], [true, false, false, false, false, false], 2);
  assert.match(line, /say AI, LLM, GPT or agent/);
  assert.match(line, /contain no number/);
  assert.match(line, /name no language/);
  assert.ok(!/contain a number/.test(line), `"${line}" claims a number the group does not have`);
  assert.match(line, /70 characters or more/);
});

test("describing nothing at all still reads as a sentence", () => {
  assert.equal(describe([], [false, false, false, false, false, false], null), "every Show HN post of the past year");
});

test("a title measures the same whether or not the person typed the prefix", () => {
  // The placeholder used to read "Show HN: ..." and taught people to include
  // it. It now reads "Write the title you are about to post", so most people
  // will not — and nine characters is enough to move a title into a different
  // length band and quote the rate of a group it is not in.
  const bare = "A tiny Rust parser for 3 config formats";
  const full = `Show HN: ${bare}`;
  assert.equal(titleLength(bare), titleLength(full));
  assert.equal(titleLength(full), full.length);
  assert.deepEqual(shapeOf(bare), shapeOf(full));
  assert.equal(bandOf(bare), bandOf(full));
});

test("the page knows when it added the prefix itself", () => {
  assert.equal(prefixAdded("A tiny parser"), true);
  assert.equal(prefixAdded("Show HN: A tiny parser"), false);
  assert.equal(prefixAdded("show hn – A tiny parser"), false);
  assert.equal(prefixAdded("  Show HN: A tiny parser"), false);
});

test("a 71-character body is over the limit once the prefix is counted", () => {
  // 71 + 9 = 80 exactly, which fits; 72 + 9 does not. Hacker News counts the
  // prefix against its own limit, so the page has to as well.
  assert.equal(titleLength("x".repeat(71)), 80);
  assert.equal(titleLength("x".repeat(72)), 81);
});
