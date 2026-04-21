export default class EliminarActivo {
  constructor(activoRepository, logUseCase) {
    this.activoRepository = activoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, usuarioId) {

    await this.activoRepository.delete(id);

    await this.logUseCase.execute(usuarioId, "ELIMINAR_ACTIVO", id);

    return true;
  }
}
