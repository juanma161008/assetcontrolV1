import { verifyToken } from "../../config/jwt.js";

const getBearerToken = (header = "") => {
  const value = String(header || "").trim();
  if (!value) {
    return null;
  }

  const [scheme, token, ...rest] = value.split(/\s+/);
  if (rest.length > 0 || !scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export default function jwtAuth(req, res, next) {
  // Bypass total en entorno de prueba.
  if (process.env.NODE_ENV === "test") {
    req.user = {
      id: 1,
      permisos: ["ADMIN_TOTAL"]
    };
    return next();
  }

  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      ...decoded,
      permisos: Array.isArray(decoded.permisos) ? decoded.permisos : []
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}
