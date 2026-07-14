export default class FirmarOrdenInterventor {
  constructor(ordenRepository, logUseCase = null) {
    this.ordenRepository = ordenRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, firmaBase64, usuarioId) {
    const orden = await this.ordenRepository.firmarInterventor(id, firmaBase64, usuarioId);
    if (!orden) {
      throw new Error("La orden no esta pendiente de aprobacion del interventor");
    }

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: usuarioId,
        accion: "FIRMAR_INTERVENTOR",
        entidad: "ORDEN",
        entidad_id: id
      });
    }

    return orden;
  }
}
