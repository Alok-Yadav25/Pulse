export type Monitor = {
  id: string;
  name: string;
  url: string;
  letter: string;
  color: string;
  status: "operational" | "degraded" | "pending";
  uptime: string;
  latency: number;
  visitors: number;
  history: number[];
};

export type Range = "1h" | "24h" | "7d" | "30d";

export const demoMonitors: Monitor[] = [
  {
    id: "acme",
    name: "Acme website",
    url: "acme.com",
    letter: "a",
    color: "#b6b1ff",
    status: "operational",
    uptime: "99.99",
    latency: 142,
    visitors: 128,
    history: [
      30, 34, 25, 40, 37, 44, 26, 35, 29, 38, 30, 35, 26, 22, 34, 30, 37, 25,
      33, 25, 29, 23,
    ],
  },
  {
    id: "api",
    name: "Production API",
    url: "api.acme.com",
    letter: "{ }",
    color: "#a5d3ee",
    status: "operational",
    uptime: "100",
    latency: 86,
    visitors: 0,
    history: [
      20, 23, 18, 29, 21, 17, 22, 19, 25, 20, 18, 29, 23, 20, 24, 18, 26, 21,
      24, 20, 16, 19,
    ],
  },
  {
    id: "docs",
    name: "Documentation",
    url: "docs.acme.com",
    letter: "d",
    color: "#f1c794",
    status: "operational",
    uptime: "100",
    latency: 118,
    visitors: 43,
    history: [
      23, 19, 27, 20, 31, 27, 34, 21, 29, 25, 22, 35, 27, 32, 25, 31, 22, 28,
      23, 29, 20, 25,
    ],
  },
  {
    id: "store",
    name: "Acme store",
    url: "shop.acme.com",
    letter: "s",
    color: "#ecb8cb",
    status: "degraded",
    uptime: "99.82",
    latency: 684,
    visitors: 71,
    history: [
      18, 21, 25, 19, 29, 25, 31, 27, 40, 34, 30, 38, 42, 32, 36, 49, 40, 48,
      44, 54, 46, 50,
    ],
  },
];

export const rangeLabels: Record<Range, string> = {
  "1h": "last hour",
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

export function chartData(range: Range) {
  const scale = { "1h": 0.88, "24h": 1, "7d": 1.13, "30d": 1.21 }[range];
  return Array.from({ length: 49 }, (_, i) => {
    const wave = Math.sin(i * 1.7) * 14 + Math.sin(i * 0.51) * 16;
    const spike =
      i === 26 ? 175 : i === 27 ? 90 : i === 25 ? 62 : i === 38 ? 85 : 0;
    return {
      time: i,
      p50: Math.round((103 + wave * 0.5 + spike * 0.16) * scale),
      p95: Math.round((171 + wave + spike) * scale),
      p99: Math.round((220 + wave * 1.1 + spike * 1.2) * scale),
    };
  });
}

export function validateSite(name: string, rawUrl: string): string | null {
  if (!name.trim()) return "Give your monitor a name.";
  try {
    const url = new URL(rawUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      (url.port && !["80", "443", "8080", "8443"].includes(url.port))
    )
      return "Enter a public HTTP or HTTPS URL without credentials.";
  } catch {
    return "Enter a complete URL, such as https://example.com.";
  }
  return null;
}

export function readSavedMonitors(): Monitor[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("pulse-monitors") || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Monitor =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.url === "string" &&
          item.status === "pending" &&
          Array.isArray(item.history),
        ),
      )
      .slice(0, 6);
  } catch {
    return [];
  }
}
