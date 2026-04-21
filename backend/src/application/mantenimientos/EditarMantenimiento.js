export default class EditarMantenimiento {
  constructor(mantenimientoRepository, logUseCase = null) {
    this.mantenimientoRepository = mantenimientoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, data, usuarioId = null) {
    const mantenimiento = await this.mantenimientoRepository.update(id, data);

    if (this.logUseCase?.execute && usuarioId) {
      await this.logUseCase.execute(usuarioId, "EDITAR_MANTENIMIENTO", id);
    }

    return mantenimiento;
  }
}
