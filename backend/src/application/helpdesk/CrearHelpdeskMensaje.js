import { normalizeAdjuntos, getAdjuntosMeta } from "../../utils/adjuntos.js";

export default class CrearHelpdeskMensaje {
  constructor(helpdeskRepository, logUseCase = null) {
    this.helpdeskRepository = helpdeskRepository;
    this.logUseCase = logUseCase;
  }

  async execute(threadId, data = {}, usuarioId = null) {
    const mensaje = String(data.mensaje || "").trim();
    const adjuntos = normalizeAdjuntos(data.adjuntos);

    if (!mensaje && adjuntos.length === 0) {
      throw new Error("El mensaje es requerido");
    }

    const payload = {
      thread_id: Number(threadId),
      mensaje: mensaje || "Adjunto",
      creado_por: data.creado_por ?? usuarioId,
      adjuntos
    };

    const result = await this.helpdeskRepository.createMessage(payload);

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: payload.creado_por,
        accion: "RESPONDER_MESA_AYUDA",
        entidad: "HELPDESK",
        entidad_id: payload.thread_id,
        despues: {
          mensaje: mensaje.slice(0, 120),
          adjuntos: getAdjuntosMeta(adjuntos)
        }
      });
    }

    return result;
  }
}
