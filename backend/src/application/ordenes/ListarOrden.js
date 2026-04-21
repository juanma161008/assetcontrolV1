export default class ListarOrden {
  constructor(ordenRepository) {
    this.ordenRepository = ordenRepository;
  }

  async execute() {
    return await this.ordenRepository.findAll();
  }
}
