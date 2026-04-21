import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import * as controller from "../controllers/helpdesk.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/threads", controller.listarThreads);
router.get("/threads/:id", controller.obtenerThread);
router.post("/threads", controller.crearThread);
router.post("/threads/:id/messages", controller.crearMensaje);
router.patch("/threads/:id", permisosAuth(["ADMIN_TOTAL"]), controller.actualizarThread);
router.get("/admins", controller.listarAdmins);

export default router;
