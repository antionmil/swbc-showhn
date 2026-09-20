/* Reading the monthly store. Shared by the data build and the fetch job. */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* fileURLToPath, never URL.pathname: this repo lives under a directory whose
 * name contains spaces, and .pathname hands back %20 — which silently creates
 * a second, wrong directory instead of failing. */
export const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
export const SRC_DATA = fileURLToPath(new URL("../src/data/", import.meta.url));
export const PUB_DATA = fileURLToPath(new URL("../public/data/", import.meta.url));

export type Post = { i: string; t: string; p: number; c: number; s: number };

export function monthFiles(): string[] {
  return readdirSync(DATA_DIR).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort();
}

export function monthKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function readMonth(file: string): Post[] {
  return readFileSync(DATA_DIR + file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Post);
}

export function readAll(): Post[] {
  const out: Post[] = [];
  for (const f of monthFiles()) out.push(...readMonth(f));
  out.sort((a, b) => a.s - b.s);
  return out;
}
