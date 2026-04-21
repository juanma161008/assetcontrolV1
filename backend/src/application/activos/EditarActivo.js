export default class EditarActivo {
  constructor(activoRepository, logUseCase) {
    this.activoRepository = activoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, data, usuarioId) {

    const updated = await this.activoRepository.update(id, data);

    await this.logUseCase.execute(usuarioId, "EDITAR_ACTIVO", id);

    return updated;
  }
}
