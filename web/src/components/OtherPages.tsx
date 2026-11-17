import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Moon,
  Plus,
  Radio,
  ShieldCheck,
  Sun,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { EmptyState, Logo, Modal, StatusDot, UptimeStrip } from "./ui";
import { MetricCards, PerformancePanel } from "./Dashboard";
import Landing from "./Landing";
import { api, API_URL, download } from "../lib/api";
import { useWorkspace } from "../lib/workspace";
import { demoMonitors } from "../lib/demo";
import { sampleSummary } from "../lib/workspace-data";
import { formatNumber } from "../lib/workspace-data";
import type { Incident, Monitor, Range, Summary } from "../lib/workspace-types";

type Props = {
  monitors: Monitor[];
  range: Range;
  notify: (message: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  workspaceName: string;
  onWorkspaceChange: (name: string) => void;
  light: boolean;
  onThemeChange: (light: boolean) => void;
};
export default function OtherPages(props: Props) {
  const { pathname } = useLocation();
  if (pathname === "/welcome") return <Landing onAdd={props.onAdd} />;
  if (pathname.startsWith("/status/")) return <PublicStatus />;
  if (pathname.startsWith("/monitors/")) return <MonitorDetail {...props} />;
  if (pathname === "/traffic") return <Traffic range={props.range} />;
  if (pathname === "/incidents") return <Incidents />;
  if (pathname === "/status-pages")
    return <StatusPages notify={props.notify} />;
  if (pathname === "/settings") return <Settings {...props} />;
  if (pathname === "/docs") return <Documentation />;
  if (pathname === "/privacy") return <Privacy />;
  return (
    <EmptyState
      icon={<Globe2 size={25} />}
      title="Page not found"
      text="Your workspace is right this way."
      action={
        <Link to="/" className="button button-primary">
          Back to overview
          <ArrowRight size={15} />
        </Link>
      }
    />
  );
}

function RankCard({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <Globe2 size={16} />
      </div>
      <div className="ranking-list">
        {rows.map((row) => (
          <div className="ranking-row" key={row.name}>
            <span
              className="ranking-fill"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
            <span className="mono">{row.name}</span>
            <strong className="mono">{formatNumber(row.count)}</strong>
          </div>
        ))}
        {!rows.length && <p className="table-empty">No observations yet.</p>}
      </div>
    </section>
  );
}
function Traffic({ range, siteId }: { range: Range; siteId?: string }) {
  const workspace = useWorkspace(),
    [selected, setSelected] = useState(siteId || "all"),
    data = workspace.traffic(selected === "all" ? undefined : selected),
    vitalSite = selected === "all" ? workspace.monitors[0]?.id : selected,
    vitals = workspace.traffic(vitalSite).vitals;
  return (
    <>
      <div className="traffic-toolbar">
        <label>
          Traffic for
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">All monitors</option>
            {workspace.monitors.map((site) => (
              <option value={site.id} key={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <span className="subtle-badge">
          {workspace.mode === "sample"
            ? "Sample analytics"
            : "Measured analytics"}
        </span>
      </div>
      <MetricCards
        range={range}
        siteId={selected === "all" ? undefined : selected}
      />
      <div className="traffic-grid">
        <RankCard title="Top pages" rows={data.top_pages} />
        <RankCard title="Referrers" rows={data.referrers} />
        <RankCard title="Devices" rows={data.devices} />
        <RankCard title="Timezones" rows={data.timezones} />
      </div>
      <section className="panel vitals-card">
        <div className="panel-heading">
          <div>
            <h2>Core Web Vitals · p75</h2>
            <p>
              {workspace.monitors.find((m) => m.id === vitalSite)?.name ||
                "No monitor selected"}{" "}
              · {data.vitals_window || range}
            </p>
          </div>
          <span className="subtle-badge">
            {data.unique_visitors_approximate
              ? "Historical unique counts approximate"
              : "Observed events"}
          </span>
        </div>
        <div className="vitals-grid">
          {[
            ["lcp_ms", "LCP", "ms"],
            ["inp_ms", "INP", "ms"],
            ["cls", "CLS", ""],
          ].map(([key, name, unit]) => (
            <div key={key}>
              <span>{name}</span>
              <strong className="mono">
                {formatNumber(vitals[key]?.p75, key === "cls" ? 3 : 0)}
                <small>{vitals[key]?.p75 != null ? unit : ""}</small>
              </strong>
              <span className={`vital-band ${vitals[key]?.band || "unknown"}`}>
                {vitals[key]?.band?.replaceAll("-", " ") || "No data"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="section-note">
        Page views: {formatNumber(data.page_views)} · Unique visitor estimates:{" "}
        {formatNumber(data.unique_visitors)}
        {data.unique_visitors_approximate
          ? " (sum of retained hourly uniques; repeat visitors may be counted more than once)"
          : ""}
        . Vitals require tracker events and supported browser APIs.
      </p>
    </>
  );
}

function Incidents({ siteId }: { siteId?: string }) {
  const workspace = useWorkspace(),
    [filter, setFilter] = useState("All incidents"),
    [expanded, setExpanded] = useState<string | null>(null);
  const rows = workspace.incidents.filter(
    (i) =>
      (!siteId || i.site_id === siteId) &&
      (filter === "All incidents" ||
        (filter === "Open" ? !i.resolved_at : !!i.resolved_at)),
  );
  return (
    <>
      <div className="incidents-toolbar">
        <div className="segmented">
          {["All incidents", "Open", "Resolved"].map((v) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="subtle-badge">
          {workspace.mode === "sample"
            ? "Sample timeline"
            : "Recorded timeline"}
        </span>
      </div>
      <section className="panel incident-list">
        {rows.map((i) => (
          <article className="incident-row" key={i.id}>
            <button
              onClick={() => setExpanded(expanded === i.id ? null : i.id)}
              aria-expanded={expanded === i.id}
            >
              <span
                className={`activity-icon ${i.resolved_at ? "success" : "warning"}`}
              >
                {i.resolved_at ? (
                  <CheckCheck size={18} />
                ) : (
                  <TriangleAlert size={18} />
                )}
              </span>
              <span>
                <strong>{i.cause.replaceAll("_", " ")}</strong>
                <span>
                  {workspace.monitors.find((m) => m.id === i.site_id)?.name} ·{" "}
                  {new Date(i.started_at).toLocaleString()}
                </span>
              </span>
              <span
                className={`incident-status ${i.resolved_at ? "resolved" : ""}`}
              >
                {i.resolved_at ? "Resolved" : "Open"}
              </span>
            </button>
            {expanded === i.id && (
              <div className="incident-expanded">
                <p>
                  Peak latency: {formatNumber(i.peak_latency_ms, 1)} ms ·{" "}
                  {i.resolved_at
                    ? `Duration: ${Math.round((Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 1000)} seconds`
                    : "Still investigating"}
                  .
                </p>
                <p>{i.notes}</p>
                <div className="incident-actions">
                  <Link to={`/monitors/${i.site_id}`}>
                    View monitor
                    <ArrowUpRight size={13} />
                  </Link>
                  {workspace.mode === "live" && (
                    <button
                      className="text-button"
                      onClick={() =>
                        void download(
                          `/api/sites/${i.site_id}/incidents/${i.id}/report`,
                          `pulse-incident-${i.id}.md`,
                        ).catch((e) => window.alert(e.message))
                      }
                    >
                      <Download size={14} />
                      Download report
                    </button>
                  )}
                  {workspace.monitors.find((m) => m.id === i.site_id)
                    ?.public_status && (
                    <Link
                      to={`/status/${workspace.monitors.find((m) => m.id === i.site_id)?.slug}/incidents/${i.id}`}
                    >
                      Public incident
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
        {!rows.length && (
          <div className="table-empty">No incidents match this filter.</div>
        )}
      </section>
    </>
  );
}

function MonitorDetail(props: Props) {
  const workspace = useWorkspace(),
    { pathname } = useLocation(),
    id = pathname.split("/")[2],
    site = workspace.monitors.find((m) => m.id === id);
  const [params, setParams] = useSearchParams(),
    tab = params.get("tab") || "Overview",
    [confirm, setConfirm] = useState(false);
  const tabs = [
    "Overview",
    "Performance",
    "Traffic",
    "Incidents",
    "Profile",
    "Settings",
  ];
  const releases = useQuery({
    queryKey: ["deployments", id],
    queryFn: () =>
      api<{ id: string; ts: string; version: string; notes: string }[]>(
        `/api/sites/${id}/deployments`,
      ),
    enabled: workspace.mode === "live" && !!site,
  });
  if (!site)
    return (
      <EmptyState
        icon={<Activity size={25} />}
        title={workspace.loading ? "Loading monitor…" : "Monitor not found"}
        text="Check your connection or return to the monitor list."
        action={
          <Link to="/monitors" className="button button-primary">
            View monitors
          </Link>
        }
      />
    );
  const summary = workspace.summary(id);
  return (
    <>
      <div className="detail-heading">
        <span
          className="site-avatar large"
          style={{ "--site-color": site.color } as React.CSSProperties}
        >
          {site.letter}
        </span>
        <div>
          <h2>{site.name}</h2>
          <span className="detail-url" title={site.url}>
            {site.url}
          </span>
        </div>
        <span className={`status-label ${site.status}`}>
          <StatusDot status={site.status} />
          {summary.maintenance ? "Maintenance" : site.status}
        </span>
      </div>
      <div className="detail-tabs" role="tablist" aria-label="Monitor sections">
        {tabs.map((name, index) => (
          <button
            key={name}
            id={`tab-${name}`}
            role="tab"
            aria-selected={tab === name}
            aria-controls="monitor-tab-panel"
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setParams({ tab: name })}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : e.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : null;
              if (next != null) {
                e.preventDefault();
                setParams({ tab: tabs[next] });
                (
                  e.currentTarget.parentElement?.querySelectorAll("button")[
                    next
                  ] as HTMLButtonElement
                )?.focus();
              }
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="monitor-tab-panel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "Overview" || tab === "Performance" ? (
          <>
            <MetricCards range={props.range} siteId={id} />
            <Coverage summary={summary} />
            <PerformancePanel
              range={props.range}
              siteId={id}
              markers={releases.data || []}
            />
            {!summary.count && (
              <div className="pending-notice">
                <Clock3 size={20} />
                <div>
                  <h2>Ready for its first heartbeat.</h2>
                  <p>
                    {workspace.mode === "sample"
                      ? "This sample-mode monitor is saved locally. Connect a live workspace to run checks."
                      : "The scheduler will probe this URL shortly. Missing observations remain unknown."}
                  </p>
                </div>
              </div>
            )}
            <section className="panel history-panel">
              <div className="panel-heading">
                <h2>Observed check history</h2>
                <span className="subtle-badge">{props.range}</span>
              </div>
              <UptimeStrip points={summary.chart} count={90} />
              <div className="history-labels">
                <span>Earlier observations</span>
                <span>Most recent</span>
              </div>
            </section>
            {releases.data?.length ? (
              <section className="panel release-list">
                <div className="panel-heading">
                  <h2>Deployment markers</h2>
                </div>
                {releases.data.map((release) => (
                  <div key={release.id}>
                    <Code2 size={15} />
                    <strong>{release.version}</strong>
                    <span>{new Date(release.ts).toLocaleString()}</span>
                    <p>{release.notes}</p>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : tab === "Traffic" ? (
          <Traffic range={props.range} siteId={id} />
        ) : tab === "Incidents" ? (
          <Incidents siteId={id} />
        ) : tab === "Profile" ? (
          <Profile site={site} notify={props.notify} />
        ) : (
          <MonitorSettings
            site={site}
            notify={props.notify}
            onDelete={() => setConfirm(true)}
          />
        )}
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${site.name}?`}
        description="This permanently deletes the monitor and all associated checks, visitor events, incidents, releases, and alert configuration."
      >
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setConfirm(false)}
          >
            Keep monitor
          </button>
          <button
            className="button button-danger"
            onClick={() => props.onDelete(id)}
          >
            Delete monitor
          </button>
        </div>
      </Modal>
    </>
  );
}
function Coverage({ summary }: { summary: Summary }) {
  return (
    <section className="coverage-strip">
      <div>
        <span>Monitoring coverage</span>
        <strong>{formatNumber(summary.coverage, 1)}%</strong>
      </div>
      <div>
        <span>Last check</span>
        <strong>
          {summary.last_checked_at
            ? new Date(summary.last_checked_at).toLocaleString()
            : "Not observed"}
        </strong>
      </div>
      <div>
        <span>Last successful check</span>
        <strong>
          {summary.last_success_at
            ? new Date(summary.last_success_at).toLocaleString()
            : "Not observed"}
        </strong>
      </div>
      <div>
        <span>Certificate expires in</span>
        <strong>
          {summary.tls_days_left == null
            ? "Not available"
            : `${summary.tls_days_left} days`}
        </strong>
      </div>
      <p>
        {summary.stale
          ? "Measurements are stale or missing. No uptime is assumed."
          : summary.maintenance
            ? "Maintenance is active. Probes continue; new incident alerts are suppressed."
            : `${formatNumber(summary.excluded_s)} seconds of gaps and maintenance excluded.`}
      </p>
    </section>
  );
}

type WindowRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
};
type Channel = {
  id: string;
  type: string;
  cooldown_s: number;
  enabled: boolean;
};
function MonitorSettings({
  site,
  notify,
  onDelete,
}: {
  site: Monitor;
  notify: Props["notify"];
  onDelete: () => void;
}) {
  const workspace = useWorkspace(),
    client = useQueryClient(),
    [name, setName] = useState(site.name),
    [url, setUrl] = useState(site.url),
    [group, setGroup] = useState(site.group || "Production"),
    [tags, setTags] = useState((site.tags || []).join(", ")),
    [interval, setInterval] = useState(site.interval_s || 60),
    [publicPage, setPublicPage] = useState(site.public_status || false),
    [codes, setCodes] = useState(
      (site.assertions?.status_codes || []).join(","),
    ),
    [contains, setContains] = useState(site.assertions?.contains || ""),
    [jsonPath, setJsonPath] = useState(site.assertions?.json_path || ""),
    [equals, setEquals] = useState(
      JSON.stringify(site.assertions?.equals ?? null),
    ),
    [maxMs, setMaxMs] = useState(site.assertions?.max_ms || 10000),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState("Scheduled maintenance"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [version, setVersion] = useState(""),
    [notes, setNotes] = useState(""),
    [target, setTarget] = useState(""),
    [chatId, setChatId] = useState(""),
    [channelType, setChannelType] = useState("webhook"),
    [cooldown, setCooldown] = useState(300);
  const enabled = workspace.mode === "live",
    readonly = !enabled || workspace.user?.demo;
  const windows = useQuery({
    queryKey: ["maintenance", site.id],
    queryFn: () => api<WindowRow[]>(`/api/sites/${site.id}/maintenance`),
    enabled,
  });
  const channels = useQuery({
    queryKey: ["alerts", site.id],
    queryFn: () =>
      api<{
        channels: Channel[];
        deliveries: {
          id: string;
          status: string;
          attempts: number;
          ts: string;
        }[];
      }>(`/api/sites/${site.id}/alerts`),
    enabled,
  });
  async function mutate(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(`/api/sites/${site.id}${path}`, {
        method,
        body: body == null ? undefined : JSON.stringify(body),
      });
      void client.invalidateQueries();
      notify("Changes saved.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const snippet = `<script defer src="${API_URL}/t.js?v=1" data-key="${site.site_key || "YOUR_SITE_KEY"}"></script>`;
  return (
    <div className="settings-layout">
      {readonly && (
        <div className="form-note">
          <LockKeyhole size={17} />
          {enabled
            ? "The demo monitor is read-only. Use Break it to test its incident state machine."
            : "Configuration controls become available after connecting a live workspace."}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Monitor configuration</h2>
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            let equalValue;
            try {
              equalValue = JSON.parse(equals);
            } catch {
              setError(
                'Expected JSON value must be valid JSON, such as true, 42, or "ready".',
              );
              return;
            }
            void mutate(
              "",
              {
                name,
                url,
                group,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                interval_s: interval,
                public_status: publicPage,
                assertions: {
                  status_codes: codes ? codes.split(",").map(Number) : [],
                  contains,
                  json_path: jsonPath,
                  equals: equalValue,
                  max_ms: maxMs,
                },
              },
              "PATCH",
            );
          }}
        >
          <fieldset disabled={readonly || busy}>
            <label>
              Monitor name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
              />
            </label>
            <label>
              Complete URL
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                type="url"
                maxLength={2048}
              />
            </label>
            <div className="form-grid">
              <label>
                Group
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  maxLength={40}
                  required
                />
              </label>
              <label>
                Tags, separated by commas
                <input value={tags} onChange={(e) => setTags(e.target.value)} />
              </label>
              <label>
                Check interval (seconds)
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                />
              </label>
              <label>
                Latency failure threshold (ms)
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={maxMs}
                  onChange={(e) => setMaxMs(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={publicPage}
                onChange={(e) => setPublicPage(e.target.checked)}
              />
              Enable public status page and badge
            </label>
            <h3>Response assertions</h3>
            <p className="section-note">
              Optional. Three failed checks confirm an incident. JSON assertions
              use a simple dotted path, such as data.status or items.0.id.
            </p>
            <label>
              Expected HTTP codes (comma separated)
              <input
                value={codes}
                onChange={(e) => setCodes(e.target.value)}
                placeholder="200,204"
              />
            </label>
            <label>
              Required response text
              <input
                value={contains}
                onChange={(e) => setContains(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="form-grid">
              <label>
                JSON path
                <input
                  value={jsonPath}
                  onChange={(e) => setJsonPath(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label>
                Expected JSON value
                <input
                  value={equals}
                  onChange={(e) => setEquals(e.target.value)}
                />
              </label>
            </div>
            <button className="button button-primary" type="submit">
              Save configuration
              <Check size={14} />
            </button>
          </fieldset>
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Install and verify analytics</h2>
          <Code2 size={17} />
        </div>
        <div className="settings-body">
          <p>
            Install this script on the exact origin configured above. No
            cookies; page queries and referrer paths are stripped.
          </p>
          <code className="snippet-code">{snippet}</code>
          <button
            className="button button-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(snippet);
                notify("Tracker snippet copied.");
              } catch {
                notify("Clipboard unavailable. Select the snippet to copy.");
              }
            }}
          >
            <Copy size={14} />
            Copy snippet
          </button>
          <div
            className={`tracker-status ${workspace.traffic(site.id).page_views > 0 ? "verified" : ""}`}
          >
            <StatusDot
              status={
                workspace.traffic(site.id).page_views > 0
                  ? "operational"
                  : "pending"
              }
              pulse
            />
            <span>
              {!enabled
                ? "Connect live to verify tracker events"
                : workspace.traffic(site.id).page_views > 0
                  ? "Tracker verified · page views received"
                  : "Waiting for first event…"}
            </span>
          </div>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Maintenance windows</h2>
          <Clock3 size={17} />
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/maintenance", {
              title,
              starts_at: new Date(start).toISOString(),
              ends_at: new Date(end).toISOString(),
            });
          }}
        >
          <fieldset disabled={readonly || busy}>
            <label>
              Window title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <div className="form-grid">
              <label>
                Start (your local time)
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label>
                End (your local time)
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </label>
            </div>
            <button className="button button-primary" type="submit">
              Schedule maintenance
              <Plus size={14} />
            </button>
          </fieldset>
          {windows.data?.map((w) => (
            <div className="resource-row" key={w.id}>
              <span>
                <strong>{w.title}</strong>
                <small>
                  {new Date(w.starts_at).toLocaleString()} —{" "}
                  {new Date(w.ends_at).toLocaleString()}
                </small>
              </span>
              <button
                className="text-button"
                type="button"
                disabled={readonly || busy}
                onClick={() =>
                  void mutate(`/maintenance/${w.id}`, null, "DELETE")
                }
              >
                Cancel
              </button>
            </div>
          ))}
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Deployment markers</h2>
          <Code2 size={17} />
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/deployments", { version, notes }).then((ok) => {
              if (ok) {
                setVersion("");
                setNotes("");
              }
            });
          }}
        >
          <fieldset disabled={readonly || busy}>
            <label>
              Version or commit
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.2.0 or 4f82a1c"
                maxLength={100}
                required
              />
            </label>
            <label>
              Release notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
              />
            </label>
            <button className="button button-primary" type="submit">
              Record deployment
              <Plus size={14} />
            </button>
          </fieldset>
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Grouped alerts and cooldowns</h2>
          <Radio size={17} />
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/alerts", {
              type: channelType,
              target,
              chat_id: chatId,
              cooldown_s: cooldown,
            }).then((ok) => {
              if (ok) setTarget("");
            });
          }}
        >
          <fieldset disabled={readonly || busy}>
            <div className="form-grid">
              <label>
                Channel type
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                >
                  <option value="webhook">Generic webhook</option>
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                  <option value="telegram">Telegram</option>
                </select>
              </label>
              <label>
                Cooldown (seconds)
                <input
                  type="number"
                  min={60}
                  max={86400}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              {channelType === "telegram"
                ? "Telegram Bot API sendMessage URL"
                : "HTTPS webhook URL"}
              <input
                type="url"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://…"
                required
                maxLength={2048}
                autoComplete="off"
              />
            </label>
            {channelType === "telegram" && (
              <label>
                Telegram chat ID
                <input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-100… or @channel"
                  required
                  maxLength={100}
                  autoComplete="off"
                />
              </label>
            )}
            <button className="button button-primary" type="submit">
              Add alert channel
              <Plus size={14} />
            </button>
          </fieldset>
          <p className="section-note">
            One opening and one recovery notification per incident and channel.
            Cooldowns defer delivery; failed requests retry up to three times.
            Webhook redirects are rejected.
          </p>
          {channels.data?.channels.map((c) => (
            <div className="resource-row" key={c.id}>
              <span>
                <strong>{c.type}</strong>
                <small>
                  {c.cooldown_s}s cooldown ·{" "}
                  {c.enabled ? "Enabled" : "Disabled"}
                </small>
              </span>
              <button
                className="text-button"
                type="button"
                disabled={readonly || busy}
                onClick={() => void mutate(`/alerts/${c.id}`, null, "DELETE")}
              >
                Remove
              </button>
            </div>
          ))}
          {channels.data?.deliveries.map((d) => (
            <div className="resource-row" key={d.id}>
              <span>
                {d.status} · {d.attempts} attempts
              </span>
              <small>{new Date(d.ts).toLocaleString()}</small>
            </div>
          ))}
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="settings-body">
          <button
            className="button button-danger"
            disabled={workspace.mode === "live" && workspace.user?.demo}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            {workspace.mode === "sample"
              ? "Delete local monitor"
              : "Delete monitor and all data"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Profile({ site, notify }: { site: Monitor; notify: Props["notify"] }) {
  const workspace = useWorkspace(),
    client = useQueryClient(),
    [busy, setBusy] = useState(false),
    query = useQuery({
      queryKey: ["profile", site.id],
      queryFn: () =>
        api<{
          data: Record<string, unknown> | null;
          fetched_at: string | null;
        }>(`/api/sites/${site.id}/profile`),
      enabled: workspace.mode === "live",
    }),
    data = query.data?.data;
  return (
    <section className="panel profile-panel">
      <span className="eyebrow">SITE PROFILE</span>
      <h2>What does {site.name} do?</h2>
      {data ? (
        <>
          <p>{String(data.summary)}</p>
          <div className="profile-tags">
            {[
              String(data.category),
              ...(Array.isArray(data.stack) ? data.stack.map(String) : []),
            ].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div className="profile-security">
            <ShieldCheck size={22} />
            <div>
              <strong>
                Security header presence: {String(data.security_score)}/100
              </strong>
              <p>
                Presence is not a security audit. Cached{" "}
                {new Date(query.data!.fetched_at!).toLocaleString()}.
              </p>
            </div>
          </div>
        </>
      ) : (
        <p>
          No profile has been fetched yet. Refresh to analyze the homepage
          through the SSRF-safe client.
        </p>
      )}
      <button
        className="button button-secondary profile-refresh"
        disabled={workspace.mode === "sample" || workspace.user?.demo || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/sites/${site.id}/profile/refresh`, {
              method: "POST",
            });
            void client.invalidateQueries({ queryKey: ["profile", site.id] });
          } catch (e) {
            notify((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Analyzing…" : "Refresh profile"}
      </button>
      {query.error && <p className="form-error">{query.error.message}</p>}
    </section>
  );
}

function StatusPages({ notify }: { notify: Props["notify"] }) {
  const workspace = useWorkspace(),
    sites =
      workspace.mode === "sample"
        ? workspace.monitors.slice(0, 1)
        : workspace.monitors.filter((m) => m.public_status);
  return (
    <div className="status-pages-list">
      {sites.map((site) => (
        <section className="panel status-page-card" key={site.id}>
          <div className="status-page-preview">
            <div>
              <Logo />
              <span>System status</span>
            </div>
            <div className="status-page-banner">
              <StatusDot status={site.status} />
              {site.name}
            </div>
            <div className="status-mini-bars">
              <UptimeStrip
                points={workspace.summary(site.id).chart}
                count={35}
              />
            </div>
          </div>
          <div className="status-page-info">
            <span className="eyebrow">
              {workspace.mode === "sample"
                ? "SAMPLE PAGE"
                : "PUBLIC STATUS PAGE"}
            </span>
            <h2>{site.name}</h2>
            <p>
              Observed availability, maintenance, and incident updates. Public
              responses exclude private target paths, queries, and tracker keys.
            </p>
            <div>
              <Link
                className="button button-primary"
                to={`/status/${site.slug || "acme"}`}
              >
                View page
                <ArrowUpRight size={14} />
              </Link>
              <button
                className="button button-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${location.origin}/status/${site.slug || "acme"}`,
                    );
                    notify("Status page link copied.");
                  } catch {
                    notify("Open the page to copy its address.");
                  }
                }}
              >
                <Copy size={14} />
                Copy link
              </button>
            </div>
            {workspace.mode === "live" && (
              <code className="badge-code">
                ![Uptime]({API_URL}/badge/{site.slug}.svg)
              </code>
            )}
          </div>
        </section>
      ))}
      {!sites.length && (
        <EmptyState
          icon={<Globe2 size={24} />}
          title="Share your first status page."
          text="Enable Public status page in a monitor’s settings to publish observed service health."
          action={
            <Link to="/monitors" className="button button-primary">
              Choose a monitor
              <ArrowRight size={14} />
            </Link>
          }
        />
      )}
    </div>
  );
}
function PublicStatus() {
  const { pathname } = useLocation(),
    slug = pathname.split("/")[2],
    incidentId = pathname.split("/")[4],
    sample = slug === "acme";
  const query = useQuery({
    queryKey: ["public", slug],
    queryFn: () =>
      api<{
        site: { name: string; status: Monitor["status"]; demo: boolean };
        summary: Summary;
        incidents: Incident[];
        maintenance: WindowRow[];
      }>(`/api/public/${slug}`),
    enabled: !sample,
    refetchInterval: 30000,
  });
  if (!sample && !query.data)
    return (
      <div className="public-status">
        <EmptyState
          icon={<Globe2 size={24} />}
          title={
            query.isPending
              ? "Loading service status…"
              : "Status page unavailable"
          }
          text={
            query.error?.message || "Fetching the latest public observation."
          }
          action={
            <button
              className="button button-secondary"
              onClick={() => void query.refetch()}
            >
              Retry
            </button>
          }
        />
      </div>
    );
  const sites = sample
      ? demoMonitors
      : [
          {
            id: slug,
            name: query.data!.site.name,
            status: query.data!.site.status,
          },
        ],
    summary = sample
      ? sampleSummary(demoMonitors[0], "24h")
      : query.data!.summary,
    incidents = sample
      ? [
          {
            id: "sample-store",
            site_id: "store",
            started_at: new Date(Date.now() - 720000).toISOString(),
            resolved_at: null,
            cause: "slow",
            peak_latency_ms: 684,
            notes: "Illustrative sample incident.",
          },
        ]
      : query.data!.incidents,
    visibleIncident = incidentId
      ? incidents.find((i) => i.id === incidentId)
      : null,
    status = sample ? "degraded" : query.data!.site.status;
  return (
    <div className="public-status">
      <header>
        <Link to="/welcome">
          <Logo />
        </Link>
        <span>{sample ? "Acme" : query.data!.site.name} / System status</span>
        <Link to="/">
          Dashboard
          <ArrowUpRight size={13} />
        </Link>
      </header>
      <div className="status-public-eyebrow">
        <span className="eyebrow">A LITTLE TRANSPARENCY</span>
        <span className="subtle-badge">
          {sample
            ? "Sample status page"
            : summary.stale
              ? "Data is stale"
              : "Observed service health"}
        </span>
      </div>
      <h1>{incidentId ? "Incident update" : "Keeping you in the loop."}</h1>
      <p>Uptime, updates, and everything in between.</p>
      <div className="public-health-banner">
        <Activity size={25} />
        <div>
          <h2>
            {summary.stale && !sample
              ? "Waiting for fresh observations."
              : status === "down"
                ? "This service is experiencing an outage."
                : status === "degraded"
                  ? "Some systems are a little slow."
                  : "All observed systems are operational."}
          </h2>
          <p>
            {summary.last_checked_at
              ? `Last observation: ${new Date(summary.last_checked_at).toLocaleString()}`
              : "No checks have been recorded."}
          </p>
        </div>
        <StatusDot status={status} />
      </div>
      {incidentId ? (
        <section className="panel privacy-panel">
          <h2>
            {visibleIncident?.cause.replaceAll("_", " ") ||
              "Incident not found"}
          </h2>
          <p>
            {visibleIncident
              ? `${new Date(visibleIncident.started_at).toLocaleString()} · ${visibleIncident.resolved_at ? "Resolved" : "Open"} · ${visibleIncident.peak_latency_ms} ms peak latency.`
              : "This incident is not available on this public page."}
          </p>
          <p>{visibleIncident?.notes}</p>
        </section>
      ) : (
        <>
          <div className="public-status-monitors">
            {sites.map((site) => {
              const data = sample
                ? sampleSummary(
                    demoMonitors.find((m) => m.id === site.id)!,
                    "24h",
                  )
                : summary;
              return (
                <section key={site.id}>
                  <div>
                    <h3>{site.name}</h3>
                    <span className={`status-label ${site.status}`}>
                      <StatusDot status={site.status} />
                      {site.status}
                    </span>
                  </div>
                  <UptimeStrip points={data.chart} count={90} />
                  <div className="history-labels">
                    <span>Observed history</span>
                    <span className="mono">
                      {formatNumber(data.uptime, 2)}% uptime
                    </span>
                    <span>{formatNumber(data.coverage, 1)}% coverage</span>
                  </div>
                </section>
              );
            })}
          </div>
          {query.data?.maintenance.map((w) => (
            <div className="pending-notice" key={w.id}>
              <Clock3 size={18} />
              <p>
                {w.title} · {new Date(w.starts_at).toLocaleString()} —{" "}
                {new Date(w.ends_at).toLocaleString()}
              </p>
            </div>
          ))}
          <section className="panel public-incidents">
            <div className="panel-heading">
              <h2>Recent incidents</h2>
            </div>
            {incidents.map((i) => (
              <Link key={i.id} to={`/status/${slug}/incidents/${i.id}`}>
                <span>
                  {i.cause.replaceAll("_", " ")}
                  <small>{new Date(i.started_at).toLocaleString()}</small>
                </span>
                <span>
                  {i.resolved_at ? "Resolved" : "Open"}
                  <ArrowUpRight size={13} />
                </span>
              </Link>
            ))}
            {!incidents.length && (
              <p className="table-empty">No incidents recorded.</p>
            )}
          </section>
        </>
      )}
      <footer>
        <Link to="/welcome">
          <Logo small />
          Powered by Pulse
        </Link>
        <span>
          {sample
            ? "Illustrative data"
            : "Gaps are excluded from site downtime"}
        </span>
      </footer>
    </div>
  );
}

function Settings(props: Props) {
  const [name, setName] = useState(props.workspaceName),
    workspace = useWorkspace();
  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Your workspace</h2>
          <span className="subtle-badge">
            {workspace.mode === "live" ? workspace.user?.email : "Sample mode"}
          </span>
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            props.onWorkspaceChange(name.trim());
            props.notify("Workspace preference updated.");
          }}
        >
          <label>
            Workspace name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              pattern=".*\S.*"
            />
          </label>
          <div className="settings-save">
            <span className="muted">
              The display name is a browser preference.
            </span>
            <button type="submit" className="button button-primary">
              Save changes
              <Check size={14} />
            </button>
          </div>
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Appearance</h2>
        </div>
        <div className="settings-body">
          <div className="theme-options">
            <button
              className={!props.light ? "selected" : ""}
              onClick={() => props.onThemeChange(false)}
              aria-pressed={!props.light}
            >
              <Moon size={19} />
              <strong>After hours</strong>
              <span>A calm, dark workspace.</span>
            </button>
            <button
              className={props.light ? "selected" : ""}
              onClick={() => props.onThemeChange(true)}
              aria-pressed={props.light}
            >
              <Sun size={19} />
              <strong>Daylight</strong>
              <span>A little more brightness.</span>
            </button>
          </div>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Privacy and data</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="settings-body">
          <p>
            Live monitors and their analytics are stored in Postgres. Deleting a
            monitor removes all associated data. Browser preferences and the
            explicit sample workspace are stored locally.
          </p>
          <Link to="/privacy" className="text-button">
            Read the privacy notes
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
function Documentation() {
  return (
    <div className="docs-layout">
      <section className="panel docs-hero">
        <span className="eyebrow">OBSERVABILITY WITH CONTEXT</span>
        <h2>
          Every heartbeat.
          <br />
          <span>A clearer picture.</span>
        </h2>
        <p>
          Connect live to sign in or create an account. Add a complete public
          URL, then inspect timed checks, traffic, incidents, and monitoring
          coverage. Sample mode is explicitly labeled and never substituted
          after a live API error.
        </p>
        <div className="docs-links">
          <Link to="/welcome" className="button button-secondary">
            Meet Pulse
            <ArrowUpRight size={14} />
          </Link>
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            API documentation
            <ExternalLink size={14} />
          </a>
        </div>
      </section>
      <div className="docs-grid">
        {[
          {
            icon: Activity,
            title: "Safe public-network probes",
            body: "HTTP and HTTPS targets are resolved on every request and redirect. All returned addresses must be public, and connections are pinned to a validated IP while preserving Host and TLS SNI.",
          },
          {
            icon: Radio,
            title: "Confirmed incidents",
            body: "Three failed checks open an incident. Two successful checks close it. Maintenance suppresses new alerts, and missing monitoring coverage is never counted as site downtime.",
          },
          {
            icon: Code2,
            title: "Install and verify your tracker",
            body: "Copy the snippet from a monitor’s settings. Exact Origin validation, payload limits, daily event budgets, and rotating hashes protect ingestion. Waiting for first event changes to verified after a real page view arrives.",
          },
          {
            icon: BookOpen,
            title: "Useful context, fewer alerts",
            body: "Group and tag monitors, add status/text/JSON response assertions, schedule maintenance, and record deployment markers. Alert grouping and cooldowns reduce repeated notifications. Download incident reports from the incident timeline.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <section className="panel doc-card" key={title}>
            <Icon size={22} />
            <h3>{title}</h3>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <section className="panel privacy-panel">
        <h3>Know the limits</h3>
        <p>
          The single-process free-tier architecture has bounded event and
          connection budgets. Historical traffic uniques are approximate after
          raw events expire, and hourly rollups may omit partial boundary
          buckets. Unsupported Web Vitals remain absent. The tracker’s INP is an
          estimate bounded to 500 recent interactions. Free hosting can sleep or
          be unavailable; coverage indicators show the missing time.
        </p>
      </section>
    </div>
  );
}
function Privacy() {
  return (
    <section className="panel privacy-panel">
      <ShieldCheck size={30} />
      <h2>Your visitors deserve a little privacy.</h2>
      <p>
        The tracker uses no cookies. Its session ID exists only in
        sessionStorage and it respects Do Not Track. Page query strings and
        fragments are stripped; only the referrer host is sent. Device class,
        timezone, navigation timings, and supported Web Vitals are collected.
      </p>
      <h3>No raw IP storage</h3>
      <p>
        The server hashes request-derived visitor identity with a daily rotating
        HMAC salt. Raw IP addresses and user agents are not persisted.
        Application access logging is disabled in the supplied deployment
        command; hosting providers can maintain their own infrastructure logs.
      </p>
      <h3>Retention and deletion</h3>
      <p>
        Raw visitor events are retained for 48 hours and raw checks for seven
        days, after their completed-hour aggregates are safely written. Minute
        aggregates last seven days and hourly aggregates 90 days. Deleting a
        monitor cascades through its events, checks, incidents, profiles,
        releases, maintenance, and alert history.
      </p>
      <h3>Browser storage</h3>
      <p>
        Theme, workspace display name, and explicitly created sample monitors
        use localStorage. Authentication and recent live snapshots use
        sessionStorage, scoped to the current browser session. Use Sign out or
        clear browser storage to remove them.
      </p>
      <Link to="/docs" className="text-button">
        Read the documentation
        <ArrowRight size={14} />
      </Link>
    </section>
  );
}
