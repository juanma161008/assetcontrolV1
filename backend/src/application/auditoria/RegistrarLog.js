export default class RegistrarLog {
  constructor(repo) {
    this.repo = repo;
  }

  normalizePayload(input) {
    if (!input || typeof input !== "object") {
      return {
        usuario_id: null,
        accion: "ACCION_DESCONOCIDA",
        entidad: "SISTEMA",
        entidad_id: null,
        antes: null,
        despues: null,
        ip: null
      };
    }

    return {
      usuario_id: input.usuario_id ?? input.usuarioId ?? input.userId ?? null,
      accion: input.accion ?? "ACCION_DESCONOCIDA",
      entidad: input.entidad ?? input.modulo ?? "SISTEMA",
      entidad_id: input.entidad_id ?? input.entidadId ?? input.referencia_id ?? null,
      antes: input.antes ?? null,
      despues: input.despues ?? input.detalles ?? null,
      ip: input.ip ?? null
    };
  }

  async execute(...args) {
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      return this.repo.create(this.normalizePayload(args[0]));
    }

    const [usuarioId, accion, entidadId, entidad = "SISTEMA"] = args;
    return this.repo.create(
      this.normalizePayload({
        usuario_id: usuarioId,
        accion,
        entidad,
        entidad_id: entidadId
      })
    );
  }

  async ejecutar(data) {
    return this.repo.create(data);
  }
}
