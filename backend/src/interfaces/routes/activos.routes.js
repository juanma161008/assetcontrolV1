import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import auditLogger from "../middleware/auditlogger.js";

import * as controller from "../controllers/activos.controller.js";
import * as bajasController from "../controllers/bajasActivos.controller.js";

const router = express.Router();

// Todas las rutas protegidas
router.use(jwtAuth);

// Listar activos
router.get(
  "/",
  permisosAuth(["VER_ACTIVOS"]),
  controller.listarActivos
);

// Bajas de activos
router.get(
  "/bajas",
  permisosAuth(["VER_ACTIVOS"]),
  bajasController.listarBajas
);

router.post(
  "/bajas",
  permisosAuth(["VER_ACTIVOS"]),
  bajasController.crearBaja
);

router.patch(
  "/bajas/:id/aprobar",
  permisosAuth(["ADMIN_TOTAL"]),
  bajasController.aprobarBaja
);

router.patch(
  "/bajas/:id/rechazar",
  permisosAuth(["ADMIN_TOTAL"]),
  bajasController.rechazarBaja
);

// Crear activo
router.post(
  "/",
  permisosAuth(["CREAR_ACTIVO"]),
  controller.crearActivo,
  auditLogger("CREAR", "ACTIVO")
);

// Importar activos (XLSM/XLSX/CSV procesado en frontend)
router.post(
  "/import",
  permisosAuth(["CREAR_ACTIVO"]),
  controller.importarActivos
);

// Editar activo
router.put(
  "/:id",
  permisosAuth(["EDITAR_ACTIVO"]),
  controller.editarActivo,
  auditLogger("EDITAR", "ACTIVO")
);

// Eliminar activo
router.delete(
  "/:id",
  permisosAuth(["ADMIN_TOTAL"]),
  controller.eliminarActivo,
  auditLogger("ELIMINAR", "ACTIVO")
);

export default router;
