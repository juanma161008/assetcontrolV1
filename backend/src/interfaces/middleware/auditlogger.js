import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";

const repo = new LogPgRepository();

export default function auditLogger(accion, entidad) {
  return async (req, res, next) => {

    try {
      await repo.create({
        usuario_id: req.user.id,
        accion,
        entidad,
        entidad_id: res.locals.entidadId || null,
        antes: res.locals.antes || null,
        despues: res.locals.despues || null,
        ip: req.ip
      });
    } catch (e) {
      console.error("Audit log error:", e.message);
    }

    next();
  };
}
