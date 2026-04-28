# Cryptography Policy

## Objectives
- Protect data in transit and at rest.
- Define approved cryptographic standards for the platform.
- Ensure credentials are never stored or transmitted in plain text.

## Approved Controls
- TLS 1.2+ for all external connections.
- Passwords hashed with `bcrypt` and a configurable work factor.
- Password reuse history enforced on password changes and resets.
- Verification codes and sensitive tokens stored hashed where applicable.
- Backups encrypted at rest and protected with access control.
- Secrets stored in a dedicated secret manager or environment variables outside source control.

## Key Management
- Keys and secrets must be rotated on a scheduled basis and after suspected compromise.
- Production secrets must be unique per environment.
- JWT signing keys must be long, random, and never shared with frontend code.

## Evidence
- TLS configuration in reverse proxy (Caddy or Nginx).
- Backend hash implementation in `backend/src/utils/hash.js`.
- Password history enforcement in `backend/src/utils/passwordSecurity.js`.
- Secret rotation records and backup encryption evidence.
