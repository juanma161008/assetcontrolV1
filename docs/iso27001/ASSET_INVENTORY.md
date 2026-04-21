# Asset Inventory

This inventory must be maintained and reviewed quarterly.

| Asset | Description | Owner | Classification | Location | Criticality |
| --- | --- | --- | --- | --- | --- |
| Backend API | Node.js/Express service | Engineering | Internal | `backend/` + runtime | High |
| Frontend Web | React UI | Engineering | Internal | `frontend/` + CDN | Medium |
| Database | PostgreSQL (assumed) | Operations | Confidential | Managed DB | High |
| Audit Logs | Security events and changes | Security Lead | Confidential | Database + log store | High |
| CI/CD Pipeline | Build and deploy pipeline | Engineering | Internal | CI provider | Medium |
| Secrets | JWT secret, SMTP creds, DB creds | Operations | Restricted | Secret manager | High |

## Notes
- Update with real hosting details and vendor names.
- Link supplier records in `docs/iso27001/SUPPLIER_SECURITY.md`.
