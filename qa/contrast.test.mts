import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Day 1 shipped white on white. Day 2 documented three ratios measured
 * against the page background when the text actually sits on a card. So this
 * reads the tokens out of globals.css and measures each pair against the
 * surface the text is really painted on, in BOTH schemes. */
const css = readFileSync("src/app/globals.css", "utf8");

function scheme(name: "light" | "dark"): Record<string, string> {
  const block = name === "light"
    ? css.slice(css.indexOf("@theme"), css.indexOf("@media"))
    : css.slice(css.indexOf(':root[data-theme="dark"]'));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}

const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const name of ["light", "dark"] as const) {
  const t = scheme(name);
  const white = "#ffffff";
  const pairs: [string, string, string, number][] = [
    ["body text on the page", t.ink, t.ground, 4.5],
    ["body text on a card", t.ink, t.surface, 4.5],
    ["muted text on the page", t.muted, t.ground, 4.5],
    ["muted text on a card", t.muted, t.surface, 4.5],
    ["accent text on the page", t.accent, t.ground, 4.5],
    ["accent text on a card", t.accent, t.surface, 4.5],
    ["green text on a card", t.green, t.surface, 4.5],
    ["button label on the accent fill", name === "light" ? white : t.ground, t.accent, 4.5],
  ];
  for (const [what, fg, bg, min] of pairs) {
    test(`${name}: ${what} is readable (${fg} on ${bg})`, () => {
      const r = ratio(fg, bg);
      assert.ok(r >= min, `${what} in ${name} is ${r.toFixed(2)}:1, under the ${min}:1 floor`);
    });
  }
}

test("every colour the page paints comes from a token", () => {
  const files = ["src/app/page.tsx", "src/components/Checker.tsx", "src/components/Report.tsx",
    "src/components/TopicPanel.tsx", "src/components/TopicSearch.tsx", "src/components/Bars.tsx"];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const hex = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hex, [], `${f} hardcodes ${hex.join(", ")} instead of using a theme token`);
    /* Tailwind's own scale always carries a number (text-green-600). The
       site's tokens never do (text-green). Only the numbered ones are the bug.
       text-white is allowed in exactly one place: the label on the accent
       fill, measured at 5.4:1 in the light scheme. */
    const tw = src.match(/\b(text|bg|border|decoration)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/g) ?? [];
    assert.deepEqual(tw, [], `${f} uses Tailwind's palette (${tw.join(", ")}) instead of the site's`);
    const plain = (src.match(/\b(text|bg|border)-(white|black)\b/g) ?? []).filter((c) => c !== "text-white");
    assert.deepEqual(plain, [], `${f} paints ${plain.join(", ")}, which has no dark-scheme counterpart`);
  }
});

test("no file types a number the corpus is supposed to supply", () => {
  // The share card shipped "208,287 Show HN posts" as a string literal. It was
  // stale the next night, in the one place nobody re-reads.
  for (const f of ["src/app/layout.tsx", "src/app/page.tsx", "src/components/Report.tsx",
    "src/components/Checker.tsx", "src/components/TopicPanel.tsx", "src/components/TopicSearch.tsx"]) {
    const src = readFileSync(f, "utf8");
    const typed = src.match(/\b\d{1,3},\d{3}\b/g) ?? [];
    assert.deepEqual(typed, [], `${f} hardcodes ${typed.join(", ")} — read it from report.json instead`);
  }
});
