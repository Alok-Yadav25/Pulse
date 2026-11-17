import { useId, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { formatNumber, bucketChart } from "../lib/workspace-data";
import type { ChartPoint } from "../lib/workspace";
import type { Range } from "../lib/demo";

/** A small SVG chart: mouse, touch, arrow-key exploration, gaps, and release markers. */
export default function LatencyChart({
  range,
  percentile,
  siteId,
  breakdown = false,
  markers = [],
}: {
  range: Range;
  percentile: "p50" | "p95" | "p99";
  siteId?: string;
  breakdown?: boolean;
  markers?: { ts: string; version: string }[];
}) {
  const workspace = useWorkspace(),
    summary = workspace.summary(siteId);
  const id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<number | null>(null);
  const points =
    !siteId && workspace.monitors.length > 1
      ? bucketChart(summary.chart)
      : summary.chart;
  const width = 760,
    height = 190,
    left = 47,
    bottom = 165;
  const max =
    Math.max(100, summary[percentile] || 0, ...points.map((p) => p.total_ms)) *
    1.15;
  const start = points.length ? Date.parse(points[0].ts) : Date.now() - 3600000,
    end = points.length
      ? Math.max(start + 1, Date.parse(points.at(-1)!.ts))
      : Date.now();
  const x = (ts: string) =>
    left + ((Date.parse(ts) - start) / (end - start)) * (width - left - 14);
  const y = (value: number) => bottom - (value / max) * (bottom - 12);
  const path = (data: ChartPoint[], field: keyof ChartPoint = "total_ms") =>
    data
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.ts).toFixed(2)},${y(Number(p[field]) || 0).toFixed(2)}`,
      )
      .join(" ");
  const line = path(points),
    current = selected == null ? null : points[selected];
  const label = (date: string) =>
    new Date(date).toLocaleString(
      undefined,
      range === "1h" || range === "24h"
        ? { hour: "2-digit", minute: "2-digit" }
        : { month: "short", day: "numeric" },
    );
  if (!points.length)
    return (
      <div className="chart-empty">
        <span>No checks in this period yet.</span>
        <p>Measurements appear after the first probe.</p>
      </div>
    );
  return (
    <div className="native-chart-wrap">
      <div
        className="latency-chart native-chart"
        role="figure"
        aria-label={`${workspace.mode === "sample" ? "Sample" : "Measured"} ${percentile} response times for ${range}`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="group"
          tabIndex={0}
          aria-label="Response time chart. Use left and right arrow keys to inspect checks."
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              setSelected(
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? points.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          points.length - 1,
                          (selected ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
              );
            }
          }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect(),
              position = ((e.clientX - rect.left) / rect.width) * width;
            let closest = 0;
            points.forEach((p, i) => {
              if (
                Math.abs(x(p.ts) - position) <
                Math.abs(x(points[closest].ts) - position)
              )
                closest = i;
            });
            setSelected(closest);
          }}
          onPointerLeave={() => setSelected(null)}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--green)" stopOpacity=".18" />
              <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={left}
                x2={width - 14}
                y1={y(v * max)}
                y2={y(v * max)}
                stroke="var(--chart-grid)"
                strokeDasharray="3 6"
              />
              <text
                x={left - 9}
                y={y(v * max) + 4}
                textAnchor="end"
                fill="var(--muted)"
                fontSize="10"
              >
                {Math.round(v * max)}
              </text>
            </g>
          ))}
          {summary.gaps.map((gap, i) => (
            <rect
              key={i}
              x={Math.max(left, x(gap.started_at))}
              y="10"
              width={Math.max(
                0,
                Math.min(width - 14, x(gap.ended_at)) -
                  Math.max(left, x(gap.started_at)),
              )}
              height={bottom - 10}
              fill="var(--warning)"
              opacity=".13"
            >
              <title>Monitoring gap: {gap.reason}</title>
            </rect>
          ))}
          {!breakdown && (
            <>
              <path
                d={`${line} L${x(points.at(-1)!.ts)},${bottom} L${left},${bottom} Z`}
                fill={`url(#${id})`}
              />
              <path
                d={line}
                fill="none"
                stroke="var(--green)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {breakdown &&
            (["dns_ms", "tcp_ms", "tls_ms", "ttfb_ms"] as const).map(
              (field, index) => {
                const fields = [
                  "dns_ms",
                  "tcp_ms",
                  "tls_ms",
                  "ttfb_ms",
                ] as const;
                const cumulative = (count: number) =>
                  points.map((point) => ({
                    ...point,
                    total_ms: fields
                      .slice(0, count)
                      .reduce((sum, key) => sum + (point[key] || 0), 0),
                  }));
                const upper = cumulative(index + 1),
                  lower = cumulative(index).reverse();
                const color = [
                  "var(--blue)",
                  "var(--purple)",
                  "var(--peach)",
                  "var(--green)",
                ][index];
                return (
                  <g key={field}>
                    <path
                      d={`${path(upper)} ${path(lower).replace(/^M/, "L")} Z`}
                      fill={color}
                      opacity=".16"
                    />
                    <path
                      d={path(upper)}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              },
            )}
          {!breakdown && summary[percentile] != null && (
            <line
              x1={left}
              x2={width - 14}
              y1={y(summary[percentile]!)}
              y2={y(summary[percentile]!)}
              stroke="var(--purple)"
              opacity=".65"
              strokeDasharray="3 4"
            >
              <title>
                {percentile}: {formatNumber(summary[percentile], 1)} ms
              </title>
            </line>
          )}
          {markers
            .filter((m) => Date.parse(m.ts) >= start && Date.parse(m.ts) <= end)
            .map((m, i) => (
              <g key={i}>
                <line
                  x1={x(m.ts)}
                  x2={x(m.ts)}
                  y1="10"
                  y2={bottom}
                  stroke="var(--blue)"
                  strokeDasharray="2 4"
                />
                <title>Release {m.version}</title>
                <text x={x(m.ts) + 4} y="18" fontSize="9" fill="var(--blue)">
                  {m.version.slice(0, 14)}
                </text>
              </g>
            ))}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <text
              key={v}
              x={left + v * (width - left - 14)}
              y={187}
              textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"}
              fontSize="10"
              fill="var(--muted)"
            >
              {label(new Date(start + v * (end - start)).toISOString())}
            </text>
          ))}
          {current && (
            <>
              <line
                x1={x(current.ts)}
                x2={x(current.ts)}
                y1="10"
                y2={bottom}
                stroke="var(--muted)"
                strokeDasharray="3 3"
              />
              <circle
                cx={x(current.ts)}
                cy={y(current.total_ms)}
                r="3.5"
                fill="var(--green)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
      </div>
      <div className="chart-reading" aria-live="polite">
        {current
          ? `${label(current.ts)} · ${formatNumber(current.total_ms, 1)} ms · ${current.ok ? "OK" : "Failed"}`
          : breakdown
            ? "Stacked: DNS · TCP · TLS · TTFB (ms)"
            : "Solid: response per display bucket · dotted: selected percentile"}
      </div>
    </div>
  );
}
