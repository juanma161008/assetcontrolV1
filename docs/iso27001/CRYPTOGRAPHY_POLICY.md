# Cryptography Policy

## Objectives
- Protect data in transit and at rest.
- Define approved cryptographic standards.

## Requirements
- TLS 1.2+ for all external connections.
- Encrypt backups at rest.
- Secrets stored in a dedicated secret manager.
- Key rotation at least annually.

## Evidence
- TLS configuration in reverse proxy (Caddy or Nginx).
- Secret rotation records.
