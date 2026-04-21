import { normalizeAdjuntos, getAdjuntosMeta } from "../../utils/adjuntos.js";

export default class CrearHelpdeskThread {
  constructor(helpdeskRepository, logUseCase = null) {
    this.helpdeskRepository = helpdeskRepository;
    this.logUseCase = logUseCase;
  }

  async execute(data = {}, usuarioId = null) {
    const titulo = String(data.titulo || "").trim();
    const mensaje = String(data.mensaje || "").trim();
    const adjuntos = normalizeAdjuntos(data.adjuntos);

    if (!titulo) {
      throw new Error("El titulo es requerido");
    }

    if (!mensaje) {
      throw new Error("El mensaje es requerido");
    }

    const payload = {
      titulo,
      categoria: data.categoria || "General",
      prioridad: data.prioridad || "MEDIA",
      estado: data.estado || "ABIERTO",
      admin_asignado_id: data.admin_asignado_id ?? data.adminAsignadoId ?? null,
      creado_por: data.creado_por ?? usuarioId,
      mensaje,
      adjuntos
    };

    const result = await this.helpdeskRepository.createThreadWithMessage(payload);

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: payload.creado_por,
        accion: "CREAR_MESA_AYUDA",
        entidad: "HELPDESK",
        entidad_id: result.thread?.id ?? null,
        despues: {
          titulo,
          categoria: payload.categoria,
          adjuntos: getAdjuntosMeta(adjuntos)
        }
      });
    }

    return result;
  }
}
