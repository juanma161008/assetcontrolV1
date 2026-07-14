import env from "../../config/env.js";
import EnviarCorreo from "../notificaciones/EnviarCorreo.js";
import { buildKpiReport } from "../reportes/GenerarKpiReport.js";
import KpiPdfService from "../../infrastructure/pdf/KpiPdfService.js";
import KpiReportPgRepository from "../../infrastructure/repositories/KpiReportPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import MantenimientoPgRepository from "../../infrastructure/repositories/MantenimientoPgRepository.js";
import RecordatorioMantenimientoPgRepository from "../../infrastructure/repositories/RecordatorioMantenimientoPgRepository.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../notificaciones/CrearNotificacion.js";
import SmtpEmailProvider from "../../infrastructure/email/SmtpEmailProvider.js";
import { formatPeriodo } from "../../utils/kpi.js";
import ConfiguracionRespaldoPgRepository from "../../infrastructure/repositories/ConfiguracionRespaldoPgRepository.js";
import OrdenPgRepository from "../../infrastructure/repositories/OrdenPgRepository.js";
import SimplePdfService from "../../infrastructure/pdf/SimplePdfService.js";
import EjecutarRespaldo from "../respaldo/EjecutarRespaldo.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Revisa cada 15 minutos si toca correr el respaldo diario configurado desde la UI
// (Usuarios > Respaldo), en vez de esperar 24h fijas como los demas jobs de este
// archivo, para respetar la hora que el admin/tecnico eligio.
const runDailyBackupIfDue = async () => {
  try {
    const configuracionRepo = new ConfiguracionRespaldoPgRepository();
    const config = await configuracionRepo.obtener();
    if (!config?.habilitado || !config?.carpeta_destino) return;

    const now = new Date();
    const [horaConfigurada, minutoConfigurado] = String(config.hora || "02:00")
      .split(":")
      .map((value) => Number(value));

    const horaObjetivo = new Date(now);
    horaObjetivo.setHours(
      Number.isFinite(horaConfigurada) ? horaConfigurada : 2,
      Number.isFinite(minutoConfigurado) ? minutoConfigurado : 0,
      0,
      0
    );

    if (now < horaObjetivo) return;

    const ultimaEjecucion = config.ultima_ejecucion ? new Date(config.ultima_ejecucion) : null;
    if (ultimaEjecucion && isSameDay(ultimaEjecucion, now)) return;

    const ordenRepo = new OrdenPgRepository();
    const pdfService = new SimplePdfService();
    const usecase = new EjecutarRespaldo(configuracionRepo, ordenRepo, pdfService);
    await usecase.execute();
  } catch (err) {
    console.error("Error en respaldo automatico diario:", err?.message || err);
  }
};

const resolveReportRecipients = async () => {
  const envRecipients = String(process.env.REPORTES_EMAILS || "").trim();
  if (envRecipients) return envRecipients;

  const usuarioRepo = new UsuarioPgRepository();
  const users = await usuarioRepo.findAll();
  const admins = (Array.isArray(users) ? users : []).filter((user) => Number(user?.rol_id) === 1);
  return admins.map((admin) => admin.email).filter(Boolean).join(",");
};

const runMonthlyReport = async () => {
  if (!String(process.env.REPORTES_AUTOMATICOS || "true").toLowerCase().includes("true")) {
    return;
  }

  const now = new Date();
  if (now.getDate() !== 1) return;

  const monthIndex = now.getMonth() - 1;
  const reportYear = monthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const reportMonth = monthIndex < 0 ? 11 : monthIndex;
  const periodo = formatPeriodo(reportYear, reportMonth);

  const reportRepo = new KpiReportPgRepository();
  const existing = await reportRepo.findByPeriodo(periodo);
  if (existing) return;

  const report = await buildKpiReport({ year: reportYear, monthIndex: reportMonth });
  const recipients = await resolveReportRecipients();
  if (!recipients) return;

  const pdfService = new KpiPdfService();
  const emailProvider = new SmtpEmailProvider();
  if (!emailProvider.isConfigured()) {
    console.warn("SMTP no configurado. Se omite el envio automatico de reporte KPI.");
    return;
  }

  const pdfBuffer = await pdfService.generar(report);
  const enviarCorreo = new EnviarCorreo(emailProvider);

  await enviarCorreo.execute({
    to: recipients,
    subject: `Reporte KPI ${periodo}`,
    text: `Reporte KPI ${periodo} - MTBF: ${report.mtbf ?? "-"} / MTTR: ${report.mttr ?? "-"} / OEE: ${report.oee ?? "-"}`,
    attachments: [
      {
        filename: `reporte-kpi-${periodo}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });

  await reportRepo.create(periodo, report);
};

const runMaintenanceReminders = async () => {
  if (!String(process.env.RECORDATORIOS_AUTOMATICOS || "true").toLowerCase().includes("true")) {
    return;
  }

  const dias = Number(process.env.RECORDATORIOS_DIAS) || 3;
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + dias);
  limit.setHours(23, 59, 59, 999);

  const mantenimientoRepo = new MantenimientoPgRepository();
  const recordatorioRepo = new RecordatorioMantenimientoPgRepository();
  const notificacionRepo = new NotificacionPgRepository();
  const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);

  const mantenimientos = await mantenimientoRepo.findAll();
  const pendientes = (Array.isArray(mantenimientos) ? mantenimientos : []).filter((item) => {
    const fecha = new Date(item.fecha || 0);
    if (Number.isNaN(fecha.getTime())) return false;
    if (fecha > limit) return false;
    return String(item.estado || "").toLowerCase() !== "finalizado";
  });

  for (const mantenimiento of pendientes) {
    const tecnicoId = Number(mantenimiento.tecnico_id);
    if (!Number.isInteger(tecnicoId) || tecnicoId <= 0) continue;
    const record = await recordatorioRepo.register({
      mantenimiento_id: mantenimiento.id,
      usuario_id: tecnicoId,
      tipo: "AUTO"
    });
    if (!record) continue;

    await crearNotificacionUseCase.execute({
      usuario_id: tecnicoId,
      titulo: "Recordatorio automatico de mantenimiento",
      mensaje: `${mantenimiento.tipo || "Mantenimiento"} programado para ${mantenimiento.fecha || "-"}`,
      tipo: "MANTENIMIENTO",
      url: "/mantenimientos"
    });
  }
};

export const startSchedulers = () => {
  if (process.env.NODE_ENV === "test") return;
  if (String(env.SCHEDULER_ENABLED || "true").toLowerCase() === "false") return;

  const runAll = async () => {
    try {
      await runMonthlyReport();
    } catch (err) {
      console.error("Error en reporte KPI automatico:", err?.message || err);
    }

    try {
      await runMaintenanceReminders();
    } catch (err) {
      console.error("Error en recordatorios automaticos:", err?.message || err);
    }
  };

  runAll();
  setInterval(runAll, DAY_MS);

  runDailyBackupIfDue();
  setInterval(runDailyBackupIfDue, BACKUP_CHECK_INTERVAL_MS);
};
