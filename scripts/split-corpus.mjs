/* One-off: the raw backfill -> the monthly store the site reads and the cron appends.
 * Trimmed to what the page renders (day 10's rule): no url, no author, no ISO string.
 * i objectID · t title · p points · c comments · s created_at_i */
import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const SRC = process.argv[2];
const OUT = fileURLToPath(new URL("../data/", import.meta.url)); // NOT .pathname: this repo sits under a path with spaces
mkdirSync(OUT, { recursive: true });

const months = new Map();
const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });
let n = 0;
for await (const line of rl) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  if (!r.title || !r.created_at_i) continue;
  const d = new Date(r.created_at_i * 1000);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!months.has(key)) months.set(key, []);
  months.get(key).push({ i: r.objectID, t: r.title, p: r.points ?? 0, c: r.num_comments ?? 0, s: r.created_at_i });
  n++;
}
for (const [key, rows] of [...months].sort()) {
  rows.sort((a, b) => a.s - b.s);
  writeFileSync(`${OUT}${key}.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}
console.log(`${n} posts -> ${months.size} monthly files in data/`);
