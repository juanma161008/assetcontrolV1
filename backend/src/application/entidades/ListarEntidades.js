export default class ListarEntidades {
  constructor(entidadRepository) {
    this.entidadRepository = entidadRepository;
  }

  async execute() {
    return await this.entidadRepository.findAll();
  }
}
