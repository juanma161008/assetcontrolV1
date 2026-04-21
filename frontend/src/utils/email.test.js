import { describe, expect, it } from "vitest";
import {
  buildAssetEmailDraft,
  buildMailtoLink,
  buildMaintenanceEmailDraft,
  openEmailDraft
} from "./email";

describe("email utils", () => {
  it("construye borrador de activo con asunto y cuerpo", () => {
    const draft = buildAssetEmailDraft(
      { id: 4, activo: "PC-004", estado: "Disponible", equipo: "Laptop" },
      [{ fecha: "2026-02-11", tipo: "Preventivo", estado: "Finalizado", tecnico: "Ana" }]
    );

    expect(draft.subject).toContain("PC-004");
    expect(draft.body).toContain("Numero activo: PC-004");
    expect(draft.body).toContain("Ultimos mantenimientos:");
  });

  it("construye borrador de mantenimiento con datos de activo", () => {
    const draft = buildMaintenanceEmailDraft(
      { id: 23, tipo: "Correctivo", estado: "En proceso", activo_id: 5 },
      { equipo: "Desktop", marca: "Dell", modelo: "OptiPlex" }
    );

    expect(draft.subject).toContain("23");
    expect(draft.body).toContain("Tipo: Correctivo");
    expect(draft.body).toContain("Equipo asociado: Desktop Dell OptiPlex");
  });

  it("arma un mailto valido con subject y body", () => {
    const link = buildMailtoLink({
      to: "soporte@empresa.com",
      subject: "Prueba",
      body: "Linea 1\nLinea 2"
    });

    expect(link).toContain("mailto:soporte%40empresa.com");
    expect(link).toContain("subject=Prueba");
    expect(link).toContain("body=Linea+1%0ALinea+2");
  });

  it("genera borradores con valores por defecto cuando faltan datos", () => {
    const assetDraft = buildAssetEmailDraft({}, "not-array");
    expect(assetDraft.subject).toContain("ACTIVO");
    expect(assetDraft.body).toContain("Numero activo:");
    expect(assetDraft.body).toContain("Fecha registro: -");

    const maintenanceDraft = buildMaintenanceEmailDraft({ id: null, activo_id: 7 }, null);
    expect(maintenanceDraft.body).toContain("Estado: En proceso");
    expect(maintenanceDraft.body).toContain("Activo: ACTIVO #7");
  });

  it("openEmailDraft no falla sin window y actualiza href cuando existe", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true
    });
    expect(() => openEmailDraft({ subject: "X", body: "Y" }, "a@b.com")).not.toThrow();

    Object.defineProperty(globalThis, "window", {
      value: { location: { href: "" } },
      configurable: true
    });

    openEmailDraft({ subject: "Asunto", body: "Cuerpo" }, "mail@empresa.com");
    expect(globalThis.window.location.href).toContain("mailto:mail%40empresa.com");
    expect(globalThis.window.location.href).toContain("subject=Asunto");

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true
    });
  });
});
