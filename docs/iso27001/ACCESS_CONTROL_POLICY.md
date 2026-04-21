# Access Control Policy

## Principles
- Least privilege by default.
- Role based access control (RBAC) aligned with job functions.
- Separation of duties for administrative operations.

## User Access
- All users are uniquely identified.
- Access granted on approved requests only.
- Password policy: minimum 12 characters with upper, lower, number, and symbol.
- Auth endpoints are rate limited to reduce brute force attempts.
- MFA is planned for admin roles; until enabled, admin access is restricted by RBAC and monitored.

## Admin Access
- Admin actions are logged in audit trails.
- Privileged access is reviewed quarterly.

## Access Review
- Quarterly review of roles and permissions.
- Immediate revocation upon termination or role change.

## Evidence
- Audit logs in backend `auditoria` module.
- Permission rules enforced in backend middleware.
- Password policy enforced in `backend/src/utils/passwordPolicy.js`.
