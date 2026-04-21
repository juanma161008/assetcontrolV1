const normalizeTipo = (value = "") => String(value || "").trim().toLowerCase();
const isPuntoRedTipo = (value = "") => (
  normalizeTipo(value) === "preventivo punto de red" ||
  normalizeTipo(value) === "instalacion punto de red"
);
const isCronogramaTipo = (value = "") => normalizeTipo(value) === "cronograma";

export default class CrearMantenimiento {
  constructor(mantenimientoRepository, activoRepository, logUseCase) {
    this.mantenimientoRepository = mantenimientoRepository;
    this.activoRepository = activoRepository;
    this.logUseCase = logUseCase;
  }

  async execute(data, usuarioId) {
    const activoIdRaw = data?.activo_id ?? data?.activo;
    const hasActivoId =
      activoIdRaw !== null &&
      activoIdRaw !== undefined &&
      String(activoIdRaw).trim() !== "";
    const activoId = hasActivoId ? Number(activoIdRaw) : null;
    const puntoRedPreventivo = isPuntoRedTipo(data?.tipo);
    const cronogramaGeneral = isCronogramaTipo(data?.tipo);

    if (!hasActivoId && !puntoRedPreventivo && !cronogramaGeneral) {
      throw new TypeError("Activo no existe");
    }

    if (hasActivoId && !Number.isFinite(activoId)) {
      throw new TypeError("Activo no existe");
    }

    if (Number.isFinite(activoId)) {
      const activo = await this.activoRepository.findById(activoId);

      if (!activo) {
        throw new Error("Activo no existe");
      }
    }

    const payload = {
      ...data,
      activo_id: Number.isFinite(activoId) ? activoId : null,
      tipo: puntoRedPreventivo ? "Preventivo Punto De Red" : data?.tipo
    };

    const tecnicoIdRaw = data?.tecnico_id;
    const tecnicoId =
      tecnicoIdRaw === null || tecnicoIdRaw === undefined || tecnicoIdRaw === ""
        ? null
        : Number(tecnicoIdRaw);

    if (Number.isFinite(tecnicoId)) {
      payload.tecnico_id = tecnicoId;
    }

    const mantenimiento = await this.mantenimientoRepository.create(payload);

    await this.logUseCase.execute(usuarioId, "CREAR_MANTENIMIENTO", mantenimiento.id);

    return mantenimiento;
  }
}
