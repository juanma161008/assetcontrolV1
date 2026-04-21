export default class EditarEntidad {
  constructor(entidadRepository, logUseCase) {
    this.entidadRepository = entidadRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, data = {}, userId = null) {
    const entidadId = Number(id);
    if (!Number.isInteger(entidadId) || entidadId <= 0) {
      throw new Error("ID de entidad invalido");
    }

    const camposPermitidos = ["nombre", "tipo", "direccion"];
    const payload = {};
    for (const campo of camposPermitidos) {
      if (data[campo] !== undefined) {
        payload[campo] = data[campo];
      }
    }

    if (!Object.keys(payload).length) {
      throw new Error("No hay datos para actualizar");
    }

    if (payload.nombre !== undefined && !String(payload.nombre).trim()) {
      throw new Error("El nombre es obligatorio");
    }

    if (payload.tipo !== undefined && !String(payload.tipo).trim()) {
      throw new Error("El tipo es obligatorio");
    }

    const actual = await this.entidadRepository.findById(entidadId);
    if (!actual) {
      throw new Error("Entidad no existe");
    }

    if (payload.nombre !== undefined) {
      const existente = await this.entidadRepository.findByNombreNormalized(payload.nombre);
      if (existente && Number(existente.id) !== entidadId) {
        throw new Error("Ya existe una entidad con ese nombre");
      }
    }

    const actualizada = await this.entidadRepository.update(entidadId, payload);
    if (!actualizada) {
      throw new Error("No se pudo actualizar la entidad");
    }

    if (this.logUseCase?.execute && userId) {
      await this.logUseCase.execute({
        usuario_id: userId,
        accion: "EDITAR",
        entidad: "ENTIDAD",
        entidad_id: entidadId,
        antes: {
          nombre: actual.nombre,
          tipo: actual.tipo,
          direccion: actual.direccion
        },
        despues: {
          nombre: actualizada.nombre,
          tipo: actualizada.tipo,
          direccion: actualizada.direccion
        }
      });
    }

    return actualizada;
  }
}

