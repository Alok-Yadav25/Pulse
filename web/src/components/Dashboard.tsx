import { lazy, Suspense, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  Clock3,
  ExternalLink,
  Globe2,
  MoreHorizontal,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkline, StatusDot, Trend, UptimeStrip } from "./ui";
import type { Monitor, Range } from "../lib/demo";
import { rangeLabels } from "../lib/demo";

const LatencyChart = lazy(() => import("./LatencyChart"));
const metricSparks = [
  [
    28, 30, 27, 30, 25, 31, 29, 32, 30, 31, 28, 32, 30, 34, 31, 35, 32, 36, 33,
    37,
  ],
  [
    23, 27, 22, 37, 30, 44, 37, 39, 29, 35, 24, 30, 22, 28, 21, 29, 19, 23, 17,
    20,
  ],
  [
    13, 20, 17, 24, 21, 32, 24, 31, 25, 39, 33, 43, 36, 44, 40, 50, 45, 52, 48,
    54,
  ],
  [
    18, 16, 27, 23, 32, 27, 36, 30, 39, 34, 43, 36, 49, 43, 50, 42, 52, 46, 54,
    51,
  ],
];

export function MetricCards({
  range,
  activeCount,
}: {
  range: Range;
  activeCount: number;
}) {
  const metrics = [
    {
      label: "Overall uptime",
      value: "99.95",
      unit: "%",
      icon: ShieldCheck,
      change: "0.03%",
      note: "vs. previous period",
      spark: metricSparks[0],
      tone: "mint",
    },
    {
      label: "Avg. response time",
      value:
        range === "1h"
          ? "132"
          : range === "7d"
            ? "158"
            : range === "30d"
              ? "171"
              : "142",
      unit: "ms",
      icon: Zap,
      change: "12.4%",
      note: "vs. previous period",
      spark: metricSparks[1],
      tone: "blue",
      down: true,
    },
    {
      label: "Active visitors",
      value: activeCount.toString(),
      unit: "",
      icon: Users,
      change: "18.2%",
      note: "sample active visitors",
      spark: metricSparks[2],
      tone: "purple",
    },
    {
      label: "Total page views",
      value:
        range === "1h"
          ? "1,284"
          : range === "7d"
            ? "158,624"
            : range === "30d"
              ? "684,120"
              : "24,892",
      unit: "",
      icon: Globe2,
      change: "8.6%",
      note: "vs. previous period",
      spark: metricSparks[3],
      tone: "peach",
    },
  ];
  return (
    <div className="metrics-grid">
      {metrics.map(
        (
          { label, value, unit, icon: Icon, change, note, spark, tone, down },
          index,
        ) => (
          <motion.article
            className={`metric-card ${tone}`}
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.055, duration: 0.35 }}
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
                <Sparkline values={spark} color={`var(--${tone})`} filled />
              </div>
            </div>
            <div className="metric-foot">
              <Trend down={down}>{change}</Trend>
              <span>{note}</span>
            </div>
          </motion.article>
        ),
      )}
    </div>
  );
}

