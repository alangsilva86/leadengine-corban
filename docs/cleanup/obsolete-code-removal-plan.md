# Obsolete Code Removal Plan

## Objectives
- Map areas of the monorepo that still carry prototype or unused logic.
- Document a validation workflow to confirm whether each candidate can be safely removed.
- Provide a prioritized sequence for the cleanup effort, including tooling and regression checks.

## Repository Inventory
- **Applications**: `apps/api` (Express backend), `apps/web` (React/Vite frontend), `apps/baileys-acessuswpp` (Render deployment manifest only).
- **Shared packages**: Domain contracts (`packages/contracts`), core domain logic (`packages/core`), shared utilities (`packages/shared`), storage abstractions (`packages/storage`), third-party integrations (`packages/integrations`), and WhatsApp specific contracts (`packages/wa-contracts`).
- **Docs & scripts**: Extensive documentation in `docs/**` plus maintenance scripts under `scripts/`.

## Discovery Tooling
1. `pnpm ts-prune` → identifies unused TypeScript exports (current run highlights ~150 symbols across API, domain packages, and configs).  
2. `pnpm depcheck` → validates dependencies; current result reports no unused packages.  
3. Manual inspection of flagged files to understand whether the exports are legacy, test-only, or awaiting integration.

## Candidate Areas & Validation Steps

### 1. Domain type duplications (`packages/core`)
- `packages/core/src/index.ts` re-exports large sets of domain DTOs, events, and use cases even when only a subset is consumed; `ts-prune` reports most of these exports unused in the workspace.  
- **Plan**:
  1. Confirm actual imports from `@ticketz/core` across `apps/**` and `packages/**` using `rg "@ticketz/core" -g"*.ts"` to see which types remain referenced.
  2. Move unused legacy types (e.g., lead attribution entities) into a `legacy/` submodule or delete if business has deprecated these workflows.
  3. Update generated declaration files and re-run `pnpm --filter @ticketz/core build` plus workspace type-check.

### 2. Legacy feature flag helpers (`apps/api/src/config/feature-flags.ts`)
- Exports such as `isWhatsappInboundSimpleModeEnabled` and `refreshFeatureFlags` are no longer referenced in the API layer.  
- **Plan**:
  1. Verify via `rg "whatsappInboundSimpleMode" apps/api/src` to ensure no runtime usage.  
  2. Remove dead branches and simplify the feature flag object.  
  3. Adjust configuration docs under `docs/environments/` to match the reduced surface area.

### 3. Unused middleware helpers (`apps/api/src/middleware/auth.ts`)
- Demo-only guards `requirePermission`, `requireRole`, and `optionalAuth` are exported but not wired to routes.  
- **Plan**:
  1. Confirm no tests rely on these functions (`rg "requirePermission"`).  
  2. If future RBAC is planned, move them into a feature branch; otherwise delete and keep only `authMiddleware` and helpers that are actually invoked.  
  3. Update API route handlers to rely on new auth implementation once available.

### 4. Prisma lifecycle helpers (`apps/api/src/lib/prisma.ts`)
- `connectDatabase` is unused after adopting lazy Prisma client instantiation.  
- **Plan**:
  1. Validate that CLI scripts or tests do not import it.  
  2. Remove the function and related listeners if redundant, ensuring graceful shutdown still works through `$disconnect` hooks.  
  3. Document database bootstrap flow in `docs/migrations/`.

### 5. Phone utilities (`apps/api/src/utils/phone.ts`)
- `isValidPhoneNumber` wrapper is currently unused; only `normalizePhoneNumber` is required.  
- **Plan**: search for potential UI usage; if none, delete and rely on schema validation when needed.

### 6. In-memory stores for tests (`apps/api/src/data/**` and `apps/api/src/test-utils/storage-mock.ts`)
- Numerous helpers (e.g., `resetTicketNotes`, `resetUserPreferencesStore`, `allocateBrokerLeads`) support old test setups.  
- **Plan**:
  1. Audit existing Vitest suites to confirm whether newer Prisma-backed mocks replaced these utilities.  
  2. If redundant, remove the store modules and migrate any remaining tests to rely on generated fixtures.

### 7. WhatsApp inbound queue helpers
- `apps/api/src/features/whatsapp-inbound/queue/event-queue.ts` exposes queue normalization and metric helpers that `ts-prune` flags as unused externally.  
- **Plan**:
  1. Check whether these functions are supposed to be triggered by background workers (possibly outside repo).  
  2. If not, consolidate the module by retaining only the message normalizer used by HTTP ingestion.

### 8. Render-only deployment (`apps/baileys-acessuswpp/render.yaml`)
- Contains deployment metadata for a Baileys service but there is no application code; confirm if the service has been retired.  
- **Plan**: remove folder if infrastructure now managed elsewhere, or migrate the manifest to infra repo.

### 9. Documentation sweep
- Legacy WhatsApp broker docs (`docs/whatsapp-broker-refactor.md`, `docs/whatsapp-broker-contracts.md`) may no longer describe the active implementation.  
- **Plan**: cross-check with current integration under `packages/integrations` and either archive outdated docs or update them to align with present flows.

## Verification Checklist Before Deletion
1. Run `pnpm lint`, `pnpm typecheck`, and the API e2e suite after each removal batch.
2. Ensure Prisma migrations and seed scripts continue to work (`pnpm --filter @ticketz/api dev` smoke test).
3. For frontend deletions, run `pnpm --filter web build` and Storybook if components are touched.
4. Update CI configuration if any pipeline references removed scripts.

## Deliverables
- Incremental PRs removing unused exports/functions along with regression coverage adjustments.
- Updated documentation summarizing feature flag and domain model changes.
- Changelog entry referencing the cleanup for visibility.
