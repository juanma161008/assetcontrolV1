# Access Control Policy

## Principles
- Least privilege by default.
- Role based access control (RBAC) aligned with job functions.
- Separation of duties for administrative operations.
- Deny by default when permissions are missing or ambiguous.

## Authentication
- Each user has a unique account and approved identity lifecycle.
- Passwords must be hashed before storage and never logged in plain text.
- Password policy:
  - Minimum 12 characters.
  - Uppercase, lowercase, number, and symbol required.
  - Recent password reuse is blocked.
  - Temporary passwords must be changed at first login.
- Authentication endpoints are rate limited to reduce brute force and credential stuffing.
- Admin accounts should use MFA where available.

## Session and Token Controls
- JWTs must be signed with a strong secret.
- Tokens must include issuer and audience validation.
- Session timeout and inactivity timeout must be enforced on the client and server.
- Sensitive sessions should be invalidated after password changes or suspicious activity.

## Privileged Access
- Admin actions are logged in audit trails.
- Privileged access is reviewed quarterly.
- Shared admin accounts are prohibited.

## Access Review
- Quarterly review of roles, permissions, and active admin accounts.
- Immediate revocation upon termination, role change, or compromise.

## Evidence
- Audit logs in backend `auditoria` module.
- Permission rules enforced in backend middleware.
- Password policy enforced in `backend/src/utils/passwordPolicy.js`.
- Password history and hashing policy enforced in backend auth flows.
