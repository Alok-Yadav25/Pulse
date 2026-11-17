import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Globe2,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import Dashboard, { MonitorsPanel } from "./components/Dashboard";
import { Logo, Modal, StatusDot } from "./components/ui";
import { validateSite } from "./lib/demo";
import { useWorkspace } from "./lib/workspace";
import { readStorage, saveStorage } from "./lib/storage";
import "./styles.css";
import AuthModal from "./components/AuthModal";
import { api } from "./lib/api";
import { Radio as RadioIcon } from "lucide-react";

const OtherPages = lazy(() => import("./components/OtherPages"));

const navigation = [
  { label: "Overview", to: "/", icon: LayoutDashboard, key: "G D" },
  { label: "Monitors", to: "/monitors", icon: Activity, count: true },
  { label: "Traffic", to: "/traffic", icon: Users },
  { label: "Incidents", to: "/incidents", icon: TriangleAlert, alert: true },
  { label: "Status pages", to: "/status-pages", icon: Globe2 },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { range, setRange, monitors } = workspace;
  const [authOpen, setAuthOpen] = useState(false);
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    if (!workspace.refreshing) {
      setWaking(false);
      return;
    }
    const timer = setTimeout(() => setWaking(true), 2000);
    return () => clearTimeout(timer);
  }, [workspace.refreshing]);
  const [addOpen, setAddOpen] = useState(() =>
    new URLSearchParams(location.search).has("add"),
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [light, setLight] = useState(
    () => readStorage("pulse-theme") === "light",
  );
  const [workspaceName, setWorkspaceName] = useState(
    () => readStorage("pulse-workspace") || "Acme workspace",
  );

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    saveStorage("pulse-theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    let lastG = 0;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (
        (e.target instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
            e.target.isContentEditable)) ||
        addOpen ||
        commandOpen ||
        helpOpen ||
        notificationsOpen
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
      if (e.key === "g") lastG = Date.now();
      if (e.key === "d" && Date.now() - lastG < 1000) navigate("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, addOpen, commandOpen, helpOpen, notificationsOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    sidebar?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (!sidebar?.contains(event.target as Node)) return;
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        sidebar.querySelectorAll<HTMLElement>("a,button,select,input"),
      ).filter(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          getComputedStyle(el).visibility !== "hidden",
      );
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [mobileOpen]);

  const isLanding = location.pathname === "/welcome";
  const isPublic = location.pathname.startsWith("/status/");
  const pageTitle =
    location.pathname === "/"
      ? "Overview"
      : location.pathname.startsWith("/monitors/")
        ? "Monitor details"
        : {
            "/monitors": "Monitors",
            "/traffic": "Traffic",
            "/incidents": "Incidents",
            "/status-pages": "Status pages",
            "/settings": "Settings",
            "/docs": "Documentation",
            "/privacy": "Privacy",
          }[location.pathname] || "Page not found";

  async function addMonitor(name: string, url: string): Promise<string | null> {
    const error = validateSite(name, url);
    if (error) return error;
    try {
      await workspace.addMonitor(name, url);
      setAddOpen(false);
      notify(
        workspace.mode === "live"
          ? "Monitor created. Its first probe is scheduled."
          : "Saved in sample mode. Connect a live workspace to run real checks.",
      );
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Monitor could not be saved.";
    }
  }
  async function deleteMonitor(id: string) {
    try {
      await workspace.deleteMonitor(id);
      navigate("/monitors");
      notify("Monitor and its data deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            mode: workspace.mode,
            range,
            monitors,
            summaries: workspace.summaries,
            traffic: workspace.traffics,
            incidents: workspace.incidents,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pulse-${workspace.mode}-${range}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Workspace data exported.");
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {!isLanding && !isPublic && (
        <>
          {mobileOpen && (
            <button
              className="mobile-backdrop"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
            <div className="sidebar-brand">
              <Link to="/" aria-label="Pulse overview">
                <Logo />
              </Link>
              <button
                className="icon-button mobile-close"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X size={19} />
              </button>
              <span className="beta-badge">BETA</span>
            </div>
            <button
              className="workspace-switcher"
              onClick={() => navigate("/settings")}
            >
              <span className="workspace-avatar">
                A<span />
              </span>
              <span>
                <strong>{workspaceName}</strong>
                <span>Personal workspace</span>
              </span>
              <ChevronDown size={14} />
            </button>
            <button
              className="search-button"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={15} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="nav-label">WORKSPACE</span>
            <nav className="main-nav" aria-label="Main navigation">
              {navigation.map(
                ({ label, to, icon: Icon, key, count, alert }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      isActive ? "nav-item active" : "nav-item"
                    }
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span>{label}</span>
                    {key && <span className="nav-shortcut">{key}</span>}
                    {count && (
                      <span className="nav-count mono">{monitors.length}</span>
                    )}
                    {alert &&
                      workspace.incidents.some((i) => !i.resolved_at) && (
                        <span className="nav-alert">
                          {
                            workspace.incidents.filter((i) => !i.resolved_at)
                              .length
                          }
                        </span>
                      )}
                  </NavLink>
                ),
              )}
            </nav>
            <div className="nav-divider" />
            <nav className="secondary-nav" aria-label="Resources">
              <NavLink to="/settings" className="nav-item">
                <Settings size={17} strokeWidth={1.6} />
                <span>Settings</span>
              </NavLink>
              <NavLink to="/docs" className="nav-item">
                <BookOpen size={17} strokeWidth={1.6} />
                <span>Documentation</span>
                <ArrowUpRight size={13} className="trailing" />
              </NavLink>
            </nav>
            <div className="sidebar-bottom">
              <div className="demo-card">
                <span className="demo-card-icon">
                  <Sparkles size={16} />
                </span>
                <strong>A feel for the real thing.</strong>
                <p>Explore a calmer way to keep an eye on your websites.</p>
                <Link to="/welcome">
                  Meet Pulse
                  <ArrowUpRight size={13} />
                </Link>
              </div>
              <button className="help-button" onClick={() => setHelpOpen(true)}>
                <CircleHelp size={16} />
                <span>Help & shortcuts</span>
                <kbd>?</kbd>
              </button>
              <div className="sidebar-profile">
                <button
                  className="profile-button"
                  onClick={() => navigate("/settings")}
                >
                  <span className="user-avatar">AY</span>
                  <span>
                    <strong>Your workspace</strong>
                    <span>Free plan</span>
                  </span>
                </button>
                <button
                  className="icon-button theme-toggle"
                  aria-label={`Switch to ${light ? "dark" : "light"} theme`}
                  onClick={() => setLight((v) => !v)}
                >
                  {light ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
      <div className={!isLanding && !isPublic ? "app-shell" : ""}>
        {!isLanding && !isPublic && (
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              <span className="breadcrumb-workspace">Workspace</span>
              <ChevronRight size={13} />
              <strong>{pageTitle}</strong>
            </div>
            <div className="topbar-right">
              <span className="demo-pill">
                <span className="tiny-dot" />
                {workspace.mode === "sample"
                  ? "Sample workspace"
                  : workspace.user?.demo
                    ? "Live chaos demo"
                    : "Live workspace"}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  workspace.user ? workspace.signOut() : setAuthOpen(true)
                }
              >
                {workspace.user ? "Sign out" : "Connect live"}
              </button>
              <span className="topbar-divider" />
              <button
                className="notification-button icon-button"
                aria-label="Open notifications"
                onClick={() => setNotificationsOpen(true)}
              >
                <Bell size={17} />
                <span />
              </button>
              <button
                className="user-avatar topbar-avatar"
                aria-label="Open account settings"
                onClick={() => navigate("/settings")}
              >
                AY
              </button>
            </div>
          </header>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className={!isLanding && !isPublic ? "main-content" : ""}
        >
          {!isLanding && !isPublic && (
            <>
              <div className="page-heading">
                <div>
                  <div className="page-eyebrow">
                    <span className="eyebrow-line" />
                    YOUR WEBSITE, IN THE KNOW
                  </div>
                  <h1>
                    {pageTitle === "Overview"
                      ? "A good day to be online."
                      : pageTitle}
                    <span className="heading-dot">
                      {pageTitle === "Overview" && "✳"}
                    </span>
                  </h1>
                  <p>
                    {pageTitle === "Overview"
                      ? "All your websites. One clear picture. A little less to worry about."
                      : pageTitle === "Monitors"
                        ? "Every endpoint. Every heartbeat. Right where you need them."
                        : pageTitle === "Traffic"
                          ? "A closer look at the people behind the page views."
                          : pageTitle === "Incidents"
                            ? "The full story, from first signal to all clear."
                            : pageTitle === "Settings"
                              ? "A workspace that feels like yours."
                              : pageTitle === "Status pages"
                                ? "Keep everyone in the loop, beautifully."
                                : pageTitle === "Monitor details"
                                  ? "The signals that matter, without the noise."
                                  : "Everything you need to find your rhythm."}
                  </p>
                </div>
                <div className="heading-actions">
                  {["Overview", "Monitors"].includes(pageTitle) && (
                    <>
                      <button
                        className="button button-secondary export-button"
                        onClick={exportData}
                      >
                        <ArrowDownToLine size={14} />
                        Export
                      </button>
                      <button
                        className="button button-primary"
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus size={16} />
                        Add monitor
                      </button>
                    </>
                  )}
                </div>
              </div>
              {["Overview", "Traffic", "Monitor details"].includes(
                pageTitle,
              ) && (
                <div className="toolbar">
                  <div className="toolbar-status">
                    <StatusDot pulse />
                    <span>
                      {pageTitle === "Traffic"
                        ? "Visitor analytics"
                        : "Your workspace at a glance"}
                    </span>
                    <span className="toolbar-sample">
                      {workspace.mode === "sample"
                        ? "Sample data"
                        : workspace.liveConnected
                          ? "Live events"
                          : "Polling"}
                    </span>
                  </div>
                  <div className="toolbar-right">
                    <span className="date-label">
                      {new Date().toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <div
                      className="segmented range-control"
                      aria-label="Time range"
                    >
                      {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRange(r)}
                          className={range === r ? "selected" : ""}
                          aria-pressed={range === r}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {workspace.mode === "live" && (waking || workspace.error) && (
            <div className="connection-banner" role="status">
              <RadioIcon />
              <span>
                <strong>
                  {workspace.error
                    ? "Monitor connection needs attention"
                    : "Waking the monitor…"}
                </strong>
                <span>
                  {workspace.error ||
                    "Showing the last available snapshot while the API responds. No sample data is substituted."}
                </span>
              </span>
              <button
                className="button button-secondary"
                onClick={workspace.refresh}
              >
                Retry
              </button>
            </div>
          )}
          {workspace.user?.demo && (
            <div className="demo-controls">
              <span>
                Controlled live demo · automatic recovery after 45 seconds
              </span>
              <button
                className="button button-danger"
                onClick={async () => {
                  try {
                    await api("/api/demo/break", { method: "POST" });
                    workspace.refresh();
                    notify(
                      "Chaos target is failing. Three checks must confirm an incident.",
                    );
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Break it
              </button>
              <button
                className="button button-secondary"
                onClick={async () => {
                  await api("/api/demo/recover", { method: "POST" });
                  workspace.refresh();
                }}
              >
                Recover
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="page-skeleton">
                <span />
                <span />
                <span />
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    range={range}
                    monitors={monitors}
                    onAdd={() => setAddOpen(true)}
                  />
                }
              />
              <Route
                path="/monitors"
                element={
                  <MonitorsPanel
                    expanded
                    monitors={monitors}
                    onAdd={() => setAddOpen(true)}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <OtherPages
                    monitors={monitors}
                    range={range}
                    notify={notify}
                    onAdd={() => setAddOpen(true)}
                    onDelete={deleteMonitor}
                    workspaceName={workspaceName}
                    onWorkspaceChange={(name) => {
                      setWorkspaceName(name);
                      if (!saveStorage("pulse-workspace", name))
                        notify(
                          "Workspace preference could not be saved in this browser.",
                        );
                    }}
                    light={light}
                    onThemeChange={setLight}
                  />
                }
              />
            </Routes>
          </Suspense>
        </main>
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} notify={notify} />
      <AddMonitorModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={addMonitor}
        count={monitors.length}
      />
      <Modal
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Find your way"
        description="Search pages and monitors. Use the arrow keys to explore."
        className="command-modal"
      >
        <Command>
          <div className="command-input">
            <Search size={18} />
            <Command.Input
              placeholder="Where would you like to go?"
              autoFocus
            />
          </div>
          <Command.List>
            <Command.Empty>
              No results. Try a monitor name or “settings”.
            </Command.Empty>
            <Command.Group heading="Workspace">
              {[
                ...navigation,
                { label: "Settings", to: "/settings", icon: Settings },
                { label: "Documentation", to: "/docs", icon: BookOpen },
              ].map(({ label, to, icon: Icon }) => (
                <Command.Item
                  key={to}
                  onSelect={() => {
                    navigate(to);
                    setCommandOpen(false);
                  }}
                >
                  <Icon size={17} />
                  {label}
                  <ArrowRight size={14} />
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Monitors">
              {monitors.map((m) => (
                <Command.Item
                  key={m.id}
                  keywords={[m.url]}
                  onSelect={() => {
                    navigate(`/monitors/${m.id}`);
                    setCommandOpen(false);
                  }}
                >
                  <StatusDot status={m.status} />
                  {m.name}
                  <span>{m.url}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="command-foot">
            <span>↑ ↓ to navigate</span>
            <span>↵ to open</span>
            <span>esc to close</span>
          </div>
        </Command>
      </Modal>
      <Modal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="A few handy shortcuts"
        description="Less clicking. More peace of mind."
      >
        <div className="shortcut-list">
          <span>
            Search your workspace<kbd>⌘ / Ctrl K</kbd>
          </span>
          <span>
            Quick search<kbd>/</kbd>
          </span>
          <span>
            Go to overview<kbd>G then D</kbd>
          </span>
          <span>
            Open this guide<kbd>?</kbd>
          </span>
          <span>
            Close a dialog<kbd>Esc</kbd>
          </span>
        </div>
        <Link
          to="/docs"
          className="button button-primary full-width"
          onClick={() => setHelpOpen(false)}
        >
          Read the documentation
          <ArrowUpRight size={15} />
        </Link>
      </Modal>
      <Modal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        title="Your notifications"
        description="Recent incident signals in this workspace."
      >
        {workspace.incidents.length ? (
          workspace.incidents.slice(0, 5).map((incident) => (
            <div className="notification-item" key={incident.id}>
              <span
                className={`activity-icon ${incident.resolved_at ? "success" : "warning"}`}
              >
                <Activity size={17} />
              </span>
              <div>
                <strong>{incident.cause.replaceAll("_", " ")}</strong>
                <p>
                  {monitors.find((m) => m.id === incident.site_id)?.name} ·{" "}
                  {incident.resolved_at ? "Resolved" : "Open"}
                </p>
                <Link
                  to={`/monitors/${incident.site_id}?tab=Incidents`}
                  onClick={() => setNotificationsOpen(false)}
                >
                  View incident
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="section-note">No incidents recorded.</p>
        )}
      </Modal>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
          >
            <span className="toast-check">
              <Check size={14} />
            </span>
            {toast}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AddMonitorModal({
  open,
  onOpenChange,
  onSubmit,
  count,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, url: string) => Promise<string | null>;
  count: number;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const workspace = useWorkspace();
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        setError("");
      }}
      title="A new heartbeat."
      description={
        workspace.mode === "live"
          ? "Create a monitor with public-network validation and timed checks."
          : "Explore locally, or connect a live workspace to start real monitoring."
      }
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const result = await onSubmit(name, url);
          setBusy(false);
          if (result) setError(result);
          else {
            setName("");
            setUrl("");
          }
        }}
        className="form"
      >
        <label>
          Monitor name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My wonderful website"
            maxLength={60}
            required
          />
        </label>
        <label>
          Website URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            maxLength={2048}
            required
          />
        </label>
        <div className="form-note">
          <ShieldCheck size={17} />
          <span>
            {workspace.mode === "live"
              ? "Public destinations only. The complete URL, including its path and query, is preserved."
              : "Sample mode stores this monitor in your browser and does not run probes. Use Connect live to enable real monitoring."}
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>{count} of 10 monitors</span>
          <button
            type="submit"
            disabled={busy || !!workspace.user?.demo}
            className="button button-primary"
          >
            <Plus size={15} />
            Add monitor
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default App;
