export default class EnviarOrdenInterventor {
  constructor(ordenRepository, logUseCase = null) {
    this.ordenRepository = ordenRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, usuarioId) {
    const orden = await this.ordenRepository.enviarAInterventor(id);
    if (!orden) {
      throw new Error("La orden debe estar firmada antes de enviarla al interventor");
    }

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: usuarioId,
        accion: "ENVIAR_INTERVENTOR",
        entidad: "ORDEN",
        entidad_id: id
      });
    }

    return orden;
  }
}
