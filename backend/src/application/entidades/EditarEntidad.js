export default class EditarEntidad {
  constructor(entidadRepository, logUseCase) {
    this.entidadRepository = entidadRepository;
    this.logUseCase = logUseCase;
  }

  async execute(id, data = {}, userId = null) {
    const entidadId = this.validarEntidadId(id);
    const payload = this.construirPayload(data);

    this.validarPayload(payload);

    const actual = await this.obtenerEntidadActual(entidadId);

    await this.validarNombreUnico(payload.nombre, entidadId);

    const actualizada = await this.actualizarEntidad(entidadId, payload);

    await this.registrarLog(actual, actualizada, entidadId, userId);

    return actualizada;
  }

  validarEntidadId(id) {
    const entidadId = Number(id);

    if (!Number.isInteger(entidadId) || entidadId <= 0) {
      throw new Error("ID de entidad invalido");
    }

    return entidadId;
  }

  construirPayload(data) {
    const camposPermitidos = ["nombre", "nit", "tipo", "direccion"];

    return camposPermitidos.reduce((payload, campo) => {
      if (data[campo] !== undefined) {
        payload[campo] = data[campo];
      }

      return payload;
    }, {});
  }

  validarPayload(payload) {
    if (!Object.keys(payload).length) {
      throw new Error("No hay datos para actualizar");
    }

    this.validarCampoObligatorio(payload.nombre, "El nombre es obligatorio");
    this.validarCampoObligatorio(payload.tipo, "El tipo es obligatorio");
    this.validarCampoObligatorio(payload.nit, "El NIT es obligatorio");
  }

  validarCampoObligatorio(valor, mensaje) {
    if (valor !== undefined && !String(valor).trim()) {
      throw new Error(mensaje);
    }
  }

  async obtenerEntidadActual(entidadId) {
    const actual = await this.entidadRepository.findById(entidadId);

    if (!actual) {
      throw new Error("Entidad no existe");
    }

    return actual;
  }

  async validarNombreUnico(nombre, entidadId) {
    if (nombre === undefined) {
      return;
    }

    const existente =
      await this.entidadRepository.findByNombreNormalized(nombre);

    if (existente && Number(existente.id) !== entidadId) {
      throw new Error("Ya existe una entidad con ese nombre");
    }
  }

  async actualizarEntidad(entidadId, payload) {
    const actualizada = await this.entidadRepository.update(
      entidadId,
      payload
    );

    if (!actualizada) {
      throw new Error("No se pudo actualizar la entidad");
    }

    return actualizada;
  }

  async registrarLog(actual, actualizada, entidadId, userId) {
    if (!this.logUseCase?.execute || !userId) {
      return;
    }

    await this.logUseCase.execute({
      usuario_id: userId,
      accion: "EDITAR",
      entidad: "ENTIDAD",
      entidad_id: entidadId,
      antes: this.mapearDatos(actual),
      despues: this.mapearDatos(actualizada)
    });
  }

  mapearDatos(entidad) {
    return {
      nombre: entidad.nombre,
      nit: entidad.nit,
      tipo: entidad.tipo,
      direccion: entidad.direccion
    };
  }
}

