import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import * as controller from "../controllers/notificaciones.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", controller.listarNotificaciones);
router.delete("/", controller.eliminarTodasNotificaciones);
router.patch("/marcar-todas", controller.marcarTodasLeidas);
router.patch("/:id/leido", controller.marcarNotificacionLeida);
router.delete("/:id", controller.eliminarNotificacion);
router.post("/email", controller.enviarCorreo);

export default router;
