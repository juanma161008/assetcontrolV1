export default class CrearOrden {
  constructor(ordenRepository, logUseCase = null) {
    this.ordenRepository = ordenRepository;
    this.logUseCase = logUseCase;
  }

  async execute(data = {}, usuarioId = null) {
    const mantenimientos = Array.isArray(data.mantenimientos) ? data.mantenimientos : [];

    if (!mantenimientos.length) {
      throw new Error("Debe incluir mantenimientos");
    }

    if (usuarioId == null && data.creado_por == null) {
      return this.ordenRepository.create(data);
    }

    const now = new Date();
    const payload = {
      numero: data.numero || `OT-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
      fecha: data.fecha || now.toISOString().slice(0, 10),
      estado: data.estado || "Generada",
      creado_por: data.creado_por ?? usuarioId,
      mantenimientos
    };

    const orden = await this.ordenRepository.create(payload);

    if (this.logUseCase?.execute) {
      await this.logUseCase.execute({
        usuario_id: payload.creado_por,
        accion: "CREAR_ORDEN",
        entidad: "ORDEN",
        entidad_id: orden.id,
        despues: {
          numero: orden.numero,
          mantenimientos
        }
      });
    }

    return orden;
  }
}
