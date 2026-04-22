import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildKpiReport,
  buildMaintenanceByAsset
} from "../src/application/reportes/GenerarKpiReport.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("buildKpiReport", () => {
  it("genera reporte KPI con datos simulados", async () => {
    const mockRepoActivo = { findAll: async () => [{ id: 1 }] };
    const mockRepoMantenimiento = {
      findAll: async () => [
        { activo_id: 1, estado: "finalizado", fecha: "2024-01-01" },
        { activo_id: 1, estado: "pendiente", fecha: "2024-01-02" }
      ]
    };
    const report = await buildKpiReport(
      { year: 2024, monthIndex: 0 },
      { repoActivo: mockRepoActivo, repoMantenimiento: mockRepoMantenimiento }
    );
    expect(report).toHaveProperty("periodo");
    expect(report).toHaveProperty("mtbf");
    expect(report.total_mantenimientos).toBeGreaterThan(0);
    expect(report.finalizados + report.pendientes).toBe(report.total_mantenimientos);
  });

  it("usa el periodo actual y omite datos invalidos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-15T10:00:00Z"));

    const mockRepoActivo = {
      findAll: async () => [{ id: 1 }, { id: 2 }, { id: "x" }]
    };
    const mockRepoMantenimiento = {
      findAll: async () => [
        {
          activo_id: 1,
          estado: "finalizado",
          fecha: "2024-02-01T12:00:00Z",
          tipo: "Correctivo",
          duracion_horas: 2
        },
        {
          activo_id: 1,
          estado: "pendiente",
          fecha: "2024-02-10T12:00:00Z",
          tipo: "Correctivo",
          horas_trabajo: 4
        },
        {
          activo_id: 1,
          estado: "finalizado",
          fecha: "2024-02-05T12:00:00Z",
          tipo: "Preventivo"
        },
        {
          activo_id: "bad",
          estado: "pendiente",
          fecha: "2024-02-03T12:00:00Z",
          tipo: "Correctivo"
        },
        {
          activo_id: 2,
          estado: "pendiente",
          fecha: "bad-date",
          tipo: "Correctivo"
        },
        {
          activo_id: 2,
          estado: "pendiente",
          fecha: "2024-02-20T12:00:00Z",
          tipo: "Preventivo"
        }
      ]
    };

    const report = await buildKpiReport(
      {},
      { repoActivo: mockRepoActivo, repoMantenimiento: mockRepoMantenimiento }
    );

    expect(report.periodo).toBe("2024-02");
    expect(report.total_mantenimientos).toBe(5);
    expect(report.finalizados).toBe(2);
    expect(report.pendientes).toBe(3);
    expect(report.backlog).toBe(2);
    expect(report.mtbf).toBeNull();
  });

  it("soporta respuestas nulas de los repositorios", async () => {
    const report = await buildKpiReport(
      { year: 2024, monthIndex: 0 },
      {
        repoActivo: { findAll: async () => null },
        repoMantenimiento: { findAll: async () => null }
      }
    );

    expect(report.total_mantenimientos).toBe(0);
    expect(report.backlog).toBe(0);
    expect(report.mtbf).toBeNull();
  });

  it("agrupa mantenimientos por activo e ignora ids invalidos", () => {
    const map = buildMaintenanceByAsset([
      { activo_id: 1, id: "a" },
      { activo_id: 1, id: "b" },
      { activo_id: "bad", id: "x" },
      { activo_id: 0, id: "y" }
    ]);

    expect(map.size).toBe(1);
    expect(map.get(1)).toHaveLength(2);
    expect(buildMaintenanceByAsset(null).size).toBe(0);
  });

  it("cuenta backlog con estados vacios y fechas nulas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T10:00:00Z"));

    const mockRepoActivo = { findAll: async () => [{ id: 1 }] };
    const mockRepoMantenimiento = {
      findAll: async () => [
        { activo_id: 1, estado: "", fecha: "2024-03-01T12:00:00-05:00", tipo: "Preventivo" },
        { activo_id: 1, estado: null, fecha: "2024-03-05T12:00:00-05:00", tipo: "Correctivo" },
        { activo_id: 1, estado: "Finalizado", fecha: "2024-03-10T12:00:00-05:00", tipo: "Preventivo" }
      ]
    };

    const report = await buildKpiReport(
      { year: 2024, monthIndex: 2 },
      { repoActivo: mockRepoActivo, repoMantenimiento: mockRepoMantenimiento }
    );

    expect(report.total_mantenimientos).toBe(3);
    expect(report.finalizados).toBe(1);
    expect(report.pendientes).toBe(2);
    expect(report.backlog).toBe(2);
  });
});
