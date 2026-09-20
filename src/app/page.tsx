import Checker from "@/components/Checker";
import Report from "@/components/Report";
import TopicSearch from "@/components/TopicSearch";
import { Row } from "@/components/Checker";
import report from "@/data/report.json";

const n0 = (x: number) => x.toLocaleString("en-US");
const pc = (x: number) => `${x.toFixed(1)}%`;

export default function Home() {
  const r = report;
  const built = new Date(r.built);

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-6 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-4">
        <p className="font-display text-[14px] font-bold tracking-[-.01em]">
          Show HN <span className="text-accent">/ what actually worked</span>
        </p>
        <p className="font-mono text-[11.5px] text-muted">
          {n0(r.corpus.total)} posts · <b className="font-semibold text-green">+{n0(r.corpus.week)} this week</b>
        </p>
      </header>

      <h1 className="mt-9 max-w-[17ch] font-display text-[40px] font-bold leading-[1.03] tracking-[-.038em] sm:text-[52px]">
        The typical Show HN gets {spell(r.window.median)} upvotes. One is your own.
      </h1>
      <p className="mt-4 max-w-[56ch] text-[17px] text-muted">
        <b className="text-ink">Show HN</b> is the part of Hacker News where people post the thing they built.
        {" "}{n0(r.corpus.total)} have been posted since 2011. Hacker News gives your own submission one upvote
        automatically, and {pc(r.window.pctLE1)} of posts never get a second one.
      </p>
      <p className="mt-3 max-w-[56ch] text-[17px] text-muted">
        Paste the title you are about to use. This looks up the posts of the past year whose titles had the same
        shape, and shows you what happened to them — including the ones nobody saw.
      </p>

      <Checker examples={r.samples.map((s) => s.t)} />

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <Stat n={String(r.window.median)} t="upvotes for the middle post of the past year" />
        <Stat n={pc(r.window.pctNoComment)} t="got no comment at all" hot />
        <Stat n={pc(r.window.pct100)} t="reached 100 upvotes" />
      </div>

      <Report />

      <section className="mt-20">
        <p className="font-mono text-[12px] uppercase tracking-[.13em] text-accent">Any subject you like</p>
        <h2 className="mt-3 max-w-[20ch] font-display text-[34px] font-bold leading-[1.06] tracking-[-.033em] sm:text-[42px]">
          Nobody shows you the posts that sank.
        </h2>
        <p className="mb-7 mt-3 max-w-[62ch] text-[15px] text-muted">
          Every list of great Show HNs is a list of winners, which teaches you nothing: you cannot see what the
          winners did differently without the posts that did the same thing and got two upvotes. Look up any subject
          and you get both columns.
        </p>
        <TopicSearch suggestions={r.topics} />
      </section>

      <section className="mt-20 rounded-2xl border border-rule bg-surface p-6 sm:p-7">
        <p className="font-mono text-[12px] uppercase tracking-[.13em] text-muted">
          This week · {n0(r.corpus.week)} new posts
        </p>
        <h3 className="mt-3 font-display text-[23px] font-semibold tracking-[-.02em]">The ones that worked, in the last seven days</h3>
        <div className="mt-3">{r.newest.map((p) => <Row key={p.i} p={p} />)}</div>
        <p className="mt-4 text-[13px] text-muted">
          Everything here is rebuilt every night, so these numbers move. Posts from the last two days are counted in
          the total but left out of every rate, because their upvotes are still moving.
        </p>
      </section>

      <footer className="mt-20 border-t border-rule pt-7 text-[13.5px] leading-relaxed text-muted">
        <h2 className="font-display text-[15px] font-semibold text-ink">How this is measured, and where it is weak</h2>
        <ul className="mt-3 space-y-2.5">
          <li>
            <b className="text-ink">What is counted.</b> Every post Hacker News tags <code className="font-mono text-[12.5px]">show_hn</code>,
            from {r.corpus.firstDay} to {r.corpus.lastDay} — {n0(r.corpus.total)} of them, read from the
            {" "}<a className="underline decoration-rule underline-offset-2 hover:decoration-accent" href="https://hn.algolia.com/api" target="_blank" rel="noopener noreferrer">Hacker News search API</a>.
            Not a sample, and not only the winners.
          </li>
          <li>
            <b className="text-ink">&ldquo;Worked&rdquo; means {r.window.WORKED} upvotes or more.</b> That is the top {pc(r.window.base)} of
            the past year. Hacker News calls an upvote a point and shows it beside every post. It does not publish
            which posts reached the front page, so the upvote count is the closest honest measure of being seen.
            Rates come from the {n0(r.window.n)} posts between {r.window.from} and {r.window.to}.
          </li>
          <li>
            <b className="text-ink">Points are not quality, and this page cannot separate them.</b> A title that names a
            language is often attached to something built by someone who cares about languages. The numbers describe
            groups of posts. They do not predict yours.
          </li>
          <li>
            <b className="text-ink">Prior art.</b> Kraishan&rsquo;s{" "}
            <a className="underline decoration-rule underline-offset-2 hover:decoration-accent" href="https://arxiv.org/abs/2511.04453" target="_blank" rel="noopener noreferrer">Launch-Day Diffusion</a>{" "}
            (arXiv, 2025) tracked 138 launches and found the posting hour moves GitHub stars, while the Show HN tag
            itself showed no advantage once other factors were controlled. This site measures upvotes rather than
            stars, over every post rather than 138 launches, and finds the hour worth little next to the words.
          </li>
          <li>
            <b className="text-ink">Upvotes were read when each post was fetched.</b> Anything older than two days has
            settled. Deleted and flagged posts are not counted at all, so genuinely bad launches are under-counted.
          </li>
        </ul>
        <p className="mt-6">
          Built in a day by <a className="underline decoration-rule underline-offset-2 hover:decoration-accent" href="https://onedaybuilt.com" target="_blank" rel="noopener noreferrer">onedaybuilt.com</a>
          {" "}· no account, no tracking of what you type, nothing stored · last rebuilt {built.toISOString().slice(0, 10)}
        </p>
      </footer>
    </main>
  );
}

/* The headline says "two upvotes" because the middle post really gets two.
 * If that moves, the headline moves with it rather than becoming false. */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const spell = (n: number) => (Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n));

function Stat({ n, t, hot }: { n: string; t: string; hot?: boolean }) {
  return (
    <div className="rounded-2xl border border-rule bg-surface p-5">
      <div className={`font-display text-[32px] font-bold leading-none tracking-[-.03em] ${hot ? "text-accent" : ""}`}>{n}</div>
      <p className="mt-2 text-[13.5px] text-muted">{t}</p>
    </div>
  );
}
