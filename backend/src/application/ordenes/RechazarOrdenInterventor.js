export default class RechazarOrdenInterventor {
  constructor(ordenRepository, logUseCase = null) {
    this.ordenRepository = ordenRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, usuarioId, comentario) {
    const comentarioLimpio = String(comentario || "").trim();
    if (!comentarioLimpio) {
      throw new Error("El comentario de rechazo es requerido");
    }

    const orden = await this.ordenRepository.rechazarInterventor(id, usuarioId, comentarioLimpio);
    if (!orden) {
      throw new Error("La orden no esta pendiente de aprobacion del interventor");
    }

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: usuarioId,
        accion: "RECHAZAR_INTERVENTOR",
        entidad: "ORDEN",
        entidad_id: id
      });
    }

    return orden;
  }
}
