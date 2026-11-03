# Temporary owner-only self-study access

The owner requested all schools be closed to every other account on 2026-11-03.
The catalog stays public, displays the subscription at 150 RUB/month, and marks unfinished directions.

REG.RU serves static assets through Nginx, so Apache rules alone do not protect original JS/JSON files.
Reviewed school sources are preserved outside the web root in `private/numi-school-owner-20261103/sources/`.
Each snapshot filename is SHA-256 of its logical repository path. The PHP endpoint verifies the existing management account or Telegram owner before returning any source.
The existing private-content cache remains canonical for protected Matrix lesson JSON.

When updating the self-study, update the protected snapshots and keep these original paths closed on the public server.
Do not upload original school files through the general public-file publisher while the owner-only policy is active.
The dedicated deployment script backs up every moved file, verifies the published boundary, and rolls public changes back if verification fails.

The initial-install release marker is `.github/numi-school-access-release.json`.
Future source-only releases must preserve the gate and target the existing private snapshot location.
Changing this temporary audience requires an explicit user request; no payment entitlement is enabled by this display change.
