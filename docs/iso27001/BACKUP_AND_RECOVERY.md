# Backup and Recovery

## Objectives
- Restore data within defined RTO/RPO.
- Ensure backups are encrypted and tested.

## Backup Policy
- Daily full backup of production database.
- Weekly snapshot of application configuration.
- Encrypted backups stored in a separate location.
- PostgreSQL dumps are exported with `npm run backup:db` and saved to the configured local folder, ideally one synced with Google Drive for desktop.
- If no backup folder is configured, the backup falls back to `tmp/backups` or another off-site path.
- Automatic daily execution is handled by a Windows scheduled task that runs the backup wrapper.

## Testing
- Restore tests at least quarterly.
- Document results and remediation.

## RTO/RPO Targets
- RTO: 4 hours
- RPO: 24 hours

## Evidence
- Backup logs and restore test reports.
