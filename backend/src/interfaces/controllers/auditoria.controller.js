import { getAuditoriaLogs as getLogs } from '../../application/auditoria/getAuditoriaLogs.js';
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";

const logUseCase = new RegistrarLog(new LogPgRepository());

export async function getAuditoriaLogs(req, res) {
  try {
    const usuario = String(req.query?.usuario || req.query?.q || "").trim();
    const logs = await getLogs({ usuario });
    return res.json({ data: logs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function registrarErrorSoftware(req, res) {
  try {
    const mensaje = String(req.body?.mensaje || "Error del sistema").trim();
    const detalle = req.body?.detalle ?? null;
    const contexto = req.body?.contexto ?? null;
    const origen = String(req.body?.origen || "frontend").trim();

    const payload = {
      usuario_id: req.user?.id ?? null,
      accion: "ERROR_SOFTWARE",
      entidad: "SISTEMA",
      entidad_id: null,
      antes: null,
      despues: {
        mensaje,
        origen,
        contexto,
        detalle
      },
      ip: req.ip
    };

    const log = await logUseCase.execute(payload);
    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
