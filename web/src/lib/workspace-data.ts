import { chartData } from "./demo";
import type { Monitor, Range } from "./demo";
export type ChartPoint = {
  ts: string;
  total_ms: number;
  dns_ms?: number;
  tcp_ms?: number;
  tls_ms?: number;
  ttfb_ms?: number;
  ok?: boolean;
};
export type Gap = { started_at: string; ended_at: string; reason: string };
export type Summary = {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  average: number | null;
  apdex: number | null;
  uptime: number | null;
  coverage: number | null;
  count: number;
  observed_s: number;
  up_s: number;
  excluded_s: number;
  chart: ChartPoint[];
  gaps: Gap[];
  stale: boolean;
  last_checked_at: string | null;
  last_success_at?: string | null;
  tls_days_left?: number | null;
  insight?: { message: string } | null;
  maintenance?: boolean;
  history_limited?: boolean;
};
export type Incident = {
  id: string;
  site_id: string;
  started_at: string;
  resolved_at: string | null;
  cause: string;
  peak_latency_ms: number;
  notes: string;
};
export type Rank = { name: string; count: number };
export type Traffic = {
  page_views: number;
  unique_visitors: number;
  active_visitors: number;
  unique_visitors_approximate?: boolean;
  vitals_window?: string;
  top_pages: Rank[];
  referrers: Rank[];
  devices: Rank[];
  timezones: Rank[];
  vitals: Record<string, { p75: number | null; band: string }>;
};
export type User = { id: string; email: string; demo: boolean };
export const blankSummary: Summary = {
  p50: null,
  p95: null,
  p99: null,
  average: null,
  apdex: null,
  uptime: null,
  coverage: null,
  count: 0,
  observed_s: 0,
  up_s: 0,
  excluded_s: 0,
  chart: [],
  gaps: [],
  stale: true,
  last_checked_at: null,
};
export const blankTraffic: Traffic = {
  page_views: 0,
  unique_visitors: 0,
  active_visitors: 0,
  top_pages: [],
  referrers: [],
  devices: [],
  timezones: [],
  vitals: {},
};

export function numericPercentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    i = ((sorted.length - 1) * p) / 100;
  return (
    sorted[Math.floor(i)] +
    (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1)
  );
}

