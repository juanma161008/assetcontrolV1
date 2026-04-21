export default class EliminarEntidad {
  constructor(entidadRepository, logUseCase) {
    this.entidadRepository = entidadRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, userId = null) {
    const entidadId = Number(id);
    if (!Number.isInteger(entidadId) || entidadId <= 0) {
      throw new Error("ID de entidad invalido");
    }

    const actual = await this.entidadRepository.findById(entidadId);
    if (!actual) {
      throw new Error("Entidad no existe");
    }

    await this.entidadRepository.delete(entidadId);

    if (this.logUseCase?.execute && userId) {
      await this.logUseCase.execute({
        usuario_id: userId,
        accion: "ELIMINAR",
        entidad: "ENTIDAD",
        entidad_id: entidadId,
        antes: {
          nombre: actual.nombre,
          tipo: actual.tipo,
          direccion: actual.direccion
        }
      });
    }

    return true;
  }
}

