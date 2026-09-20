"use client";

import { useState } from "react";
import TopicPanel from "./TopicPanel";
import report from "@/data/report.json";

const pc = (x: number) => `${x.toFixed(1)}%`;

export default function TopicSearch({ suggestions }: { suggestions: string[] }) {
  const [value, setValue] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const league = report.league;

  const pick = (t: string) => { setValue(t); setTopic(t.toLowerCase()); };

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); const v = value.trim(); if (v.length >= 2) setTopic(v.toLowerCase()); }}
        className="flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="A word — terminal, resume, chess, markdown"
          aria-label="Search the corpus for a topic"
          className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-4 py-3.5 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button type="submit" className="rounded-xl bg-accent px-6 py-3.5 font-semibold text-white active:scale-[.98] dark:text-ground">
          Look it up
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-[13.5px] text-muted">
        <span>Try:</span>
        {suggestions.map((s) => (
          <button key={s} onClick={() => pick(s)} className="text-accent underline decoration-rule underline-offset-2 hover:decoration-accent">
            {s}
          </button>
        ))}
      </div>

      {topic && <TopicPanel topic={topic} heading="Every Show HN about" />}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <League title="Words that carried a post" rows={league.best} good />
        <League title="Words that never did" rows={league.worst} good={false} />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Words in at least {league.min} titles of the past twelve months, and how often those posts reached {report.window.WORKED} upvotes. Across every post it is {pc(report.window.base)}.
        Press one to see both columns of posts behind it.
      </p>
    </div>
  );

  function League({ title, rows, good }: { title: string; rows: { w: string; n: number; rate: number }[]; good: boolean }) {
    return (
      <div className="rounded-2xl border border-rule bg-surface p-5">
        <h4 className={`font-display text-[15px] font-semibold ${good ? "text-green" : "text-accent"}`}>{title}</h4>
        <div className="mt-2">
          {rows.map((r) => (
            <button
              key={r.w}
              onClick={() => pick(r.w)}
              className="flex w-full items-baseline gap-3 border-t border-rule py-2 text-left text-[14.5px] first:border-t-0 hover:bg-hot/8"
            >
              <span className={`w-12 shrink-0 text-right font-mono text-[13px] font-semibold ${good ? "text-green" : "text-accent"}`}>
                {pc(r.rate)}
              </span>
              <span className="min-w-0 flex-1">{r.w}</span>
              <span className="shrink-0 font-mono text-[12.5px] text-muted">{r.n} posts</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}
