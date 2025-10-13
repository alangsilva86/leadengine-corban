# Changelog

## 2025-02-14

### Changed
- Documented the unified WhatsApp transport interface and consolidated the inbound pipeline without fallbacks across README, ADR 0003 and architecture notes.
- Updated deployment guides and Docker Compose manifests to require the persistent `whatsapp_sessions_data` volume and clarify `WHATSAPP_MODE` rollback.
- Enhanced `scripts/whatsapp-smoke-test.mjs` to auto-detect transport mode via `/healthz`, support sidecar pipelines and optional API keys.
- Removed zombie dependencies, introduced `pnpm depcheck`/`pnpm ts-prune` scripts and added missing workspace dependencies.

### Added
- Recorded dependency audit results in `DEPLOY_REPORT.md` and introduced this changelog for future releases.
