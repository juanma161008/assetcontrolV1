export default class ListarMantenimientos {
  constructor(mantenimientoRepository) {
    this.mantenimientoRepository = mantenimientoRepository;
  }

  async execute() {
    return await this.mantenimientoRepository.findAll();
  }
}
