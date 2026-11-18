import { lazy, Suspense, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  Clock3,
  ExternalLink,
  Globe2,
  MoreHorizontal,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkline, StatusDot, UptimeStrip } from "./ui";
import CreatorCredit from "./CreatorCredit";
import { ConcentricRings, MetricRing } from "./ChartPrimitives";
import { useWorkspace } from "../lib/workspace";
import { formatNumber } from "../lib/workspace-data";
import type { Monitor, Range } from "../lib/demo";
import { rangeLabels } from "../lib/demo";
const LatencyChart = lazy(() => import("./LatencyChart"));

export function MetricCards({
  range,
  siteId,
}: {
  range: Range;
  siteId?: string;
  activeCount?: number;
}) {
  const reduce = useReducedMotion();
  const workspace = useWorkspace(),
    summary = workspace.summary(siteId),
    traffic = workspace.traffic(siteId);
  const metrics = [
    {
      label: "Observed uptime",
      value: formatNumber(summary.uptime, 2),
      unit: summary.uptime == null ? "" : "%",
      icon: ShieldCheck,
      tone: "mint",
      note: `${formatNumber(summary.coverage, 1)}% monitoring coverage`,
    },
    {
      label: "Response time · p95",
      value: formatNumber(summary.p95),
      unit: summary.p95 == null ? "" : "ms",
      icon: Zap,
      tone: "blue",
      note: `p50 ${formatNumber(summary.p50)} · p99 ${formatNumber(summary.p99)} ms`,
    },
    {
      label: "Active visitors",
      value: formatNumber(traffic.active_visitors),
      unit: "",
      icon: Users,
      tone: "purple",
      note: "Seen in the last 60 seconds",
    },
    {
      label: "Page views",
      value: formatNumber(traffic.page_views),
      unit: "",
      icon: Globe2,
      tone: "peach",
      note: rangeLabels[range],
    },
  ];
  return (
    <div className="metrics-grid">
      {metrics.map(({ label, value, unit, icon: Icon, tone, note }, i) => (
        <motion.article
          key={label}
          className={`metric-card ${tone}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.25 }}
        >
          <div className="metric-label">
            {label}
            <span className="metric-icon">
              <Icon size={15} />
            </span>
          </div>
          <div className="metric-value-row">
            <div className="metric-value mono" key={value}>
              {value}
              <span>{unit}</span>
            </div>
            <div className="metric-spark">
              {tone === "blue" ? (
                <Sparkline
                  values={summary.chart
                    .slice(-22)
                    .map((p) =>
                      Math.min(
                        55,
                        10 + (p.total_ms / Math.max(1, summary.p99 || 1)) * 35,
                      ),
                    )}
                  color="var(--blue)"
                  filled
                />
              ) : tone === "mint" ? (
                <MetricRing value={summary.uptime} color="var(--chart-green)" />
              ) : tone === "purple" ? (
                <div className="metric-visitors-art" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <Users size={18} />
                </div>
              ) : (
                <div className="metric-page-bars" aria-hidden="true">
                  {traffic.top_pages.slice(0, 8).map((p, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${Math.max(8, (p.count / Math.max(1, ...traffic.top_pages.map((p) => p.count))) * 100)}%`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="metric-foot">
            <span>{note}</span>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

export function PerformancePanel({
  range,
  siteId,
  markers = [],
}: {
  range: Range;
  siteId?: string;
  markers?: { ts: string; version: string }[];
}) {
  const workspace = useWorkspace(),
    summary = workspace.summary(siteId);
  const [percentile, setPercentile] = useState<"p50" | "p95" | "p99">("p95"),
    [breakdown, setBreakdown] = useState(true),
    [table, setTable] = useState(false);
  return (
    <section className="panel performance-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Response time <span className="unit-label">ms</span>
          </h2>
          <p>
            {summary.count} observations · {rangeLabels[range]}
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => setBreakdown((v) => !v)}
          aria-pressed={breakdown}
        >
          {breakdown ? "Total response" : "Phase breakdown"}
        </button>
      </div>
      <div className="chart-summary">
        <div className="chart-number mono">
          {formatNumber(summary[percentile])}
          <span>{summary[percentile] == null ? "" : "ms"}</span>
        </div>
        <span className="chart-change">
          Apdex {formatNumber(summary.apdex, 2)}
        </span>
        <div
          className="segmented percentile-control"
          aria-label="Latency percentile"
        >
          {(["p50", "p95", "p99"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPercentile(p)}
              aria-pressed={percentile === p}
              className={percentile === p ? "selected" : ""}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<div className="chart-skeleton" />}>
        <LatencyChart
          range={range}
          percentile={percentile}
          siteId={siteId}
          breakdown={breakdown}
          markers={markers}
        />
      </Suspense>
      <div className="chart-footer">
        <span>
          <span className="tiny-dot" />
          {workspace.mode === "sample"
            ? "Sample data"
            : "Observed checks"} ·{" "}
          {siteId
            ? workspace.monitors.find((m) => m.id === siteId)?.name
            : `${workspace.monitors.length} monitors`}
        </span>
        <button
          onClick={() => setTable((v) => !v)}
          className="text-button"
          aria-expanded={table}
        >
          View chart data
        </button>
      </div>
      {summary.history_limited && (
        <p className="section-note inline-note">
          Older history uses completed hourly rollups. Partial boundary buckets
          can be absent; coverage makes the missing time explicit.
        </p>
      )}
      {table && (
        <div className="monitor-table-scroll chart-data-table">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Total</th>
                <th>DNS</th>
                <th>TCP</th>
                <th>TLS</th>
                <th>TTFB</th>
              </tr>
            </thead>
            <tbody>
              {summary.chart.slice(-100).map((p, i) => (
                <tr key={i}>
                  <td>{new Date(p.ts).toLocaleString()}</td>
                  <td>{p.ok ? "OK" : "Failed"}</td>
                  {[p.total_ms, p.dns_ms, p.tcp_ms, p.tls_ms, p.ttfb_ms].map(
                    (v, j) => (
                      <td key={j}>{formatNumber(v, 1)}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function HealthPanel({ monitors }: { monitors: Monitor[] }) {
  const workspace = useWorkspace(),
    quality = workspace.summary(),
    down = monitors.filter((m) => m.status === "down").length,
    degraded = monitors.filter((m) => m.status === "degraded").length,
    up = monitors.filter((m) => m.status === "operational").length,
    stale = monitors.filter((m) => workspace.summary(m.id).stale).length;
  return (
    <section className="panel health-panel">
      <div className="panel-heading">
        <h2>System health</h2>
        <span className="health-status">
          <StatusDot status={down ? "down" : "operational"} pulse />
          {workspace.mode === "sample"
            ? "Sample"
            : workspace.liveConnected
              ? "Live"
              : "Polling"}
        </span>
      </div>
      <div className="health-orbit quality-orbit">
        <ConcentricRings
          count={up}
          total={monitors.length}
          metrics={[
            {
              label: "Uptime",
              value: quality.uptime,
              color: "var(--chart-blue)",
            },
            {
              label: "Coverage",
              value: quality.coverage,
              color: "var(--chart-teal)",
            },
            {
              label: "Apdex",
              value: quality.apdex == null ? null : quality.apdex! * 100,
              color: "var(--chart-violet)",
            },
          ]}
        />
      </div>
      <div className="quality-rings-legend">
        {[
          {
            label: "Uptime",
            value: quality.uptime,
            color: "var(--chart-blue)",
          },
          {
            label: "Coverage",
            value: quality.coverage,
            color: "var(--chart-teal)",
          },
          {
            label: "Apdex",
            value: quality.apdex == null ? null : quality.apdex! * 100,
            color: "var(--chart-violet)",
          },
        ].map((metric) => (
          <div key={metric.label}>
            <span>
              <i style={{ background: metric.color }} />
              {metric.label}
            </span>
            <strong>
              {formatNumber(metric.value, 1)}
              <small>{metric.value == null ? "" : "%"}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="health-message">
        <h3>
          {down
            ? `${down} monitor${down > 1 ? "s are" : " is"} down`
            : stale
              ? "Waiting for fresh signals"
              : degraded
                ? "One signal to watch"
                : "Everything in sync"}
        </h3>
        <p>
          {stale
            ? `${stale} monitor${stale > 1 ? "s have" : " has"} stale or missing coverage.`
            : degraded
              ? `${degraded} monitor needs attention.`
              : "No active outage signals."}
        </p>
      </div>
      <div className="health-breakdown">
        <span>
          <StatusDot />
          Operational<strong className="mono">{up}</strong>
        </span>
        <span>
          <StatusDot status="degraded" />
          Degraded<strong className="mono">{degraded}</strong>
        </span>
        <span>
          <StatusDot status="down" />
          Down<strong className="mono">{down}</strong>
        </span>
      </div>
      <Link to="/status-pages" className="health-link">
        View status pages
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}

export function MonitorsPanel({
  monitors,
  onAdd,
  expanded = false,
}: {
  monitors: Monitor[];
  onAdd: () => void;
  expanded?: boolean;
}) {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState("all"),
    [group, setGroup] = useState("all"),
    [tag, setTag] = useState("all");
  const shown = monitors.filter(
    (m) =>
      (filter === "all" || m.status === filter) &&
      (group === "all" || (m.group || "Production") === group) &&
      (tag === "all" || m.tags?.includes(tag)),
  );
  const groups = [...new Set(monitors.map((m) => m.group || "Production"))],
    tags = [...new Set(monitors.flatMap((m) => m.tags || []))];
  return (
    <section className="panel monitors-panel">
      <div className="panel-heading">
        <div className="inline-heading">
          <h2>Your monitors</h2>
          <span className="count-badge mono">{monitors.length}</span>
        </div>
        <div className="monitor-actions">
          <label className="select-wrap">
            <select
              aria-label="Filter monitors by status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "operational", "degraded", "down", "pending"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v === "all" ? "All statuses" : v}
                  </option>
                ),
              )}
            </select>
            <ChevronDown size={12} />
          </label>
          {expanded ? (
            <button className="text-button" onClick={onAdd}>
              Add monitor
              <Plus size={13} />
            </button>
          ) : (
            <Link className="text-button" to="/monitors">
              View all
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
      {expanded && (
        <div className="monitor-filters">
          <label>
            Group
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">All tags</option>
              {tags.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="monitor-table-scroll">
        <table className="monitor-table">
          <thead>
            <tr>
              <th>Monitor</th>
              <th>Status</th>
              <th>
                Uptime <span>{workspace.range}</span>
              </th>
              <th>p95 response</th>
              <th>Visitors</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const s = workspace.summary(m.id),
                traffic = workspace.traffic(m.id);
              return (
                <tr key={m.id}>
                  <td>
                    <Link to={`/monitors/${m.id}`} className="monitor-identity">
                      <span
                        className="site-avatar"
                        style={
                          { "--site-color": m.color } as React.CSSProperties
                        }
                      >
                        {m.letter}
                      </span>
                      <span>
                        <strong>{m.name}</strong>
                        <span className="monitor-url" title={m.url}>
                          {m.url.replace(/^https?:\/\//, "")}
                          <ExternalLink size={10} />
                        </span>
                        <span className="monitor-group">
                          {m.group || "Production"}
                          {m.tags?.length ? ` · ${m.tags.join(", ")}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className={`status-label ${m.status}`}>
                      <StatusDot status={m.status} />
                      {s.maintenance
                        ? "Maintenance"
                        : s.stale
                          ? "Awaiting checks"
                          : m.status === "pending"
                            ? "Pending"
                            : m.status === "down"
                              ? "Down"
                              : m.status === "degraded"
                                ? "Degraded"
                                : "Operational"}
                    </span>
                  </td>
                  <td>
                    <div className="uptime-cell">
                      <strong className="mono">
                        {formatNumber(s.uptime, 2)}
                        {s.uptime != null ? "%" : ""}
                      </strong>
                      <UptimeStrip points={s.chart} count={36} />
                    </div>
                  </td>
                  <td>
                    <div className="response-cell">
                      <span className="mono">
                        {formatNumber(s.p95)}
                        <span className="muted">
                          {s.p95 != null ? " ms" : ""}
                        </span>
                      </span>
                      <Sparkline
                        values={s.chart
                          .slice(-22)
                          .map(
                            (p) =>
                              10 + (p.total_ms / Math.max(1, s.p99 || 1)) * 35,
                          )}
                        color={
                          m.status === "down"
                            ? "var(--down)"
                            : m.status === "degraded"
                              ? "var(--warning)"
                              : "var(--green)"
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <span className="visitor-count mono">
                      <span className="tiny-dot" />
                      {traffic.active_visitors}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/monitors/${m.id}`}
                      className="icon-button"
                      aria-label={`View ${m.name}`}
                    >
                      <MoreHorizontal size={17} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <div className="table-empty">No monitors match these filters.</div>
        )}
      </div>
      <div className="monitor-table-footer">
        <span>
          <Clock3 size={12} />
          {workspace.mode === "sample"
            ? "Sample history · connect a live workspace to start checks"
            : "Timed probes · missing coverage is never site downtime"}
        </span>
        <Link to="/docs">
          How monitoring works
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </section>
  );
}

export function ActivityPanel() {
  const workspace = useWorkspace();
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <h2>Recent incidents</h2>
        <Link className="text-button" to="/incidents">
          All activity
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="activity-list">
        {workspace.incidents.slice(0, 3).map((i) => (
          <Link
            to={`/monitors/${i.site_id}?tab=Incidents`}
            className="activity-item"
            key={i.id}
          >
            <span
              className={`activity-icon ${i.resolved_at ? "success" : "warning"}`}
            >
              {i.resolved_at ? <CircleCheck size={15} /> : <Zap size={15} />}
            </span>
            <div>
              <p>
                {i.resolved_at
                  ? "Service recovered"
                  : i.cause.replaceAll("_", " ")}
              </p>
              <span>
                {workspace.monitors.find((m) => m.id === i.site_id)?.name} ·{" "}
                {formatNumber(i.peak_latency_ms)} ms peak
              </span>
            </div>
            <time>
              {new Date(i.started_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </Link>
        ))}
        {!workspace.incidents.length && (
          <p className="table-empty">No incidents recorded.</p>
        )}
      </div>
    </section>
  );
}
export function InsightPanel() {
  const workspace = useWorkspace(),
    s = workspace.summary();
  return (
    <section className="insight-panel">
      <div className="insight-icon">
        <Sparkles size={20} />
      </div>
      <div>
        <span className="eyebrow">SIGNALS WITH CONTEXT</span>
        <h2>
          {s.insight ? "A change worth a look." : "Clarity, at a glance."}
        </h2>
        <p>
          {s.insight?.message ||
            `${formatNumber(s.coverage, 1)}% monitoring coverage in this period. Gaps and maintenance are excluded from site availability.`}
        </p>
        <Link to="/monitors">
          Explore your monitors
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="insight-decoration" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </section>
  );
}
export default function Dashboard({
  range,
  monitors,
  onAdd,
}: {
  range: Range;
  monitors: Monitor[];
  onAdd: () => void;
}) {
  const workspace = useWorkspace();
  return (
    <>
      <MetricCards range={range} />
      <div className="chart-grid">
        <PerformancePanel range={range} />
        <HealthPanel monitors={monitors} />
      </div>
      <MonitorsPanel monitors={monitors} onAdd={onAdd} />
      <div className="bottom-grid">
        <ActivityPanel />
        <InsightPanel />
      </div>
      <div className="workspace-footnote">
        <span>
          <Radio size={12} />
          {workspace.mode === "sample"
            ? "Illustrative sample data"
            : workspace.liveConnected
              ? "Live events connected"
              : "Live events reconnecting · polling every 30 seconds"}
        </span>
        <CreatorCredit />
      </div>
    </>
  );
}
