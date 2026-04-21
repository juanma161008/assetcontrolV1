export default function permisosAuth(permisosPermitidos = []) {
  return function (req, res, next) {

    if (!req.user?.permisos) {
      return res.status(403).json({
        success: false,
        message: "Sin permisos"
      });
    }

    if (req.user.permisos.includes("ADMIN_TOTAL")) {
      return next();
    }

    const permitido = permisosPermitidos.some(p =>
      req.user.permisos.includes(p)
    );

    if (!permitido) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado"
      });
    }

    next();
  };
}
