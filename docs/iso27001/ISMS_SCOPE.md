# ISMS Scope Statement

## Organization
- Organization: MicroCinco
- System: AssetControl (web app + API + database + deployment pipeline)
- Version: 1.0
- Date: 2026-03-30

## Scope
The ISMS covers the design, development, deployment, operation, and support of AssetControl, including:
- Backend API (Node.js/Express) and supporting services.
- Frontend web application.
- Database and data storage used by the product.
- CI/CD and deployment assets in `deploy/`.
- Monitoring, logging, and audit logs.
- Access management for users, admins, and support staff.

## In Scope Assets
- Source code repositories.
- Production and staging environments.
- Configuration and secrets management for the application.
- User data, audit logs, and operational metrics.

## Out of Scope
- End-user devices and networks outside managed environments.
- Third-party SaaS platforms not directly controlled by MicroCinco (unless explicitly listed as suppliers).
- Personal devices of contractors without MDM controls.

## Interfaces and Dependencies
- Email delivery (SMTP configured via environment variables).
- Infrastructure providers (hosting, storage, DNS) as documented in `docs/iso27001/SUPPLIER_SECURITY.md`.

## Assumptions
- Security responsibilities are shared with infrastructure providers.
- Availability and backup requirements are defined in `docs/iso27001/BUSINESS_CONTINUITY.md`.
