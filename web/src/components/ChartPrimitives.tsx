import { useId } from "react";

/** Percentage gauge; callers pass a real ratio, never a synthesized score. */
export function MetricRing({
  value,
  color = "var(--chart-cyan)",
}: {
  value: number | null;
  color?: string;
}) {
  const id = useId().replace(/:/g, "");
  const bounded = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 64 64" className="metric-ring" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="1" y2="1">
          <stop stopColor={color} />
          <stop offset="1" stopColor="var(--chart-green)" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth="5"
      />
      <circle
        cx="32"
        cy="32"
        r="25"
        pathLength="100"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${bounded} 100`}
        opacity={bounded > 0 ? 1 : 0}
        transform="rotate(-90 32 32)"
        className="metric-ring-progress"
      />
      <path
        d={value == null ? "M25 32H39" : "M24 32 29 37 40 26"}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type RingMetric = { label: string; value: number | null; color: string };
/** Independent concentric percentages; the values are not parts of a whole. */
export function ConcentricRings({
  metrics,
  count,
  total,
}: {
  metrics: RingMetric[];
  count: number;
  total: number;
}) {
  return (
    <svg
      className="quality-rings-svg"
      viewBox="0 0 240 240"
      role="img"
      aria-label={metrics
        .map(
          (m) =>
            `${m.label}: ${m.value == null ? "no data" : `${m.value.toFixed(1)} percent`}`,
        )
        .join(", ")}
    >
      <circle
        cx="120"
        cy="120"
        r="111"
        fill="none"
        stroke="var(--border)"
        strokeWidth=".6"
        strokeDasharray="1 5"
      />
      {metrics.map((metric, i) => (
        <g key={metric.label}>
          <circle
            cx="120"
            cy="120"
            r={94 - i * 18}
            fill="none"
            stroke="var(--ring-track)"
            strokeWidth="9"
          />
          <circle
            cx="120"
            cy="120"
            r={94 - i * 18}
            pathLength="100"
            fill="none"
            stroke={metric.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${metric.value == null ? 0 : Math.max(0, Math.min(100, metric.value))} 100`}
            transform="rotate(-72 120 120)"
            className="quality-ring-progress"
          />
        </g>
      ))}
      <text x="120" y="122" textAnchor="middle" className="quality-ring-count">
        {String(count).padStart(2, "0")}
        <tspan className="quality-ring-total">
          /{String(total).padStart(2, "0")}
        </tspan>
      </text>
      <text
        x="120"
        y="142"
        textAnchor="middle"
        className="quality-ring-caption"
      >
        MONITORS UP
      </text>
    </svg>
  );
}
