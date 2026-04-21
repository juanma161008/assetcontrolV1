export default class CrearActivo {
  constructor(activoRepository, logUseCase) {
    this.activoRepository = activoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(data, usuarioId) {
    if ((!data.nombre && !data.activo) || !data.equipo)
      throw new Error("Datos obligatorios faltantes");

    const activo = await this.activoRepository.create({
      ...data
    });

    await this.logUseCase.execute(usuarioId, "CREAR_ACTIVO", activo.id);

    return activo;
  }
}
