import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { formatNumber, bucketChart } from "../lib/workspace-data";
import type { ChartPoint } from "../lib/workspace";
import type { Range } from "../lib/demo";

const phases = [
  { key: "dns_ms", label: "DNS", color: "var(--chart-lime)" },
  { key: "tcp_ms", label: "TCP", color: "var(--chart-green)" },
  { key: "tls_ms", label: "TLS", color: "var(--chart-teal)" },
  { key: "ttfb_ms", label: "TTFB", color: "var(--chart-cyan)" },
  { key: "other", label: "Other", color: "var(--chart-blue)" },
] as const;
type Phase = (typeof phases)[number]["key"];
function timingParts(point: ChartPoint): Record<Phase, number> {
  const known = {
    dns_ms: Math.max(0, point.dns_ms || 0),
    tcp_ms: Math.max(0, point.tcp_ms || 0),
    tls_ms: Math.max(0, point.tls_ms || 0),
    ttfb_ms: Math.max(0, point.ttfb_ms || 0),
  };
  return {
    ...known,
    other: Math.max(
      0,
      point.total_ms - Object.values(known).reduce((a, b) => a + b, 0),
    ),
  };
}

/** Layered measured timing areas, with pointer/keyboard inspection and accessible data. */
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
    summary = workspace.summary(siteId),
    id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<number | null>(null),
    [activePhase, setActivePhase] = useState<Phase | null>(null);
  const points =
    !siteId && workspace.monitors.length > 1
      ? bucketChart(summary.chart)
      : summary.chart;
  const container = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(760);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [points.length]);
  const height = 258,
    left = 42,
    bottom = 218;
  const max =
    Math.max(
      100,
      breakdown ? 0 : summary[percentile] || 0,
      ...points.map((p) =>
        Math.max(
          p.total_ms,
          Object.values(timingParts(p)).reduce((a, b) => a + b, 0),
        ),
      ),
    ) * 1.12;
  const start = points.length ? Date.parse(points[0].ts) : Date.now() - 3600000,
    end = points.length
      ? Math.max(start + 1, Date.parse(points.at(-1)!.ts))
      : Date.now();
  const x = (ts: string) =>
      left + ((Date.parse(ts) - start) / (end - start)) * (width - left - 14),
    y = (value: number) => bottom - (value / max) * (bottom - 15);
  const path = (data: ChartPoint[]) =>
    data
      .map((p, i) => {
        const px = x(p.ts),
          py = y(p.total_ms);
        if (!i) return `M${px.toFixed(2)},${py.toFixed(2)}`;
        const previous = data[i - 1],
          mid = (x(previous.ts) + px) / 2;
        return `C${mid.toFixed(2)},${y(previous.total_ms).toFixed(2)} ${mid.toFixed(2)},${py.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`;
      })
      .join(" ");
  const cumulative = (count: number) =>
    points.map((p) => ({
      ...p,
      total_ms: phases
        .slice(0, count)
        .reduce((sum, phase) => sum + timingParts(p)[phase.key], 0),
    }));
  const current = selected == null ? null : points[selected],
    label = (date: string) =>
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
  const line = path(points),
    baseline = `L${x(points.at(-1)!.ts)},${bottom} L${left},${bottom} Z`;
  return (
    <div
      className={`native-chart-wrap ${breakdown ? "layered-chart" : "total-chart"}`}
    >
      <div className="timing-legend" aria-label="Request timing legend">
        {breakdown ? (
          phases.map((phase) => (
            <button
              key={phase.key}
              aria-pressed={activePhase === phase.key}
              onClick={() =>
                setActivePhase(activePhase === phase.key ? null : phase.key)
              }
              style={{ "--phase-color": phase.color } as React.CSSProperties}
              title={`${phase.label}: ${formatNumber(current ? timingParts(current)[phase.key] : points.reduce((sum, p) => sum + timingParts(p)[phase.key], 0) / points.length, 1)} ms ${current ? "at selected check" : "average"}`}
            >
              <i />
              {phase.label}
              <strong>
                {formatNumber(
                  current
                    ? timingParts(current)[phase.key]
                    : points.reduce(
                        (sum, p) => sum + timingParts(p)[phase.key],
                        0,
                      ) / points.length,
                  0,
                )}
                <small>ms</small>
              </strong>
            </button>
          ))
        ) : (
          <span>
            <i style={{ background: "var(--chart-cyan)" }} />
            Total response
            <span className="legend-threshold">Dashed / {percentile}</span>
          </span>
        )}
      </div>
      <div
        className="latency-chart native-chart"
        ref={container}
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
            {phases.map((phase) => (
              <linearGradient
                key={phase.key}
                id={`${id}-${phase.key}`}
                x2="0"
                y2="1"
              >
                <stop stopColor={phase.color} stopOpacity=".95" />
                <stop offset="1" stopColor={phase.color} stopOpacity=".48" />
              </linearGradient>
            ))}
            <linearGradient id={`${id}-total`} x2="0" y2="1">
              <stop stopColor="var(--chart-cyan)" stopOpacity=".4" />
              <stop
                offset="1"
                stopColor="var(--chart-cyan)"
                stopOpacity=".03"
              />
            </linearGradient>
            <linearGradient id={`${id}-cursor`} x2="0" y2="1">
              <stop stopColor="var(--chart-blue)" stopOpacity=".12" />
              <stop offset="1" stopColor="var(--chart-blue)" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-plot`}>
              <rect
                x={left}
                y="10"
                width={width - left - 14}
                height={bottom - 8}
              />
            </clipPath>
          </defs>
          {[0, 0.2, 0.4, 0.6, 0.8].map((v, i) => (
            <rect
              key={v}
              x={left + v * (width - left - 14)}
              y="10"
              width={(width - left - 14) / 10}
              height={bottom - 10}
              fill="var(--chart-stripe)"
              opacity={i % 2 ? ".7" : ".4"}
            />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={left}
                x2={width - 14}
                y1={y(v * max)}
                y2={y(v * max)}
                stroke="var(--chart-grid)"
                strokeWidth=".6"
              />
              <text
                x={left - 9}
                y={y(v * max) + 3}
                textAnchor="end"
                fill="var(--muted)"
                fontSize="9"
              >
                {Math.round(v * max)}
              </text>
            </g>
          ))}
          <g clipPath={`url(#${id}-plot)`}>
            {breakdown ? (
              phases.map((phase, index) => {
                const upper = cumulative(index + 1),
                  lower = cumulative(index).reverse();
                return (
                  <g
                    key={phase.key}
                    className="timing-area"
                    opacity={
                      activePhase && activePhase !== phase.key ? 0.23 : 1
                    }
                  >
                    <path
                      d={`${path(upper)} ${path(lower).replace(/^M/, "L")} Z`}
                      fill={`url(#${id}-${phase.key})`}
                    />
                    <path
                      d={path(upper)}
                      fill="none"
                      stroke={phase.color}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })
            ) : (
              <>
                <path d={`${line} ${baseline}`} fill={`url(#${id}-total)`} />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--chart-cyan)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {points
                  .filter(
                    (_, i) =>
                      i % Math.max(1, Math.floor(points.length / 10)) === 0,
                  )
                  .map((p) => (
                    <circle
                      key={p.ts}
                      cx={x(p.ts)}
                      cy={y(p.total_ms)}
                      r="2.7"
                      fill="var(--chart-cyan)"
                      stroke="var(--surface)"
                      strokeWidth="1.5"
                    />
                  ))}
              </>
            )}
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
                opacity=".18"
              >
                <title>Monitoring gap: {gap.reason}</title>
              </rect>
            ))}
            {!breakdown && summary[percentile] != null && (
              <line
                x1={left}
                x2={width - 14}
                y1={y(summary[percentile]!)}
                y2={y(summary[percentile]!)}
                stroke="var(--muted)"
                opacity=".5"
                strokeDasharray="3 5"
              >
                <title>
                  {percentile}: {formatNumber(summary[percentile], 1)} ms
                </title>
              </line>
            )}
            {markers
              .filter(
                (m) => Date.parse(m.ts) >= start && Date.parse(m.ts) <= end,
              )
              .map((m, i) => (
                <g key={i}>
                  <line
                    x1={x(m.ts)}
                    x2={x(m.ts)}
                    y1="10"
                    y2={bottom}
                    stroke="var(--purple)"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={x(m.ts) + 4}
                    y="18"
                    fontSize="9"
                    fill="var(--purple)"
                  >
                    {m.version.slice(0, 14)}
                  </text>
                  <title>Release {m.version}</title>
                </g>
              ))}
            {current && (
              <>
                <rect
                  x={x(current.ts) - 16}
                  y="10"
                  width="32"
                  height={bottom - 10}
                  fill={`url(#${id}-cursor)`}
                />
                <line
                  x1={x(current.ts)}
                  x2={x(current.ts)}
                  y1="10"
                  y2={bottom}
                  stroke="var(--text)"
                  opacity=".4"
                  strokeDasharray="3 4"
                />
                <circle
                  cx={x(current.ts)}
                  cy={y(current.total_ms)}
                  r="4"
                  fill="var(--chart-blue)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </>
            )}
          </g>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <text
              key={v}
              x={left + v * (width - left - 14)}
              y="248"
              textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"}
              fontSize="9"
              fill="var(--muted)"
            >
              {label(new Date(start + v * (end - start)).toISOString())}
            </text>
          ))}
        </svg>
        {current && (
          <div
            className="chart-tooltip timing-tooltip"
            style={{
              left: `${Math.max(23, Math.min(77, (x(current.ts) / width) * 100))}%`,
            }}
            aria-hidden="true"
          >
            <span>
              {label(current.ts)} · {current.ok ? "OK" : "Failed"}
            </span>
            <strong>
              {formatNumber(current.total_ms, 1)} <small>ms total</small>
            </strong>
            {breakdown && (
              <div>
                {phases.map((phase) => (
                  <span key={phase.key}>
                    <i style={{ background: phase.color }} />
                    {phase.label}
                    <b>{formatNumber(timingParts(current)[phase.key], 1)} ms</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="chart-reading" aria-live="polite">
        {current
          ? `${label(current.ts)} · ${formatNumber(current.total_ms, 1)} ms · ${current.ok ? "OK" : "Failed"}`
          : breakdown
            ? "Stacked request timing · averages per display bucket · Other includes transfer and overhead"
            : "Response per display bucket · dashed line shows the period percentile"}
      </div>
    </div>
  );
}
