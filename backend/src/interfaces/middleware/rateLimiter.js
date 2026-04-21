import env from "../../config/env.js";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 12;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const buckets = new Map();

const getWindowMs = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MS;
};

const getMax = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX;
};

const getKey = (req, keyPrefix, keyGenerator) => {
  if (typeof keyGenerator === "function") {
    return keyGenerator(req);
  }
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  return `${keyPrefix}:${ip}`;
};

const cleanupBuckets = () => {
  const now = Date.now();
  buckets.forEach((entry, key) => {
    if (!entry || entry.expiresAt <= now) {
      buckets.delete(key);
    }
  });
};

const cleanupTimer = setInterval(cleanupBuckets, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

export const createRateLimiter = ({
  windowMs = env.AUTH_RATE_LIMIT_WINDOW_MS,
  max = env.AUTH_RATE_LIMIT_MAX,
  message = "Demasiadas solicitudes, intenta mas tarde.",
  keyPrefix = "rate-limit",
  keyGenerator
} = {}) => {
  const resolvedWindowMs = getWindowMs(windowMs);
  const resolvedMax = getMax(max);

  return (req, res, next) => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const now = Date.now();
    const key = getKey(req, keyPrefix, keyGenerator);
    const entry = buckets.get(key);

    if (!entry || entry.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + resolvedWindowMs });
      res.setHeader("X-RateLimit-Limit", resolvedMax);
      res.setHeader("X-RateLimit-Remaining", resolvedMax - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + resolvedWindowMs) / 1000));
      return next();
    }

    entry.count += 1;
    buckets.set(key, entry);

    const remaining = Math.max(resolvedMax - entry.count, 0);
    res.setHeader("X-RateLimit-Limit", resolvedMax);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.expiresAt / 1000));

    if (entry.count > resolvedMax) {
      return res.status(429).json({ error: message });
    }

    return next();
  };
};
