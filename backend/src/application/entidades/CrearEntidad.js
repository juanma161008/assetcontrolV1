export default class CrearEntidad {
  constructor(entidadRepository, logUseCase) {
    this.entidadRepository = entidadRepository;
    this.logUseCase = logUseCase;
  }

  async execute(data, userId) {
    const nombre = String(data?.nombre || "").trim();
    const tipo = String(data?.tipo || "").trim();
    const direccion = data?.direccion;

    if (!nombre || !tipo) {
      throw new Error("Nombre y tipo son obligatorios");
    }

    if (typeof this.entidadRepository.findByNombreNormalized === "function") {
      const existente = await this.entidadRepository.findByNombreNormalized(nombre);
      if (existente) {
        throw new Error("Ya existe una entidad con ese nombre");
      }
    }

    const payload = { nombre, tipo };
    if (direccion !== undefined) {
      payload.direccion = direccion;
    }

    const entidad = await this.entidadRepository.create(payload);

    await this.logUseCase.execute({
      usuario_id: userId,
      accion: "CREAR",
      modulo: "ENTIDAD",
      referencia_id: entidad.id
    });

    return entidad;
  }
}
