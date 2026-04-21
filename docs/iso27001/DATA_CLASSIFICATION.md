# Data Classification

## Classes
- Public: marketing or public docs.
- Internal: business information not for public release.
- Confidential: user data, audit logs, credentials.
- Restricted: secrets, encryption keys, admin credentials.

## Handling Rules
- Confidential and Restricted data must be encrypted in transit.
- Restricted data stored only in approved secret managers.
- Data sharing requires approval by Data Owner.

## Examples in AssetControl
- User profile data: Confidential
- Audit logs: Confidential
- JWT secret: Restricted
