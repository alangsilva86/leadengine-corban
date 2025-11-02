export type CrmTelemetryEvent =
  | 'crm.view.change'
  | 'crm.lead.open'
  | 'crm.lead.move'
  | 'crm.lead.pull_forward'
  | 'crm.filter.save'
  | 'crm.filter.use'
  | 'crm.bulk.update'
  | 'crm.metrics.refresh'
  | 'crm.insights.navigate';

export type CrmTelemetryPayload = Record<string, unknown>;

const sanitizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // Mascarar CPFs/CNPJs/telefones básicos
    if (/^\d{11}$/.test(trimmed)) {
      return `${trimmed.slice(0, 3)}******${trimmed.slice(-2)}`;
    }
    if (/^\d{14}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}********${trimmed.slice(-2)}`;
    }
    if (/^\+?\d{10,15}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]));
  }
  return value;
};

export const emitCrmTelemetry = (event: CrmTelemetryEvent, payload: CrmTelemetryPayload = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  const detail = {
    scope: 'crm',
    event,
    timestamp: Date.now(),
    ...sanitizeValue(payload),
  };

  try {
    window.dispatchEvent(new CustomEvent('leadengine:crm-telemetry', { detail }));
  } catch (error) {
    console.warn('CRM telemetry dispatch failed', { event, payload, error });
  }

  const analytics = (window as any)?.analytics;
  if (analytics && typeof analytics.track === 'function') {
    try {
      analytics.track(event, detail);
    } catch (error) {
      console.warn('CRM analytics tracking failed', { event, detail, error });
    }
  }
};

export default emitCrmTelemetry;
