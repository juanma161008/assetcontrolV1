import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

const flushMicrotasks = async (iterations = 20) => {
  for (let i = 0; i < iterations; i += 1) {
    await Promise.resolve();
  }
};

const makeClassMock = (factory) =>
  class {
    constructor(...args) {
      factory?.(this, ...args);
    }
  };

async function loadScheduler({
  nodeEnv = "development",
  schedulerEnabled = "true",
  reportesAutomaticos = "true",
  recordatoriosAutomaticos = "true",
  reportesEmails = "",
  recordatoriosDias = "3",
  smtpConfigured = true,
  existingReport = null,
  users = [],
  mantenimientos = [],
  report = { mtbf: 12, mttr: 4, disponibilidad: 80, oee: 70 },
  registerResults = [],
  reportError = null,
  maintenanceError = null
} = {}) {
  vi.resetModules();
  process.env.NODE_ENV = nodeEnv;
  process.env.REPORTES_AUTOMATICOS = reportesAutomaticos;
  process.env.RECORDATORIOS_AUTOMATICOS = recordatoriosAutomaticos;
  process.env.REPORTES_EMAILS = reportesEmails;
  process.env.RECORDATORIOS_DIAS = recordatoriosDias;

  const stubs = {
    buildKpiReport: reportError
      ? vi.fn().mockRejectedValue(reportError)
      : vi.fn().mockResolvedValue(report),
    reportRepoFindByPeriodo: vi.fn().mockResolvedValue(existingReport),
    reportRepoCreate: vi.fn().mockResolvedValue(undefined),
    userRepoFindAll: vi.fn().mockResolvedValue(users),
    mantenimientoRepoFindAll: maintenanceError
      ? vi.fn().mockRejectedValue(maintenanceError)
      : vi.fn().mockResolvedValue(mantenimientos),
    recordatorioRegister: vi.fn().mockResolvedValue(undefined),
    pdfGenerar: vi.fn().mockResolvedValue(Buffer.from("pdf")),
    smtpIsConfigured: vi.fn().mockReturnValue(smtpConfigured),
    emailExecute: vi.fn().mockResolvedValue(undefined),
    crearNotificacionExecute: vi.fn().mockResolvedValue(undefined),
    setIntervalSpy: vi.spyOn(globalThis, "setInterval").mockImplementation(() => 0)
  };

  registerResults.forEach((result) => {
    stubs.recordatorioRegister.mockResolvedValueOnce(result);
  });

  vi.doMock("../src/config/env.js", () => ({
    default: {
      SCHEDULER_ENABLED: schedulerEnabled
    }
  }));

  vi.doMock("../src/application/reportes/GenerarKpiReport.js", () => ({
    buildKpiReport: (...args) => stubs.buildKpiReport(...args)
  }));

  vi.doMock("../src/infrastructure/repositories/KpiReportPgRepository.js", () => ({
    default: makeClassMock((instance) => {
      instance.findByPeriodo = (...args) => stubs.reportRepoFindByPeriodo(...args);
      instance.create = (...args) => stubs.reportRepoCreate(...args);
    })
  }));

  vi.doMock("../src/infrastructure/repositories/UsuarioPgRepository.js", () => ({
    default: makeClassMock((instance) => {
      instance.findAll = (...args) => stubs.userRepoFindAll(...args);
    })
  }));

  vi.doMock("../src/infrastructure/repositories/MantenimientoPgRepository.js", () => ({
    default: makeClassMock((instance) => {
      instance.findAll = (...args) => stubs.mantenimientoRepoFindAll(...args);
    })
  }));

  vi.doMock("../src/infrastructure/repositories/RecordatorioMantenimientoPgRepository.js", () => ({
    default: makeClassMock((instance) => {
      instance.register = (...args) => stubs.recordatorioRegister(...args);
    })
  }));

  vi.doMock("../src/infrastructure/repositories/NotificacionPgRepository.js", () => ({
    default: makeClassMock()
  }));

  vi.doMock("../src/infrastructure/pdf/KpiPdfService.js", () => ({
    default: makeClassMock((instance) => {
      instance.generar = (...args) => stubs.pdfGenerar(...args);
    })
  }));

  vi.doMock("../src/infrastructure/email/SmtpEmailProvider.js", () => ({
    default: makeClassMock((instance) => {
      instance.isConfigured = (...args) => stubs.smtpIsConfigured(...args);
    })
  }));

  vi.doMock("../src/application/notificaciones/EnviarCorreo.js", () => ({
    default: makeClassMock((instance, provider) => {
      instance.provider = provider;
      instance.execute = (...args) => stubs.emailExecute(...args);
    })
  }));

  vi.doMock("../src/application/notificaciones/CrearNotificacion.js", () => ({
    default: makeClassMock((instance, repo) => {
      instance.repo = repo;
      instance.execute = (...args) => stubs.crearNotificacionExecute(...args);
    })
  }));

  const scheduler = await import("../src/application/scheduler/index.js");
  return { scheduler, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("scheduler module", () => {
  it("no arranca en entorno test", async () => {
    const { scheduler, stubs } = await loadScheduler({ nodeEnv: "test" });

    scheduler.startSchedulers();

    expect(stubs.setIntervalSpy).not.toHaveBeenCalled();
    expect(stubs.buildKpiReport).not.toHaveBeenCalled();
  });

  it("no arranca si el scheduler esta deshabilitado", async () => {
    const { scheduler, stubs } = await loadScheduler({ schedulerEnabled: "false" });

    scheduler.startSchedulers();

    expect(stubs.setIntervalSpy).not.toHaveBeenCalled();
  });

  it("ejecuta reporte y recordatorios automaticos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      schedulerEnabled: "",
      reportesAutomaticos: "",
      recordatoriosAutomaticos: "",
      reportesEmails: "reportes@acme.com",
      recordatoriosDias: "3",
      mantenimientos: [
        {
          id: 1,
          activo_id: 10,
          tecnico_id: 7,
          fecha: "2024-01-10",
          estado: "pendiente",
          tipo: "Preventivo"
        },
        {
          id: 2,
          activo_id: 10,
          tecnico_id: 8,
          fecha: "2024-01-11",
          estado: "pendiente",
          tipo: "Correctivo"
        },
        {
          id: 3,
          activo_id: 10,
          tecnico_id: 0,
          fecha: "2024-01-12",
          estado: "pendiente",
          tipo: "Preventivo"
        },
        {
          id: 4,
          activo_id: 10,
          tecnico_id: 9,
          fecha: "2024-03-01",
          estado: "pendiente",
          tipo: "Preventivo"
        },
        {
          id: 5,
          activo_id: 10,
          tecnico_id: 11,
          fecha: "bad-date",
          estado: "pendiente",
          tipo: "Preventivo"
        },
        {
          id: 6,
          activo_id: 10,
          tecnico_id: 12,
          fecha: "2024-01-09",
          estado: "finalizado",
          tipo: "Preventivo"
        }
      ],
      registerResults: [{ id: 1 }, null]
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(stubs.reportRepoFindByPeriodo).toHaveBeenCalledWith("2024-01");
    expect(stubs.buildKpiReport).toHaveBeenCalledWith({ year: 2024, monthIndex: 0 });
    expect(stubs.reportRepoCreate).toHaveBeenCalledWith(
      "2024-01",
      expect.objectContaining({ mtbf: 12, mttr: 4, oee: 70 })
    );
    expect(stubs.emailExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "reportes@acme.com",
        subject: "Reporte KPI 2024-01",
        attachments: [expect.objectContaining({ filename: "reporte-kpi-2024-01.pdf" })]
      })
    );
    expect(stubs.userRepoFindAll).not.toHaveBeenCalled();
    expect(stubs.recordatorioRegister).toHaveBeenCalledTimes(2);
    expect(stubs.crearNotificacionExecute).toHaveBeenCalledTimes(1);
    expect(stubs.crearNotificacionExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 7,
        tipo: "MANTENIMIENTO",
        url: "/mantenimientos"
      })
    );
  });

  it("omite el reporte automatico cuando REPORTES_AUTOMATICOS es false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      reportesAutomaticos: "false",
      recordatoriosAutomaticos: "false",
      reportesEmails: "reportes@acme.com"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(stubs.buildKpiReport).not.toHaveBeenCalled();
    expect(stubs.reportRepoFindByPeriodo).not.toHaveBeenCalled();
    expect(stubs.emailExecute).not.toHaveBeenCalled();
    expect(stubs.mantenimientoRepoFindAll).not.toHaveBeenCalled();
  });

  it("usa administradores cuando no hay correos configurados", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      users: [
        { id: 1, rol_id: 1, email: "admin1@x.com" },
        { id: 2, rol_id: 2, email: "user@x.com" },
        { id: 3, rol_id: 1, email: "admin2@x.com" }
      ],
      recordatoriosAutomaticos: "false",
      reportesEmails: ""
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.userRepoFindAll).toHaveBeenCalledTimes(1);
    expect(stubs.emailExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin1@x.com,admin2@x.com"
      })
    );
    expect(stubs.crearNotificacionExecute).not.toHaveBeenCalled();
  });

  it("avisa cuando SMTP no esta configurado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { scheduler, stubs } = await loadScheduler({
      reportesEmails: "reportes@acme.com",
      recordatoriosAutomaticos: "false",
      smtpConfigured: false
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledWith(
      "SMTP no configurado. Se omite el envio automatico de reporte KPI."
    );
    expect(stubs.emailExecute).not.toHaveBeenCalled();
    expect(stubs.reportRepoCreate).not.toHaveBeenCalled();
  });

  it("registra errores del reporte y de recordatorios", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { scheduler } = await loadScheduler({
      reportError: "boom report",
      maintenanceError: "boom maintenance"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0][0]).toBe("Error en reporte KPI automatico:");
    expect(errorSpy.mock.calls[1][0]).toBe("Error en recordatorios automaticos:");
    expect(errorSpy.mock.calls[0][1]).toBe("boom report");
    expect(errorSpy.mock.calls[1][1]).toBe("boom maintenance");
  });

  it("usa el periodo del año anterior y mensajes de recordatorio por defecto", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      reportesEmails: "reportes@acme.com",
      recordatoriosDias: "0",
      mantenimientos: [
        {
          id: 11,
          activo_id: 10,
          tecnico_id: 5,
          fecha: "",
          estado: "",
          tipo: ""
        }
      ],
      registerResults: [{ id: 11 }]
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.reportRepoFindByPeriodo).toHaveBeenCalledWith("2023-12");
    expect(stubs.emailExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reporte KPI 2023-12"
      })
    );
    expect(stubs.crearNotificacionExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: "Mantenimiento programado para -"
      })
    );
  });

  it("usa placeholders en el texto del reporte cuando los metadatos son nulos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      reportesEmails: "reportes@acme.com",
      recordatoriosAutomaticos: "false",
      report: {
        mtbf: null,
        mttr: null,
        disponibilidad: null,
        oee: null
      }
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.emailExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("MTBF: - / MTTR: - / OEE: -")
      })
    );
  });

  it("omite destinatarios cuando los usuarios no son un arreglo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      users: null,
      reportesEmails: "",
      recordatoriosAutomaticos: "false"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.userRepoFindAll).toHaveBeenCalledTimes(1);
    expect(stubs.emailExecute).not.toHaveBeenCalled();
    expect(stubs.reportRepoCreate).not.toHaveBeenCalled();
  });

  it("omite recordatorios cuando no hay arreglo de mantenimientos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      reportesAutomaticos: "false",
      recordatoriosAutomaticos: "true",
      mantenimientos: null
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.mantenimientoRepoFindAll).toHaveBeenCalledTimes(1);
    expect(stubs.recordatorioRegister).not.toHaveBeenCalled();
  });

  it("omite el reporte si ya existe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      existingReport: { id: 9 },
      recordatoriosAutomaticos: "false",
      reportesEmails: "reportes@acme.com"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.reportRepoFindByPeriodo).toHaveBeenCalledWith("2024-01");
    expect(stubs.buildKpiReport).not.toHaveBeenCalled();
    expect(stubs.emailExecute).not.toHaveBeenCalled();
    expect(stubs.reportRepoCreate).not.toHaveBeenCalled();
  });

  it("omite el reporte cuando REPORTES_AUTOMATICOS es false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      reportesAutomaticos: "false",
      recordatoriosAutomaticos: "false"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.buildKpiReport).not.toHaveBeenCalled();
    expect(stubs.userRepoFindAll).not.toHaveBeenCalled();
    expect(stubs.recordatorioRegister).not.toHaveBeenCalled();
  });

  it("omite el reporte cuando todavia no es dia 1", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-02T10:00:00Z"));

    const { scheduler, stubs } = await loadScheduler({
      recordatoriosAutomaticos: "false",
      reportesEmails: "reportes@acme.com"
    });

    scheduler.startSchedulers();
    await flushMicrotasks();

    expect(stubs.buildKpiReport).not.toHaveBeenCalled();
    expect(stubs.emailExecute).not.toHaveBeenCalled();
    expect(stubs.reportRepoCreate).not.toHaveBeenCalled();
  });
});
