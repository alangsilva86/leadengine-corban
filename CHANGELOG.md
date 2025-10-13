# Changelog

## 2025-03-01

### Breaking
- WhatsApp transport now runs exclusively in HTTP mode; deprecated dry-run, disabled and sidecar pipelines have been removed. Environments must drop the `WHATSAPP_MODE` toggle and rely on broker configuration alone.

### Changed
- Health payloads, integration routes and smoke tests now always report the HTTP transport and surface configuration errors when the broker is incomplete.
- Documentation and observability guides no longer reference dry-run/disabled modes and explain the single-mode rollout, including migration steps for integrators.
- Docker Compose manifests no longer mount the deprecated `whatsapp_sessions_data` volume and omit unused WhatsApp mode environment variables.

### Removed
- Legacy sidecar runtime, dry-run transport and related feature flag plumbing have been deleted from the API codebase.
## 2025-02-25

### Changed
- Removed support for the WhatsApp sidecar transport across docs and Docker manifests, standardising on the HTTP broker configuration.

### Removed
- Dropped the `whatsapp_sessions_data` volume and any sidecar-specific environment variables from local and production Compose files. Operators should delete the orphaned volume and decommission sidecar containers during the upgrade.

## 2025-02-14

### Changed
- Documented the unified WhatsApp transport interface and consolidated the inbound pipeline without fallbacks across README, ADR 0003 and architecture notes.
- Updated deployment guides and Docker Compose manifests to require the persistent `whatsapp_sessions_data` volume and clarify `WHATSAPP_MODE` rollback (superseded by the 2025-03-01 HTTP-only release).
- Enhanced `scripts/whatsapp-smoke-test.mjs` to auto-detect transport mode via `/healthz`, support sidecar pipelines and optional API keys.
- Removed zombie dependencies, introduced `pnpm depcheck`/`pnpm ts-prune` scripts and added missing workspace dependencies.

### Added
- Recorded dependency audit results in `DEPLOY_REPORT.md` and introduced this changelog for future releases.
