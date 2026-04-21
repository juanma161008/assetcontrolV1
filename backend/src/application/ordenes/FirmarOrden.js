export default class FirmarOrden {
  constructor(ordenRepository, logUseCase = null) {
    this.ordenRepository = ordenRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, firmaBase64, usuarioId) {
    const result = await this.ordenRepository.firmar(id, firmaBase64, usuarioId);

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: usuarioId,
        accion: "FIRMAR_ORDEN",
        entidad: "ORDEN",
        entidad_id: id
      });
    }

    return result;
  }
}
