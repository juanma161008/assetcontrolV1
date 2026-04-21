export default class EliminarMantenimiento {
  constructor(mantenimientoRepository, logUseCase = null) {
    this.mantenimientoRepository = mantenimientoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, usuarioId = null) {
    await this.mantenimientoRepository.delete(id);

    if (this.logUseCase?.execute && usuarioId) {
      await this.logUseCase.execute(usuarioId, "ELIMINAR_MANTENIMIENTO", id);
    }

    return true;
  }
}
