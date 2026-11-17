import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "./api";
import { demoMonitors, readSavedMonitors } from "./demo";
import type { Monitor, Range } from "./demo";
import { readStorage, saveStorage } from "./storage";
import { cache, cached, clearLiveCache } from "./cache";

import {
  aggregate,
  blankSummary,
  blankTraffic,
  sampleSummary,
  sampleTraffic,
} from "./workspace-data";
import type { Summary, Traffic, Incident, User } from "./workspace-data";
export type {
  ChartPoint,
  Gap,
  Summary,
  Traffic,
  Incident,
  User,
  Rank,
} from "./workspace-data";

type Workspace = {
  mode: "sample" | "live";
  range: Range;
  setRange: (range: Range) => void;
  user: User | null;
  monitors: Monitor[];
  summaries: Record<string, Summary>;
  traffics: Record<string, Traffic>;
  incidents: Incident[];
  summary: (id?: string) => Summary;
  traffic: (id?: string) => Traffic;
  loading: boolean;
  error: string;
  refreshing: boolean;
  liveConnected: boolean;
  signIn: (email: string, password: string, register: boolean) => Promise<void>;
  signOut: () => void;
  startDemo: () => Promise<void>;
  refresh: () => void;
  addMonitor: (name: string, url: string) => Promise<void>;
  deleteMonitor: (id: string) => Promise<void>;
};
const Context = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [range, setRange] = useState<Range>("24h");
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(readStorage("pulse-user", "null", true));
    } catch {
      return null;
    }
  });
  const [saved, setSaved] = useState<Monitor[]>(readSavedMonitors);
  const [liveConnected, setLiveConnected] = useState(false);
  const mode = user ? "live" : "sample";
  const sites = useQuery({
    queryKey: ["sites", user?.id],
    queryFn: () => api<(Monitor & { active_visitors: number })[]>("/api/sites"),
    enabled: !!user,
    initialData: () =>
      cached<(Monitor & { active_visitors: number })[]>(["sites", user?.id]),
    initialDataUpdatedAt: 0,
    refetchInterval: 30000,
    retry: 2,
  });
  const monitors = useMemo(
    () =>
      user
        ? (sites.data || []).map((site, i) => ({
            ...site,
            color: ["#b6b1ff", "#a5d3ee", "#f1c794", "#ecb8cb"][i % 4],
            letter: site.name[0].toLowerCase(),
            uptime: "—",
            latency: 0,
            visitors: site.active_visitors || 0,
            history: [],
          }))
        : [
            ...demoMonitors.map((site) => ({
              ...site,
              url: `https://${site.url}`,
              group: "Production",
              tags: site.id === "api" ? ["API"] : ["Website"],
            })),
            ...saved,
          ],
    [user, sites.data, saved],
  );
  const overview = useQuery({
    queryKey: ["overview", user?.id, range],
    queryFn: () => api<Summary>(`/api/overview?range=${range}`),
    enabled: !!user,
    initialData: () => cached<Summary>(["overview", user?.id, range]),
    initialDataUpdatedAt: 0,
    staleTime: 15000,
    refetchInterval: 30000,
  });
  const metricQueries = useQueries({
    queries: (user ? monitors : []).map((site) => ({
      queryKey: ["summary", user?.id, site.id, range],
      queryFn: () =>
        api<Summary>(`/api/sites/${site.id}/summary?range=${range}`),
      initialData: () => cached<Summary>(["summary", user?.id, site.id, range]),
      initialDataUpdatedAt: 0,
      staleTime: 15000,
      refetchInterval: 30000,
    })),
  });
  const trafficQueries = useQueries({
    queries: (user ? monitors : []).map((site) => ({
      queryKey: ["traffic", user?.id, site.id, range],
      queryFn: () =>
        api<Traffic>(`/api/sites/${site.id}/traffic?range=${range}`),
      initialData: () => cached<Traffic>(["traffic", user?.id, site.id, range]),
      initialDataUpdatedAt: 0,
      staleTime: 15000,
      refetchInterval: 30000,
    })),
  });
  const incidentQueries = useQueries({
    queries: (user ? monitors : []).map((site) => ({
      queryKey: ["incidents", user?.id, site.id],
      queryFn: () => api<Incident[]>(`/api/sites/${site.id}/incidents`),
      initialData: () => cached<Incident[]>(["incidents", user?.id, site.id]),
      initialDataUpdatedAt: 0,
      staleTime: 15000,
      refetchInterval: 30000,
    })),
  });
  const summaries = Object.fromEntries(
    monitors.map((site, i) => [
      site.id,
      user
        ? metricQueries[i]?.data || blankSummary
        : sampleSummary(site, range),
    ]),
  );
  const traffics = Object.fromEntries(
    monitors.map((site, i) => [
      site.id,
      user
        ? trafficQueries[i]?.data || blankTraffic
        : sampleTraffic(site, range),
    ]),
  );
  const incidents = user
    ? incidentQueries.flatMap((q) => q.data || [])
    : [
        {
          id: "sample-store",
          site_id: "store",
          started_at: new Date(Date.now() - 720000).toISOString(),
          resolved_at: null,
          cause: "slow",
          peak_latency_ms: 684,
          notes: "Illustrative incident for sample mode.",
        },
        {
          id: "sample-api",
          site_id: "api",
          started_at: new Date(Date.now() - 7200000).toISOString(),
          resolved_at: new Date(Date.now() - 7080000).toISOString(),
          cause: "http_5xx",
          peak_latency_ms: 2400,
          notes: "Illustrative recovered incident.",
        },
      ];
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        const key = event.query.queryKey;
        if (
          ["sites", "summary", "traffic", "incidents", "overview"].includes(
            String(key[0]),
          ) &&
          event.query.state.data !== undefined &&
          event.query.state.status === "success"
        )
          cache(key, event.query.state.data);
      }),
    [client],
  );
  const refresh = useCallback(() => {
    void client.invalidateQueries();
  }, [client]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    let pending: ReturnType<typeof setTimeout> | undefined;
    async function connect() {
      try {
        const response = await fetch(`${API_URL}/api/stream/all`, {
          headers: {
            Authorization: `Bearer ${readStorage("pulse-token", "", true)}`,
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body)
          throw new Error("Live stream unavailable");
        setLiveConnected(true);
        const reader = response.body.getReader();
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && !pending)
            pending = setTimeout(() => {
              refresh();
              pending = undefined;
            }, 800);
        }
      } catch {
        /* Polling remains enabled while SSE reconnects. */
      }
      setLiveConnected(false);
      if (!controller.signal.aborted) retry = setTimeout(connect, 5000);
    }
    void connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
      clearTimeout(pending);
      setLiveConnected(false);
    };
  }, [user, refresh]);
  async function authenticate(result: { user: User; access_token: string }) {
    if (
      !saveStorage("pulse-token", result.access_token, true) ||
      !saveStorage("pulse-user", JSON.stringify(result.user), true)
    )
      throw new Error("Enable session storage to sign in securely.");
    client.clear();
    setUser(result.user);
  }
  const value: Workspace = {
    mode,
    range,
    setRange,
    user,
    monitors,
    summaries,
    traffics,
    incidents,
    liveConnected,
    summary: (id) =>
      id
        ? summaries[id] || blankSummary
        : user
          ? overview.data || blankSummary
          : aggregate(Object.values(summaries)),
    traffic: (id) => {
      if (id) return traffics[id] || blankTraffic;
      const values = Object.values(traffics);
      const data = { ...blankTraffic, vitals: {} };
      for (const item of values) {
        data.page_views += item.page_views;
        data.unique_visitors += item.unique_visitors;
        data.active_visitors += item.active_visitors;
      }
      for (const dim of [
        "top_pages",
        "referrers",
        "devices",
        "timezones",
      ] as const) {
        const counts = new Map<string, number>();
        values.forEach((v) =>
          v[dim].forEach((row) =>
            counts.set(row.name, (counts.get(row.name) || 0) + row.count),
          ),
        );
        data[dim] = [...counts]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
      }
      return data;
    },
    loading: !!user && sites.isPending,
    refreshing: sites.isFetching,
    error:
      [
        sites,
        overview,
        ...metricQueries,
        ...trafficQueries,
        ...incidentQueries,
      ].find((q) => q.error)?.error?.message || "",
    refresh,
    signIn: async (email, password, register) =>
      authenticate(
        await api(`/api/auth/${register ? "register" : "login"}`, {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      ),
    signOut: () => {
      saveStorage("pulse-token", null, true);
      saveStorage("pulse-user", null, true);
      setUser(null);
      client.clear();
      clearLiveCache();
    },
    startDemo: async () => {
      const session = await api<{ user: User; access_token: string }>(
        "/api/auth/demo",
        { method: "POST" },
      );
      await authenticate(session);
      await api("/api/demo/start", { method: "POST" });
      refresh();
    },
    addMonitor: async (name, url) => {
      if (user) {
        await api("/api/sites", {
          method: "POST",
          body: JSON.stringify({ name, url }),
        });
        refresh();
      } else {
        if (monitors.length >= 10)
          throw new Error("At most 10 monitors in the sample workspace.");
        const next = [
          ...saved,
          {
            id: crypto.randomUUID(),
            name: name.trim(),
            url: new URL(url).href,
            letter: name[0].toLowerCase(),
            color: "#b7f4c9",
            status: "pending" as const,
            uptime: "—",
            latency: 0,
            visitors: 0,
            history: [],
          },
        ];
        if (!saveStorage("pulse-monitors", JSON.stringify(next)))
          throw new Error(
            "Browser storage is unavailable. Sign in to save monitors to the server.",
          );
        setSaved(next);
      }
    },
    deleteMonitor: async (id) => {
      if (user) {
        await api(`/api/sites/${id}`, { method: "DELETE" });
        refresh();
      } else {
        const next = saved.filter((s) => s.id !== id);
        if (!saveStorage("pulse-monitors", JSON.stringify(next)))
          throw new Error("Browser storage is unavailable.");
        setSaved(next);
      }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// Context consumers share the same authenticated query cache and explicit data mode.
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): Workspace {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider is missing");
  return value;
}
