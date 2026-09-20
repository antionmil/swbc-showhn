"use client";

import { useEffect, useState } from "react";
import report from "@/data/report.json";
import { Row, type Winner } from "./Checker";

type Answer = {
  q: string; n: number; settled: number; worked: number; sank: number;
  rate: number | null; base: number;
  topWorked: Winner[]; topSank: Winner[]; first: number | null;
};

const pc = (x: number) => `${x.toFixed(1)}%`;
const n0 = (x: number) => x.toLocaleString("en-US");

export default function TopicPanel({ topic, heading }: { topic: string; heading?: string }) {
  const [data, setData] = useState<Answer | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let live = true;
    /* Clear first. Showing the previous topic's winners under the new topic's
     * name for even one frame is a lie the visitor has no reason to doubt. */
    setData(null);
    setState("loading");
    fetch(`/api/topic?q=${encodeURIComponent(topic)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Answer) => { if (live) { setData(d); setState("ok"); } })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [topic]);

  return (
    <div className="rise mt-4 rounded-2xl border border-rule bg-surface p-6 sm:p-7">
      <p className="font-mono text-[12px] uppercase tracking-[.13em] text-muted">
        {heading ?? "Everyone else who posted about"} <span className="text-accent">{topic}</span>
      </p>

      {state === "loading" && (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="h-4 w-2/3 animate-pulse rounded bg-bar" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-bar" />
          <span className="sr-only">Looking through the corpus…</span>
        </div>
      )}

      {state === "error" && (
        <p className="mt-3 text-[14.5px] text-muted">
          That lookup did not come back. The rest of this page is built and does not need it — try again in a moment.
        </p>
      )}

      {state === "ok" && data && (
        data.n < 12 ? (
          <p className="mt-3 text-[14.5px] text-muted">
            Only {data.n === 0 ? "nothing" : `${data.n} post${data.n === 1 ? "" : "s"}`} in fifteen years mentioned
            {" "}<b className="text-ink">{topic}</b>. That is too few to say anything honest about, which is its own
            kind of answer: nobody has shown this to Hacker News yet.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[15px]">
              <b>{n0(data.n)} posts</b> since 2011 mention it.{" "}
              {data.rate !== null && (
                <>
                  {pc(data.rate)} reached {report.window.WORKED} points, against {pc(data.base)} across the whole site —{" "}
                  <b className={data.rate >= data.base ? "text-green" : "text-accent"}>
                    {data.rate >= data.base ? "a better topic than most" : "a harder topic than most"}
                  </b>.
                </>
              )}
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h4 className="font-display text-[15px] font-semibold text-green">Worked — {n0(data.worked)} of {n0(data.n)}</h4>
                <p className="text-[12.5px] text-muted">{report.window.WORKED} points or more</p>
                <div className="mt-1.5">
                  {data.topWorked.length
                    ? data.topWorked.map((p) => <Row key={p.i} p={p} />)
                    : <p className="border-t border-rule pt-2.5 text-[14px] text-muted">
                        Not one of them. In fifteen years, no post mentioning <b className="text-ink">{topic}</b> has
                        reached {report.window.WORKED} points.
                      </p>}
                </div>
              </div>
              <div>
                <h4 className="font-display text-[15px] font-semibold text-accent">Sank — {n0(data.sank)} of {n0(data.n)}</h4>
                <p className="text-[12.5px] text-muted">Two points or fewer. The newest first.</p>
                <div className="mt-1.5">
                  {data.topSank.length
                    ? data.topSank.map((p) => <Row key={p.i} p={p} />)
                    : <p className="border-t border-rule pt-2.5 text-[14px] text-muted">
                        None. Every post about this got past two points, which almost no subject manages.
                      </p>}
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
