# Package export map

This document summarises the public surface of each internal package under `packages/` and highlights where their exports are consumed inside the monorepo.

## `@ticketz/core`

**Exports**

- Error hierarchy utilities: `DomainError`, `ValidationError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, and `ForbiddenError` re-exported from the domain type module.【F:packages/core/src/index.ts†L1-L8】

**Consumers**

- Request validation middleware wraps schema failures in `ValidationError`.【F:apps/api/src/middleware/validation.ts†L1-L19】
- Global API error handler inspects the full error hierarchy to normalise responses.【F:apps/api/src/middleware/error-handler.ts†L1-L40】
- Lead CRUD routes rely on `ValidationError`/`NotFoundError` for control flow.【F:apps/api/src/routes/leads.ts†L1-L40】
- Contact onboarding and manual conversation routes use `ConflictError`/`ValidationError` for business rule breaches.【F:apps/api/src/routes/contacts.ts†L1-L43】【F:apps/api/src/routes/manual-conversations.ts†L1-L57】
- WhatsApp integration endpoints surface missing resource errors as `NotFoundError`.【F:apps/api/src/routes/integrations/whatsapp.messages.ts†L1-L19】
- Ticket service layer throws `ConflictError`/`NotFoundError` when storage operations fail.【F:apps/api/src/services/ticket-service.ts†L1-L28】
- Debug tooling and inbound WhatsApp ingestion guard privileged operations with the core errors.【F:apps/api/src/features/debug/services/whatsapp-debug.ts†L1-L12】【F:apps/api/src/features/whatsapp-inbound/services/inbound-lead-service.ts†L1-L26】

**Notes**

- Legacy subpath bundles for `./tickets` and `./leads` have been removed to eliminate duplicate error exports; the package now only exposes its canonical root entry point.【F:packages/core/package.json†L1-L42】【F:packages/core/tsup.config.ts†L1-L33】

## `@ticketz/shared`

**Exports**

- Version markers and aggregate re-exports for `config`, `logger`, and `utils`. These currently expose placeholder constants (`SHARED_VERSION`, `CONFIG_VERSION`, `UTILS_VERSION`).【F:packages/shared/src/index.ts†L1-L15】【F:packages/shared/src/config/index.ts†L1-L1】【F:packages/shared/src/logger/index.ts†L1-L3】【F:packages/shared/src/utils/index.ts†L1-L1】

**Consumers**

- No runtime imports reference the package yet; it is only marked as an external dependency in the API bundler configuration, so future code can adopt it without bundling overhead.【F:apps/api/tsup.config.ts†L1-L21】

## `@ticketz/integrations`

**Exports**

- Version flag plus media storage helper and related types for integration adapters.【F:packages/integrations/src/index.ts†L1-L11】【F:packages/integrations/src/utils/media-storage.ts†L1-L40】
- `MessageProvider` contract for outbound integration providers.【F:packages/integrations/src/types/message-provider.ts†L1-L9】

**Consumers**

- No first-party code imports the helpers yet; the package is wired as an external for the API bundle, so future integration workers can depend on it without duplicate code paths.【F:apps/api/tsup.config.ts†L1-L21】

**Notes**

- The ad-hoc console logger previously duplicated the shared logger surface and had no dependants; it has been removed so the package only exposes the canonical media helper types.【F:packages/integrations/src/index.ts†L1-L11】

## `@ticketz/storage`

**Exports**

- Prisma client wiring helpers (`getPrismaClient`, `setPrismaClient`).【F:packages/storage/src/index.ts†L1-L56】
- Campaign repository API (`CampaignStatus`, `Campaign`, CRUD functions, reset helper).【F:packages/storage/src/index.ts†L5-L29】
- Lead allocation repository (`allocateBrokerLeads`, `listAllocations`, `updateAllocation`, `getCampaignMetrics`, DTO types, and reset helper).【F:packages/storage/src/index.ts†L8-L20】
- Ticket repository surface (ticket/message CRUD helpers, passthrough mappers, broker ACK helpers, reset helper, and associated types).【F:packages/storage/src/index.ts†L31-L55】

**Consumers**

- API Prisma bootstrap links the shared Prisma client into the storage layer at runtime.【F:apps/api/src/lib/prisma.ts†L100-L114】
- Lead allocation store reads and mutates allocation data via the exported DTOs and repository helpers.【F:apps/api/src/data/lead-allocation-store.ts†L1-L159】
- Lead Engine routes call campaign management helpers (`createOrActivateCampaign`, `listCampaigns`, metrics) and allocation APIs to implement HTTP endpoints.【F:apps/api/src/routes/lead-engine.ts†L1-L25】
- Ticket HTTP routes and service layer use the ticket repository exports for CRUD, message dispatch, and passthrough mapping.【F:apps/api/src/routes/tickets.ts†L1-L30】【F:apps/api/src/services/ticket-service.ts†L1-L28】
- Debug tooling references `mapPassthroughMessage` and reset helpers to expose test utilities.【F:apps/api/src/features/debug/routes/messages.ts†L1-L12】【F:apps/api/src/features/debug/services/whatsapp-debug.ts†L1-L12】

## `@ticketz/contracts`

**Exports**

- Message payload schemas (`SendByTicketSchema`, `SendByContactSchema`, `SendByInstanceSchema`) and normalisation helpers used to validate outbound requests.【F:packages/contracts/src/messages.ts†L333-L420】
- Generated OpenAPI types re-exported from the root index for API clients.【F:packages/contracts/src/index.ts†L1-L2】
- Contact response schemas have been retired; clients should source typings from the generated OpenAPI definitions instead of the removed `contacts.ts` module.【F:packages/contracts/src/index.ts†L1-L2】

**Consumers**

- Message routes (`/contacts`, `/tickets`, `/integrations/whatsapp`) validate request bodies with the exported schemas and normalise payloads before dispatching to storage/integration layers.【F:apps/api/src/routes/messages.contact.ts†L1-L33】【F:apps/api/src/routes/messages.ticket.ts†L1-L37】【F:apps/api/src/routes/integrations/whatsapp.messages.ts†L1-L19】
- Ticket service consumes the normalised payload types and outbound response/error contracts when orchestrating sends.【F:apps/api/src/services/ticket-service.ts†L60-L70】

## `@ticketz/wa-contracts`

**Exports**

- WhatsApp transport schemas, canonical error catalogue, resolver helper, and rich error class for broker integrations.【F:packages/wa-contracts/src/v1/index.ts†L125-L192】

**Consumers**

- Ticket service and routes propagate canonical transport errors to clients and broker wrappers.【F:apps/api/src/services/ticket-service.ts†L41-L46】【F:apps/api/src/routes/tickets.ts†L35-L44】
- WhatsApp integration routes detect broker failures and normalise error reporting with the canonical error utilities.【F:apps/api/src/routes/integrations/whatsapp.messages.ts†L1-L19】
- Broker client maps raw broker responses to canonical errors for downstream handling.【F:apps/api/src/services/whatsapp-broker-client.ts†L1-L20】

## Observations from `pnpm depcheck`

Running the workspace depcheck surfaced `@prisma/client` and `prisma` as unused dependencies; the tool cannot observe the dynamic imports that link the Prisma client into `@ticketz/storage`, so these are false positives rather than actionable removals.【5e12c8†L1-L4】
