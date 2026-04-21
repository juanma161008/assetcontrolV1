export default class ListarActivos {
  constructor(activoRepository) {
    this.activoRepository = activoRepository;
  }

  async execute() {
    return await this.activoRepository.findAll();
  }
}
