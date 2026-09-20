/* What a Show HN title IS, reduced to six yes/no facts and one length band.
 *
 * This file is the contract between the build script and the browser. The
 * build counts every post in the corpus into cells keyed by these flags; the
 * browser computes the same flags for the title you paste and reads the cell.
 * If the two ever disagree, the site quotes a rate for a group the visitor is
 * not in — so both sides import THIS file and nothing else.
 *
 * Flags are ordered by how strongly they separate outcomes in the corpus
 * (highest |z| first). The back-off drops the weakest one first. */

export type FlagKey = "ai" | "number" | "lang" | "free" | "oss" | "person";

export const FLAGS: { key: FlagKey; label: string; on: string; off: string; yes: string; no: string; test: (body: string, title: string) => boolean }[] = [
  {
    key: "ai",
    yes: "say AI, LLM, GPT or agent",
    no: "say none of AI, LLM, GPT or agent",
    on: "with the AI wording in it",
    off: "with no AI, LLM, GPT or agent in it",
    label: "says AI, LLM, GPT or agent",
    test: (b) => /\b(ai|llm|gpt|agent|agents|chatgpt|claude)\b/i.test(b),
  },
  {
    key: "number",
    yes: "contain a number",
    no: "contain no number",
    on: "with a number in the title",
    off: "with no number in it",
    label: "has a number in it",
    test: (b) => /\d/.test(b),
  },
  {
    key: "lang",
    yes: "name a programming language",
    no: "name no language",
    on: "naming a programming language",
    off: "naming no language",
    label: "names a programming language",
    test: (b) => /\b(rust|python|go|golang|typescript|javascript|c\+\+|zig|elixir|haskell|swift|kotlin|ruby|java|lua|ocaml|clojure)\b/i.test(b),
  },
  {
    key: "free",
    yes: "say free or no signup",
    no: "never say free",
    on: "saying free, or no signup",
    off: "not saying free",
    label: "says free, or no signup",
    test: (b) => /\b(free|no sign ?-?up|no signup|no account)\b/i.test(b),
  },
  {
    key: "oss",
    yes: "say open source",
    no: "never say open source",
    on: "saying open source",
    off: "not saying open source",
    label: "says open source",
    test: (b) => /open[- ]source/i.test(b),
  },
  {
    key: "person",
    yes: "say I built it",
    no: "never say who built it",
    on: "saying you built it yourself",
    off: "not saying who built it",
    label: "says I built it",
    test: (b) => /\bI (built|made|created|wrote|coded|hacked)\b/i.test(b) || /^i(\s|')/i.test(b),
  },
];

/** Length bands, measured on the WHOLE title including the "Show HN: " prefix,
 *  because that is what a reader sees on the front page. */
export const BANDS = [
  { key: 0, label: "under 50 characters", short: "under 50" },
  { key: 1, label: "50 to 69 characters", short: "50–69" },
  { key: 2, label: "70 characters or more", short: "70+" },
] as const;

/** HN's own submit form stops at 80 characters. */
export const MAX_TITLE = 80;

/** Strip the "Show HN:" prefix. Everything is tested against what is left, so
 *  the word "show" in the prefix never counts as part of the title. */
export function titleBody(title: string): string {
  return title.replace(/^\s*show\s*[hn]{2}\s*[:\-–—]\s*/i, "").trim();
}

export const PREFIX = "Show HN: ";

/** Every title in the corpus carries the "Show HN: " prefix, because Hacker
 *  News shows it and its 80-character limit counts it. Somebody typing into
 *  this page may or may not include it, and the difference is nine
 *  characters — enough to move a title into a different length band and quote
 *  a rate for the wrong group. So the length is always measured on the title
 *  as Hacker News would show it. */
export function normalise(input: string): string {
  return PREFIX + titleBody(input);
}

/** true when the visitor did not type the prefix and this page added it. */
export function prefixAdded(input: string): boolean {
  return !/^\s*show\s*[hn]{2}\s*[:\-–—]/i.test(input);
}

export function bandOf(title: string): 0 | 1 | 2 {
  const n = normalise(title).length;
  return n < 50 ? 0 : n < 70 ? 1 : 2;
}

/** How to SAY what a resolved group is. A flag kept as ABSENT still describes
 *  the group, and describing it in the positive ("has a number in it") names a
 *  group the visitor is not in. It shipped that way for one deploy. */
export function describe(kept: FlagKey[], flags: boolean[], band: 0 | 1 | 2 | null): string {
  const parts = kept.map((k) => {
    const i = FLAGS.findIndex((f) => f.key === k);
    return flags[i] ? FLAGS[i].yes : FLAGS[i].no;
  });
  if (band !== null) parts.push(`run to ${BANDS[band].label}`);
  if (!parts.length) return "every Show HN post of the past year";
  const last = parts.pop()!;
  return `titles that ${parts.length ? `${parts.join(", ")} and ${last}` : last}`;
}

/** The concrete shape of one title: six booleans and a band. */
export function shapeOf(title: string): { flags: boolean[]; band: 0 | 1 | 2 } {
  const body = titleBody(title);
  return { flags: FLAGS.map((f) => f.test(body, title)), band: bandOf(title) };
}

/** The length the page reports and checks against Hacker News's limit. */
export const titleLength = (input: string) => normalise(input).length;

/* ---------- cell addressing ----------
 * Each flag is a trit: 0 absent, 1 present, 2 not looked at.
 * The band is 0/1/2, or 3 for not looked at.
 * A cell holds [how many posts, how many reached WORKED points]. */

export const IGNORED = 2;
export const BAND_ANY = 3;
export const CELLS = 4 * 3 ** 6; // 2916

export function cellIndex(trits: number[], band: number): number {
  let k = 0;
  for (let i = FLAGS.length - 1; i >= 0; i--) k = k * 3 + trits[i];
  return band * 3 ** 6 + k;
}

/** 30 points or more: the top 4% of Show HN. */
export const WORKED = 30;
/** Two points or fewer: posted, and nothing happened. */
export const SANK = 2;
/** Below this many posts a rate is noise, so the back-off widens the group. */
export const MIN_N = 200;

export type Cell = [n: number, worked: number];

/** Walk from the exact shape outwards until the group is big enough to quote.
 *  Drops the weakest flag first, the band next to last, and never drops the
 *  strongest signal in the corpus. Returns which flags survived. */
export function resolve(
  cells: Cell[],
  shape: { flags: boolean[]; band: 0 | 1 | 2 },
): { index: number; n: number; worked: number; kept: FlagKey[]; bandKept: boolean } {
  const trits: number[] = shape.flags.map((v) => (v ? 1 : 0));
  let band: number = shape.band;
  // weakest first, then the band; "ai" is index 0 and is never dropped
  const order: number[] = [5, 4, 3, 2, 1, -1];
  for (let step = 0; ; step++) {
    const index = cellIndex(trits, band);
    const [n, worked] = cells[index] ?? [0, 0];
    const kept = FLAGS.filter((_, i) => trits[i] !== IGNORED).map((f) => f.key);
    if (n >= MIN_N || step >= order.length) return { index, n, worked, kept, bandKept: band !== BAND_ANY };
    const drop = order[step];
    if (drop === -1) band = BAND_ANY;
    else trits[drop] = IGNORED;
  }
}
