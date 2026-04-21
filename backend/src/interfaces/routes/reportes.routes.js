import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import * as controller from "../controllers/reportes.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.post(
  "/kpi",
  permisosAuth(["ADMIN_TOTAL"]),
  controller.enviarReporteKpi
);

router.get(
  "/kpi",
  permisosAuth(["ADMIN_TOTAL"]),
  controller.obtenerReporteKpi
);

export default router;

