import { recordRequest } from "../../utils/metrics.js";

const getDurationMs = (start) => {
  if (typeof start === "bigint") {
    return Number((process.hrtime.bigint() - start) / 1000000n);
  }
  return Date.now() - start;
};

export default function requestLogger(req, res, next) {
  const start = process.hrtime?.bigint ? process.hrtime.bigint() : Date.now();

  res.on("finish", () => {
    const durationMs = getDurationMs(start);
    recordRequest({ status: res.statusCode, method: req.method });

    const logEntry = {
      level: res.statusCode >= 500 ? "error" : "info",
      message: "request",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      requestId: req.requestId,
      userId: req.user?.id ?? null,
      ip: req.ip
    };

    const output = JSON.stringify(logEntry);
    if (res.statusCode >= 500) {
      console.error(output);
    } else {
      console.log(output);
    }
  });

  next();
}
