# Logging and Monitoring

## Objectives
- Detect anomalous activity.
- Provide auditability for critical actions.
- Support incident investigations.

## Log Sources
- API request logs (request id, user id, status, duration).
- Audit logs for critical actions.
- Infrastructure logs (reverse proxy, database).

## Retention
- Online retention: 90 days minimum.
- Archive retention: 12 months minimum.

## Monitoring
- Alerts on repeated auth failures.
- Alerts on 5xx error spikes.
- Alerts on unusual admin activity.

## Evidence
- Backend request logs in `backend/src/interfaces/middleware/requestLogger.js`.
- Audit routes under `/api/auditoria`.
