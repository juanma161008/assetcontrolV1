export default class ObtenerEntidad {
  constructor(entidadRepository) {
    this.entidadRepository = entidadRepository;
  }

  async execute(id) {
    const entidadId = Number(id);
    if (!Number.isInteger(entidadId) || entidadId <= 0) {
      throw new Error("ID de entidad invalido");
    }

    const entidad = await this.entidadRepository.findById(entidadId);
    if (!entidad) {
      throw new Error("Entidad no existe");
    }

    return entidad;
  }
}

