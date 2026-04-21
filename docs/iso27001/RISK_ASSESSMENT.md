# Risk Assessment

## Methodology
- Likelihood (L): 1-5
- Impact (I): 1-5
- Risk Score = L x I
- Treatment: Mitigate / Transfer / Accept / Avoid

## Risk Register (Initial)
| ID | Risk | Asset | L | I | Score | Treatment | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Unauthorized access via weak credentials | User accounts | 3 | 5 | 15 | Mitigate | Security Lead |
| R-002 | Data loss due to backup failure | Database | 2 | 5 | 10 | Mitigate | Operations |
| R-003 | Vulnerable dependency in API | Backend API | 3 | 4 | 12 | Mitigate | Engineering |
| R-004 | Misconfigured CORS or headers | Backend API | 2 | 4 | 8 | Mitigate | Engineering |
| R-005 | Insider misuse of admin permissions | User accounts | 2 | 5 | 10 | Mitigate | Security Lead |

## Review
- Frequency: quarterly and after major changes.
- Evidence: attach tickets, scans, or incidents.
