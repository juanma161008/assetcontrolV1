import { describe, expect, it } from "vitest";
import {
  aggregateKpis,
  calculateAssetKpis,
  filterByPeriod,
  formatPeriodo,
  getHoursFromMaintenance,
  parseDate
} from "../src/utils/kpi.js";

describe("calculateAssetKpis", () => {
  it("devuelve valores nulos si historial vacio", () => {
    const result = calculateAssetKpis([]);
    expect(result.mtbfDays).toBeNull();
    expect(result.mttrHours).toBeNull();
    expect(result.disponibilidad).toBeNull();
    expect(result.preventivos).toBe(0);
    expect(result.fallas).toBe(0);
    expect(result.finalizados).toBe(0);
  });

  it("acepta entradas no arreglos", () => {
    const result = calculateAssetKpis(null);
    expect(result.baseMantenimientos).toBe(0);
    expect(result.fallas).toBe(0);
  });

  it("calcula mtbf y mttr con historial de fallas", () => {
    const historial = [
      { tipo: "Correctivo", fecha: "2024-01-01", duracion_horas: 2 },
      { tipo: "Correctivo", fecha: "2024-01-11", duracion_horas: 4 }
    ];
    const result = calculateAssetKpis(historial);
    expect(result.mtbfDays).toBeGreaterThan(0);
    expect(result.mttrHours).toBeGreaterThan(0);
  });

  it("usa duraciones alternativas y maneja fechas invalidas", () => {
    const historial = [
      { tipo: "Correctivo", fecha: "bad-date" },
      { tipo: "Correctivo", fecha: "2024-01-11", tiempo_resolucion_horas: 6 },
      { tipo: "Preventivo", estado: "Finalizado", fecha: "2024-01-05" }
    ];
    const result = calculateAssetKpis(historial);
    expect(result.mtbfDays).toBeNull();
    expect(result.mttrHours).toBe(5);
    expect(result.preventivos).toBe(1);
    expect(result.finalizados).toBe(1);
  });

  it("usa fallback cuando las duraciones no son positivas", () => {
    expect(getHoursFromMaintenance({ duracion_horas: 0, tipo: "Correctivo" })).toBe(4);
    expect(getHoursFromMaintenance({ horas_trabajo: -1, tipo: "Preventivo" })).toBe(2);
  });

  it("calcula disponibilidad y oee cuando hay datos completos", () => {
    const historial = [
      { tipo: "Correctivo", fecha: null, duracion_horas: 2 },
      { tipo: "Correctivo", fecha: "2024-01-01", duracion_horas: 4 },
      { tipo: "Correctivo", fecha: "2024-01-11", duracion_horas: 6 },
      { tipo: "Preventivo", estado: "Finalizado", fecha: "2024-01-05" },
      { tipo: "Preventivo", estado: "Finalizado", fecha: "2024-01-07" }
    ];

    const result = calculateAssetKpis(historial);

    expect(result.mtbfDays).toBeGreaterThan(0);
    expect(result.mttrHours).toBeGreaterThan(0);
    expect(result.disponibilidad).toBeGreaterThan(0);
    expect(result.oee).toBeGreaterThan(0);
  });

  it("maneja fechas vacias sin romper el orden", () => {
    const historial = [
      { tipo: "Correctivo", fecha: null, duracion_horas: 2 },
      { tipo: "Correctivo", fecha: "", duracion_horas: 4 },
      { tipo: "Preventivo", estado: "", fecha: "2024-01-05" }
    ];

    const result = calculateAssetKpis(historial);

    expect(result.baseMantenimientos).toBe(3);
    expect(result.fallas).toBe(2);
    expect(result.preventivos).toBe(1);
  });

  it("conserva orden y no suma intervalos repetidos", () => {
    const historial = [
      { tipo: "Correctivo", fecha: "2024-01-05" },
      { tipo: "Correctivo", fecha: "2024-01-05" },
      { tipo: "Correctivo", fecha: "2024-01-05" }
    ];

    const result = calculateAssetKpis(historial);

    expect(result.mtbfDays).toBeNull();
    expect(result.mttrHours).toBe(4);
    expect(result.fallas).toBe(3);
  });

  it("cuenta preventivos y finalizados", () => {
    const historial = [
      { tipo: "Preventivo", estado: "Finalizado", fecha: "2024-01-01" },
      { tipo: "Correctivo", estado: "Finalizado", fecha: "2024-01-02" }
    ];
    const result = calculateAssetKpis(historial);
    expect(result.preventivos).toBe(1);
    expect(result.finalizados).toBe(2);
  });
});

describe("aggregateKpis", () => {
  it("promedia solo valores numericos", () => {
    const result = aggregateKpis([
      { mtbf: 10, mttr: 5, disponibilidad: 80, oee: 70 },
      { mtbf: 20, mttr: "x", disponibilidad: 90, oee: null },
      { mtbf: null, mttr: 15, disponibilidad: undefined, oee: 50 }
    ]);

    expect(result).toEqual({
      mtbf: 15,
      mttr: 10,
      disponibilidad: 85,
      oee: 60
    });
  });

  it("devuelve null cuando no hay datos numericos", () => {
    expect(aggregateKpis([])).toEqual({
      mtbf: null,
      mttr: null,
      disponibilidad: null,
      oee: null
    });
  });
});

describe("filterByPeriod", () => {
  it("filtra por fecha y soporta entradas no arreglos", () => {
    const items = [
      { fecha: "2024-01-15T12:00:00Z" },
      { fecha: "2024-02-01T12:00:00Z" },
      { fecha: "bad-date" }
    ];

    expect(filterByPeriod(items, 2024, 0)).toEqual([{ fecha: "2024-01-15T12:00:00Z" }]);
    expect(filterByPeriod([{ fecha: null }, { fecha: "" }], 2024, 0)).toEqual([]);
    expect(filterByPeriod(null, 2024, 0)).toEqual([]);
  });
});

describe("formatPeriodo", () => {
  it("formatea el periodo con cero a la izquierda", () => {
    expect(formatPeriodo(2024, 0)).toBe("2024-01");
    expect(formatPeriodo(2024, 10)).toBe("2024-11");
  });
});

describe("helpers internos", () => {
  it("parseDate devuelve null para entradas invalidas", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("2024-01-01T00:00:00Z")).toBeInstanceOf(Date);
  });

  it("getHoursFromMaintenance usa fallback por tipo", () => {
    expect(getHoursFromMaintenance({ tipo: "Correctivo" })).toBe(4);
    expect(getHoursFromMaintenance({ tipo: "Preventivo" })).toBe(2);
    expect(getHoursFromMaintenance({})).toBe(2);
  });
});
