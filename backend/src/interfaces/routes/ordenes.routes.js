import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import auditLogger from "../middleware/auditlogger.js";
import * as controller from "../controllers/ordenes.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", controller.listar);
router.get("/por-mantenimiento/:mantenimientoId", controller.obtenerOrdenPorMantenimiento);
router.get("/:id/pdf", controller.descargarPdfOrden);
router.get("/:id/documento", controller.obtenerDocumentoOrden);
router.get("/:id", controller.obtenerPorId);

router.post(
  "/",
  permisosAuth(["GENERAR_ORDEN", "CREAR_MANTENIMIENTO"]),
  controller.crearOrden,
  auditLogger("CREAR", "ORDEN")
);

router.post(
  "/:id/firmar",
  permisosAuth(["FIRMAR_ORDEN", "CREAR_MANTENIMIENTO", "GENERAR_ORDEN"]),
  controller.firmarOrden,
  auditLogger("FIRMAR", "ORDEN")
);

router.post(
  "/:id/enviar-interventor",
  permisosAuth(["FIRMAR_ORDEN", "GENERAR_ORDEN"]),
  controller.enviarOrdenInterventor,
  auditLogger("ENVIAR_INTERVENTOR", "ORDEN")
);

router.post(
  "/:id/firmar-interventor",
  permisosAuth(["FIRMAR_ORDEN_INTERVENTOR"]),
  controller.firmarOrdenInterventor,
  auditLogger("FIRMAR_INTERVENTOR", "ORDEN")
);

router.post(
  "/:id/rechazar-interventor",
  permisosAuth(["FIRMAR_ORDEN_INTERVENTOR"]),
  controller.rechazarOrdenInterventor,
  auditLogger("RECHAZAR_INTERVENTOR", "ORDEN")
);

router.delete(
  "/:id",
  permisosAuth(["ADMIN_TOTAL"]),
  controller.eliminarOrden,
  auditLogger("ELIMINAR", "ORDEN")
);

export default router;
