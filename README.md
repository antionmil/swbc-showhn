# Show HN, what actually got attention

Day 14 of [onedaybuilt.com](https://onedaybuilt.com). Live at
**[showhn.onedaybuilt.com](https://showhn.onedaybuilt.com)**.

On Hacker News there is a section called **Show HN**, where people post the
thing they built. 96 in 100 are never seen. The middle one gets two upvotes,
and one of those is the automatic upvote you get for submitting.

Paste the title you are about to use. The site finds the posts of the past
twelve months whose titles had the same *shape* — the same handful of
measurable facts — and tells you what happened to them. Then it shows every
post about your subject, the ones that were seen **and** the ones that were not.

The page says "upvotes" throughout, and explains once that Hacker News calls
an upvote a point. A test fails if any component writes "HN" on its own or
puts "points" back in front of a reader. One positive word throughout: a post is
**seen** at 30 upvotes or more, which 4 in 100 manage. The stricter cut in
the comparison columns is **Ignored**, two upvotes or fewer, so one phrase
never carries two thresholds.

The wheel drew this idea as "Show HN, what actually worked". The site shipped
as "what actually got attention", because *worked* asks a question this data
cannot answer — it measures attention, not outcomes. The draw record keeps
the drawn name; only the product name changed.

No account, no sign-in, nothing stored about what you type.

## What the corpus says

208,000+ posts, every Show HN back to January 2011, read from the Hacker News
search API. Rates are measured on the 45,000 posts of the last twelve months that are
at least 48 hours old, because upvotes keep moving for about a day.

| | |
|---|---|
| The middle post | **2 upvotes**, one of which is your own |
| Got no comment at all | **62%** |
| Seen (30 upvotes or more) | **4.1%** |
| Reached 100 upvotes | **1.7%** |
| Titles saying AI, LLM, GPT or agent | **31%** of all posts, and they are seen **2.9%** of the time against **4.6%** for everything else |
| Best hour vs worst hour | 17:00 UTC **5.6%**, 07:00 UTC **2.0%** |
| 2011 vs 2026 | 2,980 posts at **12.7%**, against 36,100 posts at **4.0%** |

**The twist.** Every existing tool sells the best hour to post —
[Myriade](https://hn.myriade.ai), [CatchIntent](https://catchintent.com/tools/hn-analyzer/),
[hn-best-posting-times](https://github.com/JoseMarquezAlberti/hn-best-posting-times).
The hour is worth 3.6 posts in a hundred. One word in the title costs about the
same, and a third of posters write it. The prior art that matters most is
Kraishan's [Launch-Day Diffusion](https://arxiv.org/abs/2511.04453) (arXiv,
2025): 138 launches, GitHub stars as the outcome, timing significant, the Show
HN tag itself not. This site measures upvotes over every post instead.

## Architecture

**There is no database.** Day 10 of this challenge lost two sites to a free
Postgres egress quota. Here the corpus is a directory of monthly JSONL files
in the repo, every number is computed at build time, and the only server
function reads a text file.

```
data/YYYY-MM.jsonl      the store, 189 files, one line per post (committed)
  ↓ pnpm data  (scripts/build-data.mts)
src/data/report.json    every aggregate and chart series          7 KB
src/data/cells.json     posts + wins per title shape, 2,916 cells 23 KB
public/data/winners.json  the 1,849 posts that worked, lazy-loaded
public/data/words.json    3,134 subject words, for picking a topic
data/search.txt         one line per post, read by /api/topic     17 MB
```

- `/` is **static**. The title check runs entirely in the browser against
  `cells.json`; there is no request and nothing to rate-limit.
- `/api/topic` is the only dynamic route. It scans the corpus for a word and
  returns both columns, cached at the edge for a day — through
  `vercel-cdn-cache-control`, because Next rewrites `cache-control` on a
  dynamic route and the edge was caching nothing.
- `/api/og` renders the share card.
- `.github/workflows/refresh.yml` adds the new posts every night and re-reads
  the last 8 days. A commit to `data/` triggers the deploy that rebuilds every
  number above.

### The title shape

`src/lib/flags.ts` is the contract between the build and the browser: six
yes/no facts (AI wording, a number, a language name, "free", "open source",
"I built it") and a length band. The build counts every post into every cell
it belongs to; the browser computes the same flags for your title and reads
the cell. **Both sides import that one file**, because if they ever disagreed
the site would quote a rate for a group you are not in.

When your exact shape holds fewer than 200 posts, the back-off drops the
weakest flag first and says so on the page. The AI flag — the strongest signal
in the corpus, z = −8.8 — is never dropped.

## Verifying it

```
pnpm test          # 35 checks: flags, cell arithmetic, the API guard, contrast
pnpm build:check   # builds into .next-build so a running dev server survives
pnpm data          # rebuild every artifact from data/
pnpm refresh       # fetch new posts into data/ (what the nightly job runs)
```

The route table must read `○ /` — the page is prerendered. The only `ƒ` routes
are `/api/topic` and `/api/og`, which are meant to be dynamic.

## Traps met while building this

- **Only 7 posts of 208,296 sit at zero upvotes.** Hacker News upvotes your own
  submission automatically, so a post starts at one — which is why 28% of every
  Show HN ever posted sits at exactly one, and why the headline can say "one is
  your own" as a measured fact rather than a turn of phrase.
- **Algolia caps one query at ~1000 hits** whatever `nbPages` says, and an
  unbounded query returns a garbage `nbHits` (it claimed 561,938 Show HN
  posts). Every window is date-bound and split until it fits. 774 API calls
  for the full backfill.
- **`new URL("../data/", import.meta.url).pathname`** percent-encodes, and this
  repo lives under a directory with spaces in its name. The first run wrote 189
  files into a phantom `SWBC%20-%20September.../` directory and reported
  success. Use `fileURLToPath`.
- **`Math.max(...array)` overflows the call stack** at 208,000 elements. It
  crashed the refresh job, and the same shape was waiting in `/api/topic` for
  the first person to search a common word.
- **Tailwind's `sr-only` on a `<table>` does not clip it.** A table ignores
  `width: 1px` and lays out to fit its content, so the screen-reader copy of
  each chart was 736px wide inside a 375px page and gave every phone a sideways
  scroll. The class belongs on a wrapping `<div>`.
- **`outputFileTracingIncludes`** is required for `data/search.txt`, because
  nothing imports it. Without it `/api/topic` works in `next dev` and returns
  500 on every deployed request.

## Where this is weak, in the page's own words

Upvotes are not quality and this site cannot separate them: someone who writes
a careful title usually built a careful thing. The numbers describe groups of
posts, not yours. Deleted and flagged posts are not counted at all, so the
worst launches are under-counted. "Seen" means 30 upvotes because Hacker News does
not publish which posts reached the front page.
