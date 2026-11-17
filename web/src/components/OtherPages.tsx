import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  Globe2,
  HeartPulse,
  LockKeyhole,
  Monitor as MonitorIcon,
  Moon,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { EmptyState, Logo, Modal, StatusDot, UptimeStrip } from "./ui";
import { ActivityPanel, MetricCards, PerformancePanel } from "./Dashboard";
import type { Monitor, Range } from "../lib/demo";

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
  if (pathname.startsWith("/status/"))
    return <PublicStatus monitors={props.monitors} />;
  if (pathname.startsWith("/monitors/")) return <MonitorDetail {...props} />;
  if (pathname === "/traffic") return <Traffic range={props.range} />;
  if (pathname === "/incidents") return <Incidents />;
  if (pathname === "/status-pages")
    return <StatusPages notify={props.notify} />;
  if (pathname === "/settings") return <WorkspaceSettings {...props} />;
  if (pathname === "/docs") return <Documentation />;
  if (pathname === "/privacy") return <Privacy />;
  return (
    <EmptyState
      icon={<Globe2 size={24} />}
      title="A little off the beaten path."
      text="We couldn't find that page. Your workspace is right this way."
      action={
        <Link to="/" className="button button-primary">
          Back to overview
          <ArrowRight size={15} />
        </Link>
      }
    />
  );
}

