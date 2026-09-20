/* A bar chart with no chart library: a row of divs, plus the same numbers in
 * a table for screen readers and for anyone the colours fail. */
export default function Bars({
  values, labels, marks = [], unit = "%", caption, height = 118,
}: {
  values: number[];
  labels: (string | number)[];
  marks?: number[];
  unit?: string;
  caption: string;
  height?: number;
}) {
  const hi = Math.max(...values);
  return (
    <figure className="mt-4">
      <div className="flex items-end gap-[3px]" style={{ height }} role="presentation">
        {values.map((v, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={`w-full rounded-t-[2px] ${marks.includes(i) ? "bg-hot" : "bg-bar"}`}
              style={{ height: `${Math.max(3, (v / hi) * (height - 18))}px` }}
              title={`${labels[i]}: ${v}${unit}`}
            />
            <span className="truncate font-mono text-[10px] text-muted">{labels[i]}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-[12.5px] text-muted">{caption}</figcaption>
      {/* The same numbers, for a screen reader. The wrapper carries sr-only,
          NOT the table: a table ignores width:1px and lays itself out to fit
          its content, which pushed a 736px box into a 375px page and gave the
          whole site a sideways scroll on every phone. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {values.map((v, i) => (
              <tr key={i}><th scope="row">{labels[i] || `item ${i + 1}`}</th><td>{v.toFixed(1)}{unit}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