export function PerformancePanel({ range }: { range: Range }) {
  const [percentile, setPercentile] = useState<"p50" | "p95" | "p99">("p95");
  return (
    <section className="panel performance-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Response time <span className="unit-label">ms</span>
          </h2>
          <p>A little faster. A lot more peace of mind.</p>
        </div>
        <div className="chart-legend">
          <span className="legend-dot" />
          Response time
        </div>
      </div>
      <div className="chart-summary">
        <div className="chart-number mono">
          {percentile === "p50" ? "104" : percentile === "p99" ? "246" : "186"}
          <span>ms</span>
        </div>
        <span className="chart-change">
          <ArrowDownLeft size={13} />
          12.4% <span>vs. previous period</span>
        </span>
        <div
          className="segmented percentile-control"
          aria-label="Latency percentile"
        >
          {(["p50", "p95", "p99"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPercentile(p)}
              className={percentile === p ? "selected" : ""}
              aria-pressed={percentile === p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Suspense
        fallback={<div className="chart-skeleton" aria-label="Loading chart" />}
      >
        <LatencyChart range={range} percentile={percentile} />
      </Suspense>
      <div className="chart-footer">
        <span>
          <span className="tiny-dot" />
          All 4 demo monitors
        </span>
        <span>Sample data · {rangeLabels[range]}</span>
      </div>
    </section>
  );
}

export function HealthPanel({ monitors }: { monitors: Monitor[] }) {
  const up = monitors.filter((m) => m.status === "operational").length;
  const degraded = monitors.filter((m) => m.status === "degraded").length;
  return (
    <section className="panel health-panel">
      <div className="panel-heading">
        <h2>System health</h2>
        <span className="health-status">
          <StatusDot pulse />
          Demo
        </span>
      </div>
      <div className="health-orbit">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="orbit-core">
          <ShieldCheck size={33} strokeWidth={1.4} />
        </div>
        <span className="orbit-speck one" />
        <span className="orbit-speck two" />
        <span className="orbit-speck three" />
      </div>
      <div className="health-message">
        <h3>{degraded ? "Looking good overall" : "All systems look good"}</h3>
        <p>
          {degraded
            ? `${degraded} monitor needs a little attention.`
            : "Your demo workspace is healthy."}
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
          <span className="status-dot down" />
          Down<strong className="mono">0</strong>
        </span>
      </div>
      <Link to="/status/acme" className="health-link">
        View status page
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
  const [filter, setFilter] = useState<
    "all" | "operational" | "degraded" | "pending"
  >("all");
  const shown = monitors.filter((m) => filter === "all" || m.status === filter);
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
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">All statuses</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown size={12} />
          </label>
          {expanded ? (
            <button className="text-button" onClick={onAdd}>
              Add monitor
              <ArrowRight size={13} />
            </button>
          ) : (
            <Link className="text-button" to="/monitors">
              View all
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
      <div className="monitor-table-scroll">
        <table className="monitor-table">
          <thead>
            <tr>
              <th>Monitor</th>
              <th>Status</th>
              <th>
                Uptime <span>24h</span>
              </th>
              <th>Response time</th>
              <th>Visitors</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/monitors/${m.id}`} className="monitor-identity">
                    <span
                      className="site-avatar"
                      style={{ "--site-color": m.color } as React.CSSProperties}
                    >
                      {m.letter}
                    </span>
                    <span>
                      <strong>{m.name}</strong>
                      <span className="monitor-url">
                        {m.url}
                        <ExternalLink size={10} />
                      </span>
                    </span>
                  </Link>
                </td>
                <td>
                  <span className={`status-label ${m.status}`}>
                    <StatusDot status={m.status} />
                    {m.status === "pending"
                      ? "Pending setup"
                      : m.status === "operational"
                        ? "Operational"
                        : "Degraded"}
                  </span>
                </td>
                <td>
                  <div className="uptime-cell">
                    <strong className="mono">
                      {m.uptime}
                      {m.status !== "pending" && "%"}
                    </strong>
                    {m.status !== "pending" && (
                      <UptimeStrip
                        degraded={m.status === "degraded"}
                        count={36}
                      />
                    )}
                  </div>
                </td>
                <td>
                  <div className="response-cell">
                    <span className="mono">
                      {m.status === "pending" ? "—" : m.latency}
                      <span className="muted">
                        {m.status !== "pending" && " ms"}
                      </span>
                    </span>
                    {m.status !== "pending" && (
                      <Sparkline
                        values={m.history}
                        color={
                          m.status === "degraded"
                            ? "var(--warning)"
                            : "var(--green)"
                        }
                      />
                    )}
                  </div>
                </td>
                <td>
                  <span className="visitor-count mono">
                    {m.status === "pending" ? (
                      "—"
                    ) : m.visitors === 0 ? (
                      "—"
                    ) : (
                      <>
                        <span className="tiny-dot" />
                        {m.visitors}
                      </>
                    )}
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
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="table-empty">
            No {filter} monitors in this workspace.
          </div>
        )}
      </div>
      <div className="monitor-table-footer">
        <span>
          <Clock3 size={12} />
          60-second checks planned · sample history
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
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <h2>Recent activity</h2>
        <Link to="/incidents" className="text-button">
          All activity
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="activity-list">
        <div className="activity-item">
          <span className="activity-icon warning">
            <Zap size={15} />
          </span>
          <div>
            <p>
              Response time elevated{" "}
              <span className="activity-tag">Performance</span>
            </p>
            <span>
              Acme store <span className="separator">·</span> p95 reached 684 ms
            </span>
          </div>
          <time>12 min ago</time>
        </div>
        <div className="activity-item">
          <span className="activity-icon success">
            <CircleCheck size={15} />
          </span>
          <div>
            <p>
              Back to business as usual{" "}
              <span className="activity-tag">Resolved</span>
            </p>
            <span>
              Production API <span className="separator">·</span> Incident
              lasted 2 min
            </span>
          </div>
          <time>2 hours ago</time>
        </div>
      </div>
    </section>
  );
}

export function InsightPanel() {
  return (
    <section className="insight-panel">
      <div className="insight-icon">
        <Sparkles size={20} strokeWidth={1.4} />
      </div>
      <div>
        <span className="eyebrow">A LITTLE INSIGHT</span>
        <h2>Your site is getting faster.</h2>
        <p>
          Acme’s p95 response time improved by 12.4% in this sample period.
          Small wins add up.
        </p>
        <Link to="/monitors/acme">
          Explore performance
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="insight-decoration" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
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
  return (
    <>
      <MetricCards range={range} activeCount={242} />
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
          Demo workspace · illustrative data, no live probes
        </span>
        <span>
          Made for a little more peace of mind.
          <span className="mini-brand">✳</span>
        </span>
      </div>
    </>
  );
}
