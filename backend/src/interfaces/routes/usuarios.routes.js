import express from "express";
import jwtAuth from "../middleware/jwtAuth.js";
import permisosAuth from "../middleware/permisosAuth.js";
import * as controller from "../controllers/Usuarios.controller.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/", permisosAuth(["ADMIN_TOTAL"]), controller.listarUsuarios);
router.get("/roles", permisosAuth(["ADMIN_TOTAL"]), controller.listarRoles);
router.get("/catalogo/permisos", permisosAuth(["ADMIN_TOTAL"]), controller.listarCatalogoPermisos);

router.post("/", permisosAuth(["ADMIN_TOTAL", "CREAR_USUARIO"]), controller.crearUsuario);
router.put("/:id/permisos", permisosAuth(["ADMIN_TOTAL"]), controller.actualizarPermisosUsuario);

router.get("/:id", permisosAuth(["ADMIN_TOTAL"]), controller.obtenerUsuario);

router.put("/:id", permisosAuth(["ADMIN_TOTAL"]), controller.editarUsuario);

router.delete("/:id", permisosAuth(["ADMIN_TOTAL"]), controller.eliminarUsuario);

export default router;

