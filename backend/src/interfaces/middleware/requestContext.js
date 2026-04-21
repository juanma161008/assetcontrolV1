import crypto from "node:crypto";

const getRequestId = (req) => {
  const headerValue = req.headers["x-request-id"];
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  return crypto.randomUUID();
};

export default function requestContext(req, res, next) {
  const requestId = getRequestId(req);
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
}