function Landing({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/welcome">
          <Logo />
        </Link>
        <div>
          <a href="#features">Why Pulse</a>
          <Link to="/docs">Documentation</Link>
          <Link to="/" className="button button-secondary">
            Open dashboard
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="landing-chip">
            <span className="tiny-dot" />A CLEARER PICTURE OF YOUR WEB
          </span>
          <h1>
            Big on signals.
            <br />
            <span>Easy on your mind.</span>
          </h1>
          <p>
            Your uptime, performance, and visitors. Together in one beautifully
            calm workspace.
          </p>
          <div className="landing-cta">
            <button onClick={onAdd} className="button button-primary">
              Add your first website
              <ArrowRight size={16} />
            </button>
            <Link to="/" className="landing-demo">
              Explore the demo
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <span className="landing-fine">
            <ShieldCheck size={13} />
            Privacy first. Lightweight by design.
          </span>
        </motion.div>
        <div className="hero-preview">
          <div className="hero-preview-head">
            <Logo small />
            <span>acme.com</span>
            <span className="status-label operational">
              <StatusDot pulse />
              Operational
            </span>
          </div>
          <div className="hero-preview-value">
            <span>RESPONSE TIME</span>
            <strong className="mono">
              142<small>ms</small>
            </strong>
            <span className="hero-value-caption">
              A healthy little heartbeat.
            </span>
          </div>
          <svg
            viewBox="0 0 600 100"
            className="heartbeat-svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="heart-gradient">
                <stop stopColor="#93d8ac" stopOpacity="0" />
                <stop offset=".45" stopColor="#b9f6ce" />
                <stop offset="1" stopColor="#93d8ac" stopOpacity=".2" />
              </linearGradient>
            </defs>
            <path
              d="M0 60H170L185 48 200 60H245L263 85 286 10 310 91 329 40 343 60H600"
              fill="none"
              stroke="url(#heart-gradient)"
              strokeWidth="2"
            />
          </svg>
          <div className="hero-preview-bottom">
            <span>
              <StatusDot />
              Illustrative demo
            </span>
            <span>99.99% uptime</span>
          </div>
        </div>
      </section>
      <section id="features" className="landing-features">
        {[
          {
            icon: HeartPulse,
            title: "Every heartbeat, accounted for.",
            text: "See uptime and response times without digging through the noise.",
          },
          {
            icon: Users,
            title: "Real people. Clear insights.",
            text: "Understand your visitors with lightweight, cookie-free analytics.",
          },
          {
            icon: Radio,
            title: "Keep everyone in the loop.",
            text: "A beautiful status page that gives your users peace of mind.",
          },
        ].map(({ icon: Icon, title, text }, i) => (
          <article key={title}>
            <span className="feature-number mono">0{i + 1}</span>
            <Icon size={26} strokeWidth={1.2} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="landing-footer">
        <Logo />
        <span>A little more peace of mind.</span>
        <Link to="/privacy">Privacy</Link>
        <Link to="/docs">
          Phase 0 preview
          <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}

function Traffic({ range }: { range: Range }) {
  const pages = [
    { path: "/", views: "12,480", width: 100 },
    { path: "/features", views: "5,214", width: 62 },
    { path: "/pricing", views: "3,892", width: 43 },
    { path: "/blog", views: "2,102", width: 28 },
    { path: "/contact", views: "1,204", width: 16 },
  ];
  return (
    <>
      <MetricCards range={range} activeCount={242} />
      <div className="traffic-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Top pages</h2>
            <span className="subtle-badge">Sample traffic</span>
          </div>
          <div className="ranking-list">
            {pages.map((p) => (
              <div className="ranking-row" key={p.path}>
                <span
                  className="ranking-fill"
                  style={{ width: `${p.width}%` }}
                />
                <span className="mono">{p.path}</span>
                <strong className="mono">{p.views}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Where visitors come from</h2>
            <Globe2 size={16} />
          </div>
          <div className="source-list">
            {[
              ["Direct", "42%", "mint"],
              ["Google", "31%", "blue"],
              ["GitHub", "16%", "purple"],
              ["Other", "11%", "peach"],
            ].map(([name, value, color]) => (
              <div key={name}>
                <span className={`source-icon ${color}`}>{name[0]}</span>
                <span>{name}</span>
                <strong className="mono">{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Devices</h2>
            <MonitorIcon size={16} />
          </div>
          <div className="device-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="device-legend">
            <span>
              <i className="mint" />
              Desktop<strong className="mono">64%</strong>
            </span>
            <span>
              <i className="purple" />
              Mobile<strong className="mono">32%</strong>
            </span>
            <span>
              <i className="peach" />
              Tablet<strong className="mono">4%</strong>
            </span>
          </div>
        </section>
        <section className="panel vitals-card">
          <div className="panel-heading">
            <h2>Core Web Vitals</h2>
            <span className="subtle-badge">p75 · sample</span>
          </div>
          <div className="vitals-grid">
            {[
              ["LCP", "1.8", "s"],
              ["INP", "124", "ms"],
              ["CLS", "0.04", ""],
            ].map(([name, value, unit]) => (
              <div key={name}>
                <span>{name}</span>
                <strong className="mono">
                  {value}
                  <small>{unit}</small>
                </strong>
                <span className="vital-good">
                  <StatusDot />
                  Good
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="section-note">
        Illustrative analytics. Tracker ingestion will be implemented in phase
        3.
      </p>
    </>
  );
}

function MonitorDetail({ monitors, range, onDelete, notify }: Props) {
  const { pathname } = useLocation();
  const id = pathname.split("/")[2];
  const monitor = monitors.find((m) => m.id === id);
  const [tab, setTab] = useState("Overview");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const snippet = `<script defer src="${import.meta.env.VITE_API_URL || "https://YOUR-API.onrender.com"}/t.js" data-key="YOUR_SITE_KEY"></script>`;
  if (!monitor)
    return (
      <EmptyState
        icon={<Activity size={24} />}
        title="Monitor not found"
        text="This monitor may have been removed from your local workspace."
        action={
          <Link to="/monitors" className="button button-primary">
            View monitors
          </Link>
        }
      />
    );
  return (
    <>
      <div className="detail-heading">
        <span
          className="site-avatar large"
          style={{ "--site-color": monitor.color } as React.CSSProperties}
        >
          {monitor.letter}
        </span>
        <div>
          <h2>{monitor.name}</h2>
          <span>{monitor.url}</span>
        </div>
        <span className={`status-label ${monitor.status}`}>
          <StatusDot status={monitor.status} />
          {monitor.status === "pending"
            ? "Pending setup"
            : monitor.status === "degraded"
              ? "Degraded"
              : "Operational"}
        </span>
      </div>
      <div className="detail-tabs" role="tablist" aria-label="Monitor sections">
        {[
          "Overview",
          "Performance",
          "Traffic",
          "Incidents",
          "Profile",
          "Settings",
        ].map((t) => (
          <button
            role="tab"
            id={`tab-${t}`}
            aria-controls="monitor-tab-panel"
            aria-selected={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="monitor-tab-panel"
        aria-labelledby={`tab-${tab}`}
      >
        {monitor.status === "pending" && tab !== "Settings" ? (
          <EmptyState
            icon={<Clock3 size={25} />}
            title="Ready for its first heartbeat."
            text="This monitor is saved in your browser. Phase 1 connects the probe engine to start checking your site."
            action={
              <button
                className="button button-secondary"
                onClick={() => setTab("Settings")}
              >
                Monitor settings
                <ArrowRight size={14} />
              </button>
            }
          />
        ) : tab === "Overview" || tab === "Performance" ? (
          <>
            <div className="detail-stats">
              <div>
                <span>Uptime · 24h</span>
                <strong className="mono">{monitor.uptime}%</strong>
              </div>
              <div>
                <span>Response time · p95</span>
                <strong className="mono">
                  {monitor.latency}
                  <small> ms</small>
                </strong>
              </div>
              <div>
                <span>Active visitors</span>
                <strong className="mono">{monitor.visitors}</strong>
              </div>
              <div>
                <span>Apdex · T = 500 ms</span>
                <strong className="mono">0.98</strong>
              </div>
            </div>
            <PerformancePanel range={range} />
            <p className="section-note">
              Illustrative workspace-wide chart. Per-site measurements arrive
              with live checks.
            </p>
            <section className="panel history-panel">
              <div className="panel-heading">
                <h2>90-day availability</h2>
                <span className="subtle-badge">Illustrative</span>
              </div>
              <UptimeStrip
                degraded={monitor.status === "degraded"}
                count={90}
              />
              <div className="history-labels">
                <span>90 days ago</span>
                <span>Today</span>
              </div>
            </section>
          </>
        ) : tab === "Traffic" ? (
          <Traffic range={range} />
        ) : tab === "Incidents" ? (
          <Incidents />
        ) : tab === "Profile" ? (
          <section className="panel profile-panel">
            <span className="eyebrow">SITE PROFILE · SAMPLE</span>
            <h2>A little about {monitor.name}.</h2>
            <p>
              A modern product website, built to help people do their best work.
              This sample profile demonstrates how Pulse will explain the sites
              you monitor.
            </p>
            <div className="profile-tags">
              <span>React</span>
              <span>Cloudflare</span>
              <span>SaaS</span>
              <span>English</span>
            </div>
            <div className="profile-security">
              <ShieldCheck size={22} />
              <div>
                <strong>Security headers</strong>
                <p>Security analysis will be available in phase 5.</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="panel settings-panel">
            <div className="panel-heading">
              <h2>Monitor settings</h2>
            </div>
            <div className="settings-body">
              <label>
                Website URL
                <input readOnly value={`https://${monitor.url}`} />
              </label>
              <label>
                Check interval
                <select disabled>
                  <option>60 seconds (planned)</option>
                </select>
              </label>
              <div className="install-snippet">
                <h3>Install the tracker</h3>
                <p>
                  The tracker is planned for phase 3. This is the installation
                  format; no events are collected yet.
                </p>
                <code>{snippet}</code>
                <button
                  className="button button-secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(snippet);
                      notify(
                        "Example snippet copied. Tracker not yet available.",
                      );
                    } catch {
                      notify(
                        "Clipboard unavailable. Select and copy the snippet above.",
                      );
                    }
                  }}
                >
                  <Copy size={14} />
                  Copy example
                </button>
              </div>
              {monitor.status === "pending" ? (
                <button
                  className="button button-danger"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 size={14} />
                  Delete local monitor
                </button>
              ) : (
                <div className="form-note">
                  <LockKeyhole size={16} />
                  Seeded demo monitors are read-only.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${monitor.name}?`}
        description="This removes the monitor from this browser. No server data has been collected."
      >
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setConfirmOpen(false)}
          >
            Keep monitor
          </button>
          <button
            className="button button-danger"
            onClick={() => onDelete(monitor.id)}
          >
            Delete monitor
          </button>
        </div>
      </Modal>
    </>
  );
}

function Incidents() {
  const [filter, setFilter] = useState("All incidents");
  const [expanded, setExpanded] = useState<string | null>(null);
  const incidents = [
    {
      id: "store",
      title: "Elevated response time",
      site: "Acme store",
      time: "12 minutes ago",
      status: "Investigating",
      text: "Sample incident: p95 response time increased to 684 ms. The site is reachable but slower than expected.",
      icon: TriangleAlert,
    },
    {
      id: "api",
      title: "API availability restored",
      site: "Production API",
      time: "2 hours ago",
      status: "Resolved",
      text: "Sample incident: a short interruption was followed by two successful checks. Total illustrative duration: 2 minutes.",
      icon: CheckCheck,
    },
  ];
  return (
    <>
      <div className="incidents-toolbar">
        <div className="segmented">
          {["All incidents", "Investigating", "Resolved"].map((v) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="subtle-badge">Demo timeline</span>
      </div>
      <section className="panel incident-list">
        {incidents
          .filter((i) => filter === "All incidents" || i.status === filter)
          .map(({ id, title, site, time, status, text, icon: Icon }) => (
            <article className="incident-row" key={id}>
              <button
                onClick={() => setExpanded(expanded === id ? null : id)}
                aria-expanded={expanded === id}
              >
                <span
                  className={`activity-icon ${status === "Resolved" ? "success" : "warning"}`}
                >
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <span>
                    {site} <span className="separator">·</span> {time}
                  </span>
                </span>
                <span
                  className={`incident-status ${status === "Resolved" ? "resolved" : ""}`}
                >
                  {status}
                </span>
                <ChevronRight
                  className={expanded === id ? "rotated" : ""}
                  size={17}
                />
              </button>
              {expanded === id && (
                <div className="incident-expanded">
                  <p>{text}</p>
                  <Link to={`/monitors/${id}`}>
                    View monitor
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              )}
            </article>
          ))}
      </section>
      <p className="section-note">
        Sample incidents for design review. The incident state machine is
        planned for phase 2.
      </p>
    </>
  );
}

function StatusPages({ notify }: { notify: Props["notify"] }) {
  return (
    <section className="panel status-page-card">
      <div className="status-page-preview">
        <div>
          <Logo />
          <span>System status</span>
        </div>
        <div className="status-page-banner">
          <StatusDot />
          All systems operational
        </div>
        <div className="status-mini-bars">
          {[1, 2, 3].map((v) => (
            <UptimeStrip key={v} count={35} />
          ))}
        </div>
      </div>
      <div className="status-page-info">
        <span className="eyebrow">PUBLIC STATUS PAGE</span>
        <h2>A little transparency goes a long way.</h2>
        <p>
          Give your users a clear, shared view of system health. Explore the
          sample Acme status page.
        </p>
        <div>
          <Link className="button button-primary" to="/status/acme">
            View demo page
            <ArrowUpRight size={14} />
          </Link>
          <button
            className="button button-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/status/acme`,
                );
                notify("Demo status page link copied.");
              } catch {
                notify(
                  "Clipboard unavailable. Open the demo page to copy its address.",
                );
              }
            }}
          >
            <Copy size={14} />
            Copy link
          </button>
        </div>
        <span className="section-note">
          Preview only · no live service status
        </span>
      </div>
    </section>
  );
}

function PublicStatus({ monitors }: { monitors: Monitor[] }) {
  const { slug } = useParams();
  const actualSlug = slug || window.location.pathname.split("/")[2];
  if (actualSlug !== "acme")
    return (
      <div className="public-status">
        <EmptyState
          icon={<Globe2 size={24} />}
          title="Status page not found"
          text="The available preview belongs to the Acme demo workspace."
          action={
            <Link to="/status/acme" className="button button-primary">
              View Acme status
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="public-status">
      <header>
        <Link to="/">
          <Logo />
        </Link>
        <span>
          Acme <span className="muted">/</span> System status
        </span>
        <Link to="/">
          Dashboard
          <ArrowUpRight size={13} />
        </Link>
      </header>
      <div className="status-public-eyebrow">
        <span className="eyebrow">A LITTLE TRANSPARENCY</span>
        <span className="subtle-badge">Sample status page</span>
      </div>
      <h1>Keeping you in the loop.</h1>
      <p>Uptime, updates, and everything in between.</p>
      <div className="public-health-banner">
        <span className="public-health-icon">
          <Activity size={25} />
        </span>
        <div>
          <h2>Some systems are a little slow.</h2>
          <p>
            All services are reachable. Acme store is experiencing elevated
            latency.
          </p>
        </div>
        <StatusDot status="degraded" />
      </div>
      <div className="public-status-monitors">
        {monitors
          .filter((m) => m.status !== "pending")
          .map((m) => (
            <section key={m.id}>
              <div>
                <h3>{m.name}</h3>
                <span className={`status-label ${m.status}`}>
                  <StatusDot status={m.status} />
                  {m.status === "degraded"
                    ? "Degraded performance"
                    : "Operational"}
                </span>
              </div>
              <UptimeStrip degraded={m.status === "degraded"} count={90} />
              <div className="history-labels">
                <span>90 days ago</span>
                <span className="mono">{m.uptime}% uptime</span>
                <span>Today</span>
              </div>
            </section>
          ))}
      </div>
      <ActivityPanel />
      <footer>
        <Link to="/welcome">
          <Logo small />
          Powered by Pulse
        </Link>
        <span>Illustrative data · no live monitoring</span>
      </footer>
    </div>
  );
}

function WorkspaceSettings({
  workspaceName,
  onWorkspaceChange,
  notify,
  light,
  onThemeChange,
}: Props) {
  const [name, setName] = useState(workspaceName);
  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Your workspace</h2>
            <p>The little details that make it yours.</p>
          </div>
          <span className="subtle-badge">Free plan</span>
        </div>
        <form
          className="settings-body"
          onSubmit={(e) => {
            e.preventDefault();
            onWorkspaceChange(name.trim());
            notify("Workspace name updated in this browser.");
          }}
        >
          <label>
            Workspace name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              minLength={1}
              pattern=".*\S.*"
            />
          </label>
          <div className="settings-plan">
            <span className="activity-icon success">
              <Sparkles size={19} />
            </span>
            <div>
              <strong>Room to find your rhythm.</strong>
              <p>
                Up to 10 monitors · 60-second intervals · public status pages
              </p>
            </div>
          </div>
          <div className="settings-save">
            <span className="muted">
              Preferences are saved in this browser.
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
          <h2>Make yourself comfortable</h2>
        </div>
        <div className="settings-body">
          <label>Appearance</label>
          <div className="theme-options">
            <button
              className={!light ? "selected" : ""}
              onClick={() => onThemeChange(false)}
              aria-pressed={!light}
            >
              <Moon size={19} />
              <strong>After hours</strong>
              <span>A calm, dark workspace.</span>
            </button>
            <button
              className={light ? "selected" : ""}
              onClick={() => onThemeChange(true)}
              aria-pressed={light}
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
          <h2>Privacy, by design</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="settings-body">
          <p>
            This phase 0 preview saves workspace preferences and added monitor
            names locally. It does not send visitor analytics or make monitoring
            requests.
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
        <span className="eyebrow">PHASE 0 · THE FOUNDATION</span>
        <h2>
          Made to feel simple.
          <br />
          <span>Built to be thoughtful.</span>
        </h2>
        <p>
          This is Pulse’s interactive design and architecture scaffold. The demo
          workspace uses illustrative data so you can explore the experience
          before connecting live monitoring.
        </p>
        <div className="docs-links">
          <Link to="/welcome" className="button button-secondary">
            Meet Pulse
            <ArrowUpRight size={14} />
          </Link>
          <a
            href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/docs`}
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
            title: "01 / Add your sites",
            body: "Use Add monitor to save up to 10 sites in this browser. New monitors stay pending until the probe engine is connected in phase 1.",
          },
          {
            icon: Radio,
            title: "02 / Know the signals",
            body: "Live probes, incident detection, and sleep-aware monitoring come next. Sample charts are clearly labeled and never presented as measured results.",
          },
          {
            icon: Code2,
            title: "03 / See your visitors",
            body: "The dependency-free tracker and beacon ingestion are planned for phase 3. Example snippets in monitor settings are documentation only.",
          },
          {
            icon: ShieldCheck,
            title: "04 / Keep it private",
            body: "The architecture calls for no cookies, no raw IP storage, and short retention. Account authentication and server data storage are not active in this preview.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <section className="panel doc-card" key={title}>
            <Icon size={22} />
            <h3>{title}</h3>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <section className="panel roadmap-panel">
        <div className="panel-heading">
          <h2>One thoughtful step at a time.</h2>
          <BookOpen size={17} />
        </div>
        {[
          "Foundation & design preview",
          "Safe probes & check storage",
          "Incidents & alerts",
          "Tracker & ingestion",
          "Realtime & analytics",
          "Site profiles & insights",
          "Full product UI",
          "Measured limits & launch",
        ].map((phase, i) => (
          <div className="roadmap-step" key={phase}>
            <span className="mono">0{i}</span>
            <strong>{phase}</strong>
            <span className={i === 0 ? "roadmap-current" : ""}>
              {i === 0 ? "Current phase" : "Planned"}
            </span>
          </div>
        ))}
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
        This phase 0 preview does not collect analytics, use cookies, or contact
        the monitoring API automatically. It stores a theme preference,
        workspace name, and locally added monitor names and hostnames in your
        browser’s localStorage. Self-hosted fonts avoid requests to third-party
        font services.
      </p>
      <h3>The planned tracker</h3>
      <p>
        Later phases will collect page paths without queries, referrer host,
        viewport device class, approximate timezone, and performance timings.
        Session identifiers will be kept in sessionStorage only. The server will
        store daily rotating visitor hashes and will never persist raw IP
        addresses.
      </p>
      <h3>Short retention. Clear control.</h3>
      <p>
        Raw visitor events will be retained for 48 hours. The planned site
        deletion endpoint will remove the site and its associated server data.
        For now, local monitors can be removed from their settings, and clearing
        this site’s browser storage removes all preview preferences.
      </p>
      <Link to="/docs" className="text-button">
        Understand the current preview
        <ArrowRight size={14} />
      </Link>
    </section>
  );
}
