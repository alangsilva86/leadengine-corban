export type CrmTelemetryEvent = 'crm.view.change' | 'crm.lead.open' | 'crm.lead.move' | 'crm.lead.pull_forward' | 'crm.filter.save' | 'crm.filter.use' | 'crm.bulk.update' | 'crm.metrics.refresh' | 'crm.insights.navigate';
export type CrmTelemetryPayload = Record<string, unknown>;
export declare const emitCrmTelemetry: (event: CrmTelemetryEvent, payload?: CrmTelemetryPayload) => void;
export default emitCrmTelemetry;
