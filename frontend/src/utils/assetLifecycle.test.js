import { describe, expect, it } from "vitest";
import {
  ISO_55000_REQUIREMENTS,
  buildAssetLifeSheetData,
  buildAssetLifeSheetHtml,
  buildAutomaticIsoAssessment,
  buildDefaultIsoModel,
  calculateAssetKpis,
  calculateLifecycle,
  normalizeIsoModel
} from "./assetLifecycle";

describe("assetLifecycle utils", () => {
  it("normaliza modelo ISO y preserva politica/riesgos", () => {
    const model = normalizeIsoModel({
      politica_gestion_activos: "Politica corporativa",
      riesgos_oportunidades: "Riesgo de obsolescencia",
      objetivos_estrategicos: "Disponibilidad > 98%",
      requisitos: [{ id: ISO_55000_REQUIREMENTS[0].id, estado: "Implementado" }]
    });

    expect(model.politica_gestion_activos).toBe("Politica corporativa");
    expect(model.riesgos_oportunidades).toBe("Riesgo de obsolescencia");
    expect(model.requisitos).toHaveLength(ISO_55000_REQUIREMENTS.length);
  });

  it("calcula KPIs MTBF, MTTR y OEE con historico", () => {
    const kpis = calculateAssetKpis([
      { fecha: "2026-01-01", tipo: "Correctivo", estado: "Finalizado", duracion_horas: 3 },
      { fecha: "2026-01-10", tipo: "Preventivo", estado: "Finalizado" },
      { fecha: "2026-02-01", tipo: "Correctivo", estado: "Finalizado", duracion_horas: 5 }
    ]);

    expect(kpis.mtbf).toBeGreaterThan(0);
    expect(kpis.mttr).toBeGreaterThan(0);
    expect(kpis.baseMantenimientos).toBe(3);
  });

  it("genera evaluacion ISO automatica y hoja de vida HTML", () => {
    const asset = {
      id: 11,
      numeroReporte: "AC-011",
      activo: "ACT-011",
      equipo: "Portatil",
      marca: "Dell",
      modelo: "Latitude",
      serial: "SN123",
      nombre: "Maria",
      estado: "Disponible",
      sede: "Principal",
      areaPrincipal: "Tecnologia",
      ciclo_vida_etapa: "Operacion",
      criticidad: "Media",
      fecha_adquisicion: "2022-01-01",
      vida_util_anios: 6,
      iso55000_reglas: {
        ...buildDefaultIsoModel(),
        politica_gestion_activos: "Politica de gestion de activos establecida y aprobada por direccion.",
        riesgos_oportunidades: "Riesgo de falla critica y oportunidad de renovar tecnologia.",
        objetivos_estrategicos: "Aumentar disponibilidad y reducir correctivos."
      }
    };
    const historial = [
      { id: 1, fecha: "2026-01-10", tipo: "Preventivo", tecnico: "Ana", estado: "Finalizado", descripcion: "OK" },
      { id: 2, fecha: "2026-02-10", tipo: "Correctivo", tecnico: "Luis", estado: "Finalizado", descripcion: "Cambio pieza" }
    ];

    const autoIso = buildAutomaticIsoAssessment(asset, historial);
    const lifecycle = calculateLifecycle(asset, historial);
    const data = buildAssetLifeSheetData(asset, historial, "Sede Principal");
    const html = buildAssetLifeSheetHtml({
      asset,
      historial,
      entidadNombre: "Sede Principal",
      logos: { logoM5: "/m5.png", logoAssetControl: "/asset.png" }
    });

    expect(autoIso.requisitos).toHaveLength(ISO_55000_REQUIREMENTS.length);
    expect(lifecycle.cumplimiento).toBeGreaterThanOrEqual(0);
    expect(data.mantenimientos).toHaveLength(2);
    expect(html).toContain("Hoja de Vida del Activo");
    expect(html).not.toContain("Implementacion Automatica ISO 55000");
    expect(html).not.toContain("KPIs de Desempeno");
    expect(html).toContain("Historico de Mantenimientos");
  });

  it("infers lifecycle reference when acquisition date is missing", () => {
    const asset = {
      id: 22,
      numeroReporte: "AC-022",
      activo: "ACT-022",
      equipo: "Portatil",
      marca: "Dell",
      modelo: "Latitude",
      serial: "SN222",
      nombre: "Carlos",
      estado: "Disponible",
      sede: "Principal",
      areaPrincipal: "Tecnologia",
      vida_util_anios: 4,
      created_at: "2020-01-01"
    };
    const historial = [
      { fecha: "2024-05-10", tipo: "Preventivo", tecnico: "Ana", estado: "Finalizado", descripcion: "OK" }
    ];

    const lifecycle = calculateLifecycle(asset, historial);

    expect(lifecycle.fechaReferenciaEsInferida).toBe(true);
    expect(lifecycle.edad).not.toBeNull();
    expect(lifecycle.cumplimiento).toBeGreaterThanOrEqual(70);
    expect(lifecycle.iso.requisitos.every((req) => req.estado !== "No iniciado")).toBe(true);
  });
});
