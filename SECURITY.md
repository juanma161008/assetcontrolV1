# Security Policy

## Scope
This policy covers the AssetControl application, its backend API, frontend SPA, deployment artifacts, and supporting documentation.

## Security Baseline
- All passwords must be hashed with `bcrypt`.
- Password reuse is blocked using a recent-password history policy.
- Authentication endpoints are rate limited.
- JWTs must be signed with a strong secret and validated with issuer and audience checks.
- Authorization follows least privilege and RBAC.
- Critical actions must be audited.
- Production traffic must use TLS.

## Operational Requirements
- Store secrets only in environment variables or a managed secret store.
- Use unique credentials per environment.
- Rotate secrets periodically and immediately after suspected exposure.
- Keep backups encrypted at rest.
- Review admin and privileged access regularly.
- Keep logs for security-relevant events such as login, password changes, and permission changes.

## Incident Reporting
Report suspected vulnerabilities or security incidents to:

`security@microcinco.example`

Include:
- Affected component and version
- Steps to reproduce
- Impact assessment
- Suggested mitigation, if known

## Response Timeline
- Acknowledge within 3 business days
- Triage and mitigation plan within 10 business days
- Coordinate disclosure after a fix is available

## Disclosure Rule
Do not publicly disclose vulnerabilities until the issue has been reviewed and a fix or mitigation path exists.
