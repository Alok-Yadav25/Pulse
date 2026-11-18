import { useId, useState } from "react";
import { BarChart3 } from "lucide-react";
import { formatNumber } from "../lib/workspace-data";
import type { Rank } from "../lib/workspace-data";
const colors = [
  "var(--chart-teal)",
  "var(--chart-cyan)",
  "var(--chart-blue)",
  "var(--chart-violet)",
  "var(--chart-green)",
  "var(--chart-blue)",
];
export default function PagesChart({ rows }: { rows: Rank[] }) {
  const id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<number | null>(null);
  const visible = rows.slice(0, 6),
    max = Math.max(1, ...visible.map((r) => r.count)),
    total = visible.reduce((n, r) => n + r.count, 0);
  const current = selected == null ? null : visible[selected];
  return (
    <section className="panel pages-chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Top pages</h2>
          <p>Page views by path</p>
        </div>
        <span className="chart-type-badge">
          <BarChart3 size={13} /> Distribution
        </span>
      </div>
      {visible.length ? (
        <>
          <div
            className="pages-chart"
            role="group"
            aria-label="Page-view distribution. Focus a bar to inspect its count."
          >
            <div className="pages-chart-axis" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((v) => (
                <span key={v}>
                  {new Intl.NumberFormat(undefined, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(max * v)}
                </span>
              ))}
            </div>
            <div className="pages-chart-plot">
              <div className="pages-chart-grid" aria-hidden="true" />
              {visible.map((row, i) => (
                <div className="pages-chart-column" key={row.name}>
                  <button
                    onMouseEnter={() => setSelected(i)}
                    onMouseLeave={() => setSelected(null)}
                    onFocus={() => setSelected(i)}
                    onBlur={() => setSelected(null)}
                    onClick={() => setSelected(selected === i ? null : i)}
                    aria-pressed={selected === i}
                    aria-label={`${row.name}: ${formatNumber(row.count)} page views`}
                    className={selected === i ? "selected" : ""}
                    style={
                      {
                        "--bar-color": colors[i],
                        "--bar-height": `${(row.count / max) * 100}%`,
                      } as React.CSSProperties
                    }
                  >
                    <span className="pages-bar-count">
                      {new Intl.NumberFormat(undefined, {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(row.count)}
                    </span>
                    <svg
                      viewBox="0 0 40 180"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id={`${id}-${i}`} x2="0" y2="1">
                          <stop stopColor={colors[i]} />
                          <stop
                            offset="1"
                            stopColor={colors[i]}
                            stopOpacity=".3"
                          />
                        </linearGradient>
                      </defs>
                      <rect
                        x="0"
                        y="0"
                        width="40"
                        height="180"
                        rx="5"
                        fill={`url(#${id}-${i})`}
                      />
                    </svg>
                  </button>
                  <span className="pages-bar-label" title={row.name}>
                    {row.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="pages-chart-detail" aria-live="polite">
            {current ? (
              <>
                <i style={{ background: colors[selected!] }} />
                <span title={current.name}>{current.name}</span>
                <strong>
                  {formatNumber(current.count)} views{" "}
                  <small>
                    · {total ? Math.round((current.count / total) * 100) : 0}%
                  </small>
                </strong>
              </>
            ) : (
              <>
                <span>Top {visible.length} paths</span>
                <strong>
                  {formatNumber(total)} <small>views shown</small>
                </strong>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="table-empty">No page views recorded yet.</p>
      )}
    </section>
  );
}
