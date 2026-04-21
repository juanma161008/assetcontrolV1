export default class ObtenerOrden {
  constructor(ordenRepository) {
    this.ordenRepository = ordenRepository;
  }

  async execute(id) {
    return await this.ordenRepository.findById(id);
  }
}
