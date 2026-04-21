import EnviarCorreo from "../../application/notificaciones/EnviarCorreo.js";
import { buildKpiReport } from "../../application/reportes/GenerarKpiReport.js";
import KpiPdfService from "../../infrastructure/pdf/KpiPdfService.js";
import KpiReportPgRepository from "../../infrastructure/repositories/KpiReportPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import SmtpEmailProvider from "../../infrastructure/email/SmtpEmailProvider.js";
import { success, error } from "../../utils/response.js";

const emailProvider = new SmtpEmailProvider();
const enviarCorreoUseCase = new EnviarCorreo(emailProvider);
const reportRepo = new KpiReportPgRepository();
const usuarioRepo = new UsuarioPgRepository();
const pdfService = new KpiPdfService();

const resolveRecipients = async (payload = {}) => {
  if (payload?.to) {
    return payload.to;
  }

  const envRecipients = process.env.REPORTES_EMAILS || "";
  if (envRecipients.trim()) {
    return envRecipients;
  }

  const users = await usuarioRepo.findAll();
  const admins = (Array.isArray(users) ? users : []).filter((user) => Number(user?.rol_id) === 1);
  return admins.map((admin) => admin.email).filter(Boolean).join(",");
};

export async function enviarReporteKpi(req, res) {
  try {
    const year = req.body?.year !== undefined ? Number(req.body?.year) : undefined;
    const monthIndex = req.body?.monthIndex !== undefined
      ? Number(req.body?.monthIndex)
      : undefined;

    const report = await buildKpiReport({ year, monthIndex });
    const recipients = await resolveRecipients(req.body);
    if (!recipients) {
      return success(res, report, "Reporte generado sin correos destino configurados");
    }

    if (!emailProvider.isConfigured()) {
      const missing = emailProvider.getMissingConfigKeys?.() || [];
      const detail = missing.length ? `Falta configurar: ${missing.join(", ")}` : "SMTP no configurado";
      return success(res, report, `Reporte generado. ${detail}. No se envio el correo.`);
    }

    const pdfBuffer = await pdfService.generar(report);
    const subject = req.body?.subject || `Reporte KPI ${report.periodo}`;
    const text = `Reporte KPI ${report.periodo} - MTBF: ${report.mtbf ?? "-"} / MTTR: ${report.mttr ?? "-"} / OEE: ${report.oee ?? "-"}`;

    await enviarCorreoUseCase.execute({
      to: recipients,
      subject,
      text,
      attachments: [
        {
          filename: `reporte-kpi-${report.periodo}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    await reportRepo.create(report.periodo, report);

    return success(res, report, "Reporte enviado");
  } catch (e) {
    return error(res, e.message || "No se pudo enviar el reporte KPI", 400);
  }
}

export async function obtenerReporteKpi(req, res) {
  try {
    const periodo = String(req.query?.periodo || "").trim();
    if (!periodo) {
      return error(res, "Periodo requerido", 400);
    }
    const record = await reportRepo.findByPeriodo(periodo);
    if (!record) {
      return error(res, "Reporte no encontrado", 404);
    }
    return success(res, record);
  } catch (e) {
    return error(res, e.message || "No se pudo cargar el reporte", 400);
  }
}
