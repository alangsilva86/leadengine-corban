# CRM Quality & Observability Plan

## Storybook Coverage
- `CrmToolbar` with default, loading, empty saved views, and bulk actions disabled.
- `CrmMetricsBelt` showcasing API data vs fallback mode.
- Kanban components: `LeadCard`, `StageColumn`, and the full `LeadKanbanView` with selectable states.
- `LeadCalendarView` illustrating tasks in range, empty day, and permissions-disabled interactions.
- `LeadAgingView` heatmap with varied buckets and pull-forward controls.
- `LeadInsightsView` widgets demonstrating loading vs hydrated data.

## Testing Scope
- Hooks (`useCrmMetrics`, `useCrmLeads`, `useCrmTasks`, `useCrmTimeline`, `useCrmAging`, `useCrmPermissions`) validating caching, fallbacks, and permission gating.
- Component interactions: selection (Kanban/List), drawer actions, aging pull-forward button, calendar navigation, insights navigation.
- Telemetry emissions for key events (`crm.view.change`, `crm.lead.open`, `crm.lead.move`, `crm.lead.pull_forward`, `crm.metrics.refresh`, `crm.insights.navigate`).
- Permissions enforcement (agent vs manager) in table/kanban/calendar/drawer.

## Observability
- Extend API logging to include `crm.*` routes with request timing (leveraging existing `requestLogger`).
- Emit structured telemetry via `emitCrmTelemetry`; ensure backend logs correlate by including `scope: 'crm'`.
- Prepare dashboards for lead metrics refresh latency and error rates once real endpoints replace stubs.

## Next Steps
1. Implement Storybook stories listed above.
2. Add Vitest + Testing Library suites for hooks/components and telemetry assertions.
3. Enhance backend telemetry/logging around `/api/crm/*` once business logic is in place.
