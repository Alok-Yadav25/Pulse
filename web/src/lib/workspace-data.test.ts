import { describe, expect, it, vi, afterEach } from "vitest";
import { demoMonitors } from "./demo";
import {
  sampleSummary,
  sampleTraffic,
  numericPercentile,
  bucketChart,
  blankSummary,
} from "./workspace-data";
import { readStorage, saveStorage } from "./storage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("consistent sample data", () => {
  it("uses different monitor populations and derives percentiles from those observations", () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1795000020000)
      .mockReturnValueOnce(1795000020030);
    const a = sampleSummary(demoMonitors[0], "24h"),
      b = sampleSummary(demoMonitors[1], "24h");
    expect(a.p95).not.toEqual(b.p95);
    expect(a.p95).toBe(
      numericPercentile(
        a.chart.map((point) => point.total_ms),
        95,
      ),
    );
    expect(a.count).toBe(a.chart.length);
    expect(a.chart.map((p) => p.ts)).toEqual(b.chart.map((p) => p.ts));
  });
  it("range changes affect both response metrics and traffic", () => {
    expect(sampleSummary(demoMonitors[0], "1h").p95).not.toBe(
      sampleSummary(demoMonitors[0], "30d").p95,
    );
    expect(sampleTraffic(demoMonitors[0], "30d").page_views).toBeGreaterThan(
      sampleTraffic(demoMonitors[0], "1h").page_views,
    );
  });
  it("pending monitors never inherit another monitor’s sample metrics", () => {
    const pending = { ...demoMonitors[0], status: "pending" as const };
    expect(sampleSummary(pending, "24h")).toEqual(blankSummary);
    expect(sampleTraffic(pending, "24h").page_views).toBe(0);
  });
  it("handles empty percentiles and same-time display buckets without invalid coordinates", () => {
    expect(numericPercentile([], 95)).toBeNull();
    expect(numericPercentile([0, 0, 1000], 95)).toBeCloseTo(900);
    const series = bucketChart([
      { ts: "2026-01-01T00:00:00Z", total_ms: 100, ok: true },
      { ts: "2026-01-01T00:00:00Z", total_ms: 300, ok: false },
    ]);
    expect(series[0].total_ms).toBe(200);
    expect(series[0].ok).toBe(false);
  });
});
describe("unavailable browser storage", () => {
  it("does not crash preferences or pretend a failed write succeeded", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Blocked");
      },
      setItem: () => {
        throw new Error("Full");
      },
      removeItem: () => {
        throw new Error("Blocked");
      },
    });
    expect(readStorage("theme", "dark")).toBe("dark");
    expect(saveStorage("theme", "light")).toBe(false);
    expect(saveStorage("theme", null)).toBe(false);
  });
});
