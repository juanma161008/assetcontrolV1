export default class EliminarOrden {
  constructor(ordenRepository) {
    this.ordenRepository = ordenRepository;
  }

  async execute(id) {
    return this.ordenRepository.delete(id);
  }
}
