export default class ActualizarHelpdeskThread {
  constructor(helpdeskRepository, logUseCase = null) {
    this.helpdeskRepository = helpdeskRepository;
    this.logUseCase = logUseCase;
  }

  async execute(threadId, data = {}, usuarioId = null) {
    const payload = {};

    if (data.titulo !== undefined) payload.titulo = data.titulo;
    if (data.categoria !== undefined) payload.categoria = data.categoria;
    if (data.estado !== undefined) payload.estado = data.estado;
    if (data.prioridad !== undefined) payload.prioridad = data.prioridad;
    if (data.admin_asignado_id !== undefined || data.adminAsignadoId !== undefined) {
      payload.admin_asignado_id = data.admin_asignado_id ?? data.adminAsignadoId;
    }

    const result = await this.helpdeskRepository.updateThread(Number(threadId), payload);

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: usuarioId ?? null,
        accion: "ACTUALIZAR_MESA_AYUDA",
        entidad: "HELPDESK",
        entidad_id: Number(threadId),
        despues: payload
      });
    }

    return result;
  }
}
