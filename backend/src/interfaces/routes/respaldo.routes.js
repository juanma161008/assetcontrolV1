import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import * as controller from "../controllers/respaldo.controller.js";

const router = express.Router();

router.use(jwtAuth);
router.use(permisosAuth(["ADMIN_TOTAL"]));

router.get("/configuracion", controller.obtenerConfiguracion);
router.put("/configuracion", controller.guardarConfiguracion);
router.post("/ejecutar", controller.ejecutarRespaldoAhora);
router.get("/descargar", controller.descargarRespaldo);

export default router;
