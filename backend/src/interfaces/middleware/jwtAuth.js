import { verifyToken } from "../../config/jwt.js";

export default function jwtAuth(req, res, next) {

  // ✅ En entorno test — bypass total
  if (process.env.NODE_ENV === "test") {
    req.user = {
      id: 1,
      permisos: ["ADMIN_TOTAL"]
    };
    return next();
  }

  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({ error: "Token requerido" });

  const token = header.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