/** Bucket multiple monitor series into a readable mean without changing period percentiles. */
export function bucketChart(input: ChartPoint[]): ChartPoint[] {
  if (!input.length) return [];
  const sorted = [...input].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const start = Date.parse(sorted[0].ts),
    span = Math.max(1, Date.parse(sorted.at(-1)!.ts) - start);
  const buckets = new Map<number, ChartPoint[]>();
  sorted.forEach((point) => {
    const key = Math.min(
      79,
      Math.floor(((Date.parse(point.ts) - start) / span) * 80),
    );
    buckets.set(key, [...(buckets.get(key) || []), point]);
  });
  return [...buckets.values()].map((values) => {
    const average = (field: keyof ChartPoint) =>
      values.reduce((sum, p) => sum + (Number(p[field]) || 0), 0) /
      values.length;
    return {
      ts: values[0].ts,
      total_ms: average("total_ms"),
      dns_ms: average("dns_ms"),
      tcp_ms: average("tcp_ms"),
      tls_ms: average("tls_ms"),
      ttfb_ms: average("ttfb_ms"),
      ok: values.every((v) => v.ok),
    };
  });
}
export function formatNumber(
  value: number | null | undefined,
  digits = 0,
): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
}
export function sampleSummary(site: Monitor, range: Range): Summary {
  if (site.status === "pending") return blankSummary;
  const factor =
    site.id === "api"
      ? 0.64
      : site.id === "docs"
        ? 0.82
        : site.id === "store"
          ? 3.7
          : 1;
  const duration = {
    "1h": 3600000,
    "24h": 86400000,
    "7d": 604800000,
    "30d": 2592000000,
  }[range];
  // Align every sample monitor to one minute so rerenders cannot split display buckets.
  const end = Math.floor(Date.now() / 60000) * 60000;
  const chart = chartData(range).map((p, i) => {
    const total = Math.round(p.p50 * factor + Math.sin(i * factor) * 10);
    return {
      ts: new Date(end - duration + (i * duration) / 48).toISOString(),
      total_ms: total,
      dns_ms: total * (0.03 + (0.025 * (1 + Math.sin(i * 0.7))) / 2),
      tcp_ms: total * (0.08 + (0.04 * (1 + Math.cos(i * 0.5))) / 2),
      tls_ms: total * (0.12 + (0.09 * (1 + Math.sin(i * 0.3 + 0.4))) / 2),
      ttfb_ms: total * (0.37 + (0.18 * (1 + Math.sin(i * 0.55 + 0.7))) / 2),
      ok: site.id !== "store" || i !== 36,
    };
  });
  const values = chart.map((p) => p.total_ms),
    up = chart.filter((p) => p.ok).length;
  return {
    ...blankSummary,
    p50: numericPercentile(values, 50),
    p95: numericPercentile(values, 95),
    p99: numericPercentile(values, 99),
    average: values.reduce((a, b) => a + b, 0) / values.length,
    apdex:
      values.reduce(
        (sum, value) => sum + (value <= 500 ? 1 : value <= 2000 ? 0.5 : 0),
        0,
      ) / values.length,
    uptime: (up / chart.length) * 100,
    count: chart.length,
    coverage: 100,
    observed_s: duration / 1000,
    up_s: ((duration / 1000) * up) / chart.length,
    chart,
    stale: false,
    last_checked_at: chart.at(-1)!.ts,
    last_success_at: chart.at(-1)!.ts,
    tls_days_left: 67,
  };
}
export function sampleTraffic(site: Monitor, range: Range): Traffic {
  if (site.status === "pending") return blankTraffic;
  const views = Math.round(
    { "1h": 1284, "24h": 24892, "7d": 158624, "30d": 684120 }[range] *
      (site.id === "api"
        ? 0
        : site.id === "docs"
          ? 0.18
          : site.id === "store"
            ? 0.3
            : 0.52),
  );
  const ranks = (names: string[], weights: number[]) => {
    let remaining = views;
    return names.map((name, i) => {
      const count =
        i === names.length - 1
          ? remaining
          : Math.min(remaining, Math.round(views * weights[i]));
      remaining -= count;
      return { name, count };
    });
  };
  return {
    page_views: views,
    unique_visitors: Math.round(views * 0.61),
    active_visitors: site.visitors,
    top_pages: ranks(
      ["/", "/features", "/pricing", "/blog"],
      [0.5, 0.2, 0.18, 0.12],
    ),
    referrers: ranks(
      ["Direct", "Google", "GitHub", "Other"],
      [0.42, 0.31, 0.16, 0.11],
    ),
    devices: ranks(["desktop", "mobile", "tablet"], [0.64, 0.32, 0.04]),
    timezones: ranks(
      ["Asia/Kolkata", "Europe/London", "America/New_York"],
      [0.5, 0.3, 0.2],
    ),
    vitals: {
      lcp_ms: {
        p75: site.id === "store" ? 2900 : 1800,
        band: site.id === "store" ? "needs-improvement" : "good",
      },
      inp_ms: { p75: 124, band: "good" },
      cls: { p75: 0.04, band: "good" },
    },
  };
}
export function aggregate(summaries: Summary[]): Summary {
  const points = summaries
    .flatMap((s) => s.chart)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const values = points.map((p) => p.total_ms),
    observed = summaries.reduce((sum, s) => sum + s.observed_s, 0),
    up = summaries.reduce((sum, s) => sum + s.up_s, 0);
  return {
    ...blankSummary,
    chart: points,
    count: summaries.reduce((sum, s) => sum + s.count, 0),
    p50: numericPercentile(values, 50),
    p95: numericPercentile(values, 95),
    p99: numericPercentile(values, 99),
    average: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    apdex: values.length
      ? values.reduce(
          (sum, v) => sum + (v <= 500 ? 1 : v <= 2000 ? 0.5 : 0),
          0,
        ) / values.length
      : null,
    uptime: observed ? (up / observed) * 100 : null,
    observed_s: observed,
    up_s: up,
    coverage: summaries.length
      ? summaries.reduce((sum, s) => sum + (s.coverage || 0), 0) /
        summaries.length
      : null,
    excluded_s: summaries.reduce((sum, s) => sum + s.excluded_s, 0),
    gaps: summaries.flatMap((s) => s.gaps),
    stale: summaries.some((s) => s.stale),
    last_checked_at:
      summaries
        .map((s) => s.last_checked_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    insight: summaries.find((s) => s.insight)?.insight,
  };
}
