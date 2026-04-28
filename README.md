# AssetControl

AssetControl is a platform for managing technology assets, maintenance, and operations.

## Architecture

The repository is organized by responsibility so each layer stays focused:

- `backend/src/domain` holds entities and repository contracts.
- `backend/src/application` contains use cases and business workflows.
- `backend/src/infrastructure` contains concrete adapters such as database, email and PDF services.
- `backend/src/interfaces` contains HTTP controllers, middleware and routes.
- `frontend/src/app` composes the SPA shell and routing.
- `frontend/src/pages` contains feature screens.
- `frontend/src/components` holds shared UI pieces.
- `frontend/src/domain`, `frontend/src/services`, `frontend/src/utils` and `frontend/src/styles` keep frontend logic separated by concern.

For a module-by-module technical breakdown of the codebase, see `docs/arquitectura-tecnica.md`.

## Automated Notifications

Complementarily, the system includes an automated notifications module driven by events and business rules. It generates timely alerts through email and internal notifications to support proactive follow-up on preventive maintenance, warranty expirations, and critical asset-related events. This capability moves the platform closer to a predictive maintenance model, reduces operational uncertainty, and helps optimize resource availability.

## Repository Hygiene

The root `.gitignore` excludes generated and local-only artifacts such as `node_modules`, `dist`, `coverage`, `.scannerwork`, `tmp` and exported `.pptx` files.

## Security and Compliance

This project includes an ISMS starter pack aligned with ISO/IEC 27001:2022.
See `docs/iso27001/README.md` for scope, policies, and control records.

Current controls include:
- Passwords are hashed with `bcrypt` using a configurable work factor.
- Password reuse is blocked through a recent-password history policy.
- Auth endpoints use rate limiting and JWTs include issuer and audience checks.
- Access is protected by RBAC, audit logging, and least-privilege defaults.
- Production deployment assumes TLS at the edge and locked-down environment secrets.

Note: alignment does not imply certification.
