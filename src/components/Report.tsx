import report from "@/data/report.json";
import Bars from "./Bars";

const pc = (x: number) => `${x.toFixed(1)}%`;
const n0 = (x: number) => x.toLocaleString("en-US");
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Report() {
  const r = report;
  const ai = r.flags.find((f) => f.key === "ai")!;
  const lang = r.flags.find((f) => f.key === "lang")!;
  const long = r.lengths.find((l) => l.lo === 70)!;
  const firstYear = r.years[0];
  const lastYear = r.years[r.years.length - 1];
  const gap = r.best.rate - r.worst.rate;

  return (
    <div className="mt-20">
      <p className="font-mono text-[12px] uppercase tracking-[.13em] text-accent">
        The report · every Show HN of the past twelve months · {n0(r.window.n)} posts
      </p>
      <h2 className="mt-3 max-w-[15ch] font-display text-[34px] font-bold leading-[1.06] tracking-[-.033em] sm:text-[42px]">
        Everyone tells you when to post. It hardly matters.
      </h2>

      <section className="mt-12">
        <h3 className="font-display text-[23px] font-semibold tracking-[-.02em]">
          The hour you pick moves you by {Math.round(gap * 10) / 10} posts in a hundred.
        </h3>
        <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
          Best hour {hour(r.best.h)} UTC: {pc(r.best.rate)} of posts reach {r.window.WORKED} upvotes.
          Worst hour {hour(r.worst.h)} UTC: {pc(r.worst.rate)}. {DAYS[r.bestDay.d]} beats {DAYS[r.worstDay.d]} by{" "}
          {pc(r.bestDay.rate)} to {pc(r.worstDay.rate)}. That is the whole timing effect, and it is the thing every
          other tool sells you.
        </p>
        <Bars
          values={r.hours.map((h) => h.rate)}
          labels={r.hours.map((h) => (h.h % 6 === 0 ? String(h.h).padStart(2, "0") : ""))}
          marks={[r.best.h]}
          caption={`Share of posts reaching ${r.window.WORKED} upvotes, by the hour they were posted (UTC).`}
        />
        <p className="mt-4 max-w-[62ch] border-l-[3px] border-rule pl-3.5 text-[13px] text-muted">
          The confound, said first: people who post at a sensible hour are also people who prepared. The clock did not
          do the work. That applies to every number on this page.
        </p>
      </section>

      <hr className="my-11 border-rule" />

      <section>
        <h3 className="font-display text-[23px] font-semibold tracking-[-.02em]">
          One word in your title costs about what the best hour gives you.
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-rule bg-surface p-5">
            <div className="font-display text-[34px] font-bold leading-none tracking-[-.03em] text-accent">{pc(ai.rate)}</div>
            <p className="mt-2.5 text-[14px] text-muted">
              of the {n0(ai.n)} titles that say <b className="text-ink">AI</b>, <b className="text-ink">LLM</b>,{" "}
              <b className="text-ink">GPT</b> or <b className="text-ink">agent</b> reached {r.window.WORKED} upvotes.
              That is <b className="text-ink">{pc(ai.share)} of everything posted</b>.
            </p>
          </div>
          <div className="rounded-2xl border border-rule bg-surface p-5">
            <div className="font-display text-[34px] font-bold leading-none tracking-[-.03em] text-green">{pc(lang.rate)}</div>
            <p className="mt-2.5 text-[14px] text-muted">
              of titles that name a language instead — Rust, Python, Zig. Every title with no AI wording in it:{" "}
              <b className="text-ink">{pc(ai.rateOther)}</b>.
            </p>
          </div>
        </div>
      </section>

      <hr className="my-11 border-rule" />

      <section>
        <h3 className="font-display text-[23px] font-semibold tracking-[-.02em]">
          Show HN got {Math.round(lastYear.n / firstYear.n)} times busier and {Math.round((firstYear.rate / lastYear.rate) * 10) / 10} times harder.
        </h3>
        <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
          {n0(firstYear.n)} posts in {firstYear.y}, and {pc(firstYear.rate)} of them reached {r.window.WORKED} upvotes.
          {" "}{n0(lastYear.n)} in the first {new Date().getUTCMonth() + 1} months of {lastYear.y}, and {pc(lastYear.rate)} do.
          The grey bars are that rate falling. The orange bars underneath are the share of titles saying AI, over the
          same years — it is the one thing on this page that changed shape rather than drifting.
        </p>
        <Bars
          values={r.years.map((y) => y.rate)}
          labels={r.years.map((y) => (y.y % 5 === 0 || y.y === lastYear.y || y.y === firstYear.y ? String(y.y).slice(2) : ""))}
          caption={`Share of each year's posts that reached ${r.window.WORKED} upvotes. ${lastYear.y} runs to ${r.corpus.lastDay}.`}
          height={96}
        />
        <Bars
          values={r.years.map((y) => y.ai)}
          labels={r.years.map((y) => (y.y % 5 === 0 || y.y === lastYear.y || y.y === firstYear.y ? String(y.y).slice(2) : ""))}
          marks={r.years.map((_, i) => i)}
          caption="Share of each year's titles containing AI, LLM, GPT or agent."
          height={96}
        />
      </section>

      <hr className="my-11 border-rule" />

      <section>
        <h3 className="font-display text-[23px] font-semibold tracking-[-.02em]">Short titles win, and almost nobody writes one.</h3>
        <p className="mt-2 max-w-[62ch] text-[15px] text-muted">
          {pc(long.share)} of posts use 70 characters or more — the largest group on the site, and the weakest at{" "}
          {pc(long.rate)}. <b className="text-ink">{r.shortestWinner.t}</b> is {r.shortestWinner.t.length} characters
          and took {n0(r.shortestWinner.p)} upvotes.
        </p>
        <Bars
          values={r.lengths.map((l) => l.rate)}
          labels={r.lengths.map((l) => `${l.lo}s`)}
          marks={[0, 1]}
          caption={`Share reaching ${r.window.WORKED} upvotes, by title length. "70s" means 70 to 79 characters, counting "Show HN: ".`}
        />
      </section>
    </div>
  );
}
