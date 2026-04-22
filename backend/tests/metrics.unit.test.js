import { describe, it, expect } from "vitest";
import { getMetricsSnapshot, recordRequest } from "../src/utils/metrics.js";

describe("metrics utils", () => {
  it("registra y reporta metricas de requests", () => {
    recordRequest({ status: 200, method: "GET" });
    recordRequest({ status: 500, method: "POST" });
    recordRequest({ status: 0 });

    const snap = getMetricsSnapshot();

    expect(snap.totalRequests).toBeGreaterThan(0);
    expect(snap.totalErrors).toBeGreaterThan(0);
    expect(snap.statusCounts[200]).toBeGreaterThan(0);
    expect(snap.statusCounts[500]).toBeGreaterThan(0);
    expect(snap.statusCounts.unknown).toBeGreaterThan(0);
    expect(snap.methodCounts.GET).toBeGreaterThan(0);
    expect(snap.methodCounts.POST).toBeGreaterThan(0);
    expect(snap.methodCounts.unknown).toBeGreaterThan(0);
  });
});
