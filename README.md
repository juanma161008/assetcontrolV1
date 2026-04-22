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

## Repository Hygiene

The root `.gitignore` excludes generated and local-only artifacts such as `node_modules`, `dist`, `coverage`, `.scannerwork`, `tmp` and exported `.pptx` files.

## Security and Compliance

This project includes an ISMS starter pack aligned with ISO/IEC 27001:2022.
See `docs/iso27001/README.md` for scope, policies, and control records.

Note: alignment does not imply certification.
