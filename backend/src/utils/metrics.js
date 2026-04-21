const startedAt = Date.now();

const metrics = {
  startedAt,
  totalRequests: 0,
  totalErrors: 0,
  statusCounts: {},
  methodCounts: {}
};

const increment = (bucket, key) => {
  const safeKey = String(key || "unknown");
  bucket[safeKey] = (bucket[safeKey] || 0) + 1;
};

export const recordRequest = ({ status, method }) => {
  metrics.totalRequests += 1;
  if (Number(status) >= 500) {
    metrics.totalErrors += 1;
  }
  increment(metrics.statusCounts, status);
  increment(metrics.methodCounts, method);
};

export const getMetricsSnapshot = () => ({
  startedAt: new Date(metrics.startedAt).toISOString(),
  uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
  totalRequests: metrics.totalRequests,
  totalErrors: metrics.totalErrors,
  statusCounts: { ...metrics.statusCounts },
  methodCounts: { ...metrics.methodCounts }
});
