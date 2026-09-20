"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BANDS, FLAGS, MAX_TITLE, WORKED, bandOf, cellIndex, describe, resolve, shapeOf, titleBody, type Cell } from "@/lib/flags";
import cellsRaw from "@/data/cells.json";
import report from "@/data/report.json";
import TopicPanel from "./TopicPanel";

const cells = cellsRaw as Cell[];
const pc = (x: number) => `${x.toFixed(1)}%`;
const n0 = (x: number) => x.toLocaleString("en-US");

export type Winner = { i: string; t: string; p: number; c: number; s: number };

/* The examples and the topic picker are 240 KB between them and only matter
 * once somebody checks a title. They load on first focus, so the page itself
 * stays small. */
let winnersCache: Winner[] | null = null;
let wordsCache: [string, number, number][] | null = null;
async function warm() {
  if (!winnersCache) winnersCache = await fetch("/data/winners.json").then((r) => r.json()).catch(() => []);
  if (!wordsCache) wordsCache = await fetch("/data/words.json").then((r) => r.json()).catch(() => []);
}

/** The most specific word of the title that the corpus knows about. "tool"
 *  and "app" are everywhere, so the rarest known word is the useful one. */
function topicOf(title: string, words: [string, number, number][] | null): string | null {
  if (!words) return null;
  const known = new Map(words.map(([w, n]) => [w, n]));
  let best: string | null = null;
  let bestN = Infinity;
  for (const raw of titleBody(title).toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const w = raw.replace(/^[.+#]+|[.+#]+$/g, "");
    // "automatically" is not what a post is ABOUT. Adverbs out.
    if (w.endsWith("ly")) continue;
    const n = known.get(w);
    if (n && n < bestN) { best = w; bestN = n; }
  }
  return best;
}

export default function Checker({ examples }: { examples: string[] }) {
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const out = useRef<HTMLDivElement>(null);

  // A shared link brings its title with it.
  useEffect(() => {
    warm().then(() => setReady(true));
    const t = new URLSearchParams(window.location.search).get("t");
    if (t) { setTitle(t.slice(0, 120)); setChecked(t.slice(0, 120)); }
  }, []);

  const [tooShort, setTooShort] = useState(false);

  const submit = useCallback((value: string) => {
    const v = value.trim();
    if (v.length < 8) { setTooShort(true); setChecked(null); return; }
    setTooShort(false);
    setChecked(v);
    const url = new URL(window.location.href);
    url.searchParams.set("t", v);
    window.history.replaceState(null, "", url);
    requestAnimationFrame(() => out.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(title); }}
        className="mt-7 flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => warm().then(() => setReady(true))}
          placeholder="Show HN: the title you are about to post"
          aria-label="The Show HN title you are about to post"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-4 py-3.5 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-6 py-3.5 font-semibold text-white transition-transform active:scale-[.98] dark:text-ground"
        >
          Check it
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13.5px] text-muted">
        <span>Or try one that was really posted:</span>
        {examples.map((e) => (
          <button
            key={e}
            onClick={() => { setTitle(e); submit(e); }}
            className="max-w-full truncate text-left text-accent underline decoration-rule underline-offset-2 hover:decoration-accent"
          >
            {e.length > 46 ? e.slice(0, 44) + "…" : e}
          </button>
        ))}
      </div>

      <div ref={out} className="scroll-mt-6">
        {tooShort && (
          <p className="mt-6 rounded-xl border border-rule bg-surface px-4 py-3 text-[14.5px] text-muted">
            That is too short to look up. Paste the whole title, the way you would post it.
          </p>
        )}
        {checked && <Verdict title={checked} ready={ready} />}
      </div>
    </div>
  );
}

function Verdict({ title, ready }: { title: string; ready: boolean }) {
  const shape = useMemo(() => shapeOf(title), [title]);
  const res = useMemo(() => resolve(cells, shape), [shape]);
  const base = report.window.base;
  const rate = res.n ? (100 * res.worked) / res.n : 0;
  const band = bandOf(title);

  /* What the same title looks like with one thing changed. Every one of these
   * is a real group of real posts, counted — not a prediction. */
  const swaps = useMemo(() => {
    const out: { label: string; rate: number; n: number; up: boolean }[] = [];
    for (let i = 0; i < FLAGS.length; i++) {
      const trits: number[] = shape.flags.map((v) => (v ? 1 : 0));
      trits[i] = shape.flags[i] ? 0 : 1;
      const [n, w] = cells[cellIndex(trits, shape.band)] ?? [0, 0];
      if (n < 200) continue;
      const r = (100 * w) / n;
      out.push({ label: shape.flags[i] ? FLAGS[i].off : FLAGS[i].on, rate: r, n, up: r > rate });
    }
    if (band === 2) {
      const trits: number[] = shape.flags.map((v) => (v ? 1 : 0));
      const [n, w] = cells[cellIndex(trits, 0)] ?? [0, 0];
      if (n >= 200) out.push({ label: "cut under 50 characters", rate: (100 * w) / n, n, up: (100 * w) / n > rate });
    }
    return out.sort((a, b) => b.rate - a.rate).slice(0, 3);
  }, [shape, rate, band]);

  const winners = (winnersCache ?? []).filter((p) => {
    const s = shapeOf(p.t);
    if (res.bandKept && s.band !== shape.band) return false;
    return res.kept.every((k) => {
      const i = FLAGS.findIndex((f) => f.key === k);
      return s.flags[i] === shape.flags[i];
    });
  }).slice(0, 4);

  const topic = topicOf(title, wordsCache);
  const tooLong = title.length > MAX_TITLE;

  return (
    <div className="rise mt-8">
      <div className="rounded-2xl border border-rule bg-surface p-6 sm:p-7">
        <p className="font-mono text-[12px] uppercase tracking-[.13em] text-muted">Posts shaped like yours, last 12 months</p>

        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-9">
          <div className="shrink-0">
            <div className="font-display text-[52px] font-bold leading-none tracking-[-.04em]">
              {n0(res.worked)}<span className="text-[20px] font-semibold text-muted"> of {n0(res.n)}</span>
            </div>
            <p className="mt-2 max-w-[19ch] text-[13.5px] text-muted">
              reached {WORKED} points — <b className="text-ink">{pc(rate)}</b>, against {pc(base)} for everything posted
            </p>
          </div>

          <div className="min-w-0 flex-1">
            {FLAGS.map((f, i) =>
              shape.flags[i] ? (
                <Factor
                  key={f.key}
                  good={report.flags[i].lift > 1}
                  text={`It ${f.label}.`}
                  note={`${pc(report.flags[i].rate)} vs ${pc(report.flags[i].rateOther)}`}
                />
              ) : null,
            )}
            <Factor
              good={report.bands[band].rate >= base}
              text={`It is ${title.length} characters — ${BANDS[band].label}.`}
              note={`${pc(report.bands[band].rate)} · ${n0(report.bands[band].n)} posts`}
            />
            {!shape.flags.some(Boolean) && (
              <Factor good text="It carries none of the words that move the numbers either way." note="" />
            )}
          </div>
        </div>

        {tooLong && (
          <p className="mt-5 rounded-lg bg-hot/12 px-4 py-3 text-[13.5px]">
            <b>It will not fit.</b> Hacker News cuts the title at {MAX_TITLE} characters, and yours is {title.length}.
          </p>
        )}

        {!res.bandKept || res.kept.length < FLAGS.length ? (
          <p className="mt-5 border-t border-rule pt-4 text-[13px] text-muted">
            Too few posts carried all of that at once. The {n0(res.n)} above are the closest group the corpus can
            actually count: {describe(res.kept, shape.flags, res.bandKept ? shape.band : null)}.
          </p>
        ) : null}
      </div>

      {swaps.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rule bg-surface p-6 sm:p-7">
          <p className="font-mono text-[12px] uppercase tracking-[.13em] text-muted">The same title, one thing changed</p>
          <div className="mt-3">
            {swaps.map((s) => (
              <Factor key={s.label} good={s.up} text={`The same title ${s.label}`} note={`${pc(s.rate)} · ${n0(s.n)} posts`} />
            ))}
          </div>
          <p className="mt-4 text-[13px] text-muted">
            These are separate groups of real posts, not a forecast for yours. People who write a careful title also
            tend to have built a careful thing — the words are not doing all of this on their own.
          </p>
        </div>
      )}

      {winners.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rule bg-surface p-6 sm:p-7">
          <p className="font-mono text-[12px] uppercase tracking-[.13em] text-muted">
            Titles this shape that worked{rate < base ? " anyway" : ""}
          </p>
          <div className="mt-2">
            {winners.map((p) => <Row key={p.i} p={p} />)}
          </div>
        </div>
      )}

      {!ready && <p className="mt-4 text-[13.5px] text-muted">Loading the posts behind this…</p>}

      {topic && <TopicPanel topic={topic} />}
    </div>
  );
}

function Factor({ good, text, note }: { good: boolean; text: string; note: string }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-rule py-2.5 text-[14.5px] first:border-t-0">
      <span className={`w-4 shrink-0 font-mono font-semibold ${good ? "text-green" : "text-accent"}`}>{good ? "+" : "−"}</span>
      <span className="min-w-0 flex-1">{text}</span>
      <span className="shrink-0 font-mono text-[12.5px] text-muted">{note}</span>
    </div>
  );
}

export function Row({ p }: { p: Winner }) {
  return (
    <a
      href={`https://news.ycombinator.com/item?id=${p.i}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-baseline gap-3.5 border-t border-rule py-2.5 text-[14.5px] first:border-t-0 hover:bg-hot/8"
    >
      <span className="w-11 shrink-0 text-right font-mono text-[13px] font-semibold text-accent">{n0(p.p)}</span>
      <span className="min-w-0 flex-1">{p.t.replace(/^\s*show\s*hn\s*[:\-–—]\s*/i, "")}</span>
      <span className="hidden shrink-0 font-mono text-[12.5px] text-muted sm:block">
        {new Date(p.s * 1000).toISOString().slice(0, 7)}
      </span>
    </a>
  );
}
