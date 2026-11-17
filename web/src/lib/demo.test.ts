import { describe, expect, it } from "vitest";
import { chartData, validateSite } from "./demo";

describe("local monitor form", () => {
  it.each([
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com:22",
    "not-a-url",
  ])("rejects invalid URLs: %s", (url) => {
    expect(validateSite("Example", url)).not.toBeNull();
  });
  it("requires a name and accepts the supported public URL format", () => {
    expect(validateSite(" ", "https://example.com")).not.toBeNull();
    expect(
      validateSite("Example", "https://example.com:8443/health"),
    ).toBeNull();
  });
});

describe("sample data", () => {
  it("is deterministic with ordered percentiles across all supported ranges", () => {
    for (const range of ["1h", "24h", "7d", "30d"] as const) {
      const data = chartData(range);
      expect(data).toEqual(chartData(range));
      expect(data).toHaveLength(49);
      expect(
        data.every((point) => point.p50 <= point.p95 && point.p95 <= point.p99),
      ).toBe(true);
    }
  });
});
