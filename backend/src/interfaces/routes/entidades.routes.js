import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import {
  listarEntidades,
  crearEntidad,
  obtenerEntidad,
  editarEntidad,
  eliminarEntidad
} from "../controllers/entidades.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", permisosAuth(["VER_ACTIVOS"]), listarEntidades);
router.get("/:id", permisosAuth(["VER_ACTIVOS"]), obtenerEntidad);

router.post("/", permisosAuth(["ADMIN_TOTAL"]), crearEntidad);
router.put("/:id", permisosAuth(["ADMIN_TOTAL"]), editarEntidad);
router.delete("/:id", permisosAuth(["ADMIN_TOTAL"]), eliminarEntidad);

export default router;

