import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatNumber } from "../lib/workspace-data";
import type { Rank } from "../lib/workspace-data";

const colors = [
  "var(--purple)",
  "var(--blue)",
  "var(--peach)",
  "var(--mint)",
  "var(--warning)",
];
/** Distribution from recorded page views, with a keyboard-accessible equivalent legend. */
export default function AudienceChart({
  devices,
  referrers,
}: {
  devices: Rank[];
  referrers: Rank[];
}) {
  const [dimension, setDimension] = useState<"Devices" | "Sources">("Devices");
  const [selected, setSelected] = useState<number | null>(null);
  const source = dimension === "Devices" ? devices : referrers;
  const rows =
    source.length > 5
      ? [
          ...source.slice(0, 4),
          {
            name: "Other",
            count: source.slice(4).reduce((n, r) => n + r.count, 0),
          },
        ]
      : source;
  const total = rows.reduce((n, r) => n + r.count, 0);
  let offset = 0;
  const active = selected == null ? null : rows[selected];
  return (
    <section className="panel audience-panel">
      <div className="panel-heading">
        <h2>Audience mix</h2>
        <ArrowUpRight size={16} />
      </div>
      <div className="audience-controls segmented">
        {(["Devices", "Sources"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={dimension === v}
            className={dimension === v ? "selected" : ""}
            onClick={() => {
              setDimension(v);
              setSelected(null);
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {total ? (
        <div className="audience-body">
          <div className="audience-donut">
            <svg
              viewBox="0 0 220 220"
              role="img"
              aria-label={`${dimension} distribution for ${formatNumber(total)} page views`}
            >
              <circle
                cx="110"
                cy="110"
                r="98"
                fill="none"
                stroke="var(--border)"
                strokeWidth=".5"
                strokeDasharray="1 5"
              />
              <circle
                cx="110"
                cy="110"
                r="72"
                fill="none"
                stroke="var(--border-soft)"
                strokeWidth="20"
              />
              {rows.map((row, i) => {
                const start = offset;
                offset += (row.count / total) * 100;
                return (
                  <circle
                    key={row.name}
                    cx="110"
                    cy="110"
                    r="72"
                    pathLength="100"
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth={selected === i ? "24" : "20"}
                    strokeDasharray={`${Math.max(0.1, (row.count / total) * 100 - 1.6)} 100`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 110 110)"
                    opacity={selected != null && selected !== i ? 0.25 : 1}
                    className="audience-arc"
                  />
                );
              })}
              <text
                x="110"
                y="107"
                textAnchor="middle"
                className="audience-value"
              >
                {active
                  ? `${Math.round((active.count / total) * 100)}%`
                  : formatNumber(total)}
              </text>
              <text
                x="110"
                y="129"
                textAnchor="middle"
                className="audience-label"
              >
                {active ? active.name.toUpperCase().slice(0, 18) : "PAGE VIEWS"}
              </text>
            </svg>
          </div>
          <div className="audience-legend">
            {rows.map((row, i) => (
              <button
                key={row.name}
                onMouseEnter={() => setSelected(i)}
                onMouseLeave={() => setSelected(null)}
                onFocus={() => setSelected(i)}
                onBlur={() => setSelected(null)}
                onClick={() => setSelected(selected === i ? null : i)}
                aria-pressed={selected === i}
              >
                <span
                  className="audience-legend-dot"
                  style={{ background: colors[i] }}
                />
                <span>{row.name}</span>
                <strong>
                  {Math.round((row.count / total) * 100)}
                  <small>%</small>
                </strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="table-empty">No visitor observations yet.</p>
      )}
    </section>
  );
}
