import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import auditLogger from "../middleware/auditlogger.js";
import * as controller from "../controllers/mantenimientos.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get(
  "/",
  permisosAuth(["CREAR_MANTENIMIENTO", "EDITAR_MANTENIMIENTO", "ELIMINAR_MANTENIMIENTO"]),
  controller.listarMantenimientos
);

router.post(
  "/",
  permisosAuth(["CREAR_MANTENIMIENTO"]),
  controller.crearMantenimiento,
  auditLogger("CREAR", "MANTENIMIENTO")
);

router.put(
  "/:id",
  permisosAuth(["EDITAR_MANTENIMIENTO"]),
  controller.editarMantenimiento,
  auditLogger("EDITAR", "MANTENIMIENTO")
);

router.delete(
  "/:id",
  permisosAuth(["ELIMINAR_MANTENIMIENTO"]),
  controller.eliminarMantenimiento,
  auditLogger("ELIMINAR", "MANTENIMIENTO")
);

router.post(
  "/:id/recordatorio",
  permisosAuth(["EDITAR_MANTENIMIENTO"]),
  controller.enviarRecordatorio
);
export default router;

