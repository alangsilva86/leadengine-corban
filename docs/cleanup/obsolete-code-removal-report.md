# Obsolete Code Removal Report — Feature Flag Helpers & Test Stores

## Summary

During this cleanup iteration we removed unused helpers that were lingering after the WhatsApp transport refactor:

- **Shared feature-flag facade (`config/feature-flags.ts`)**: dropped server-only helpers (`getBackendFeatureFlags`, `isWhatsappDebugEnabled`) that were no longer consumed after the API adopted its dedicated configuration module.
- **WhatsApp API shims (`apps/api/src/config/whatsapp.ts`)**: deleted stale getters (`isStrictBrokerConfigEnabled`, `shouldBypassTenantGuards`) that duplicated logic now enforced in the consolidated config loader.
- **Legacy validation utilities**: removed the unused `assertValidSlug` helper alongside dormant in-memory reset helpers for ticket notes and user preferences.

## Validation

- Ran `pnpm test` to execute the API campaign E2E suite and confirm no regression in feature-flag dependent flows.
- Ran `pnpm test:playwright` to cover the browser-level WhatsApp inbox journey that previously relied on the removed stores.

Both suites completed successfully, confirming that the deletions did not introduce regressions.

## Follow-up Actions

1. **Storage mocks** — continue auditing `@ticketz/storage` mocks (e.g., `allocateBrokerLeads`) to determine if they can be migrated to Prisma-backed fixtures.
2. **Documentation refresh** — propagate the simplified feature-flag contract to onboarding material and internal runbooks.
3. **Observability check** — ensure dashboards monitoring WhatsApp passthrough and broker strict-mode toggles stay aligned with the reduced flag surface.
