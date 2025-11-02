import { beforeEach, describe, expect, it, vi } from 'vitest';
import emitCrmTelemetry from '../utils/telemetry.ts';

describe('emitCrmTelemetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).analytics = { track: vi.fn() };
  });

  it('dispatches crm telemetry event with sanitized payload', () => {
    const handler = vi.fn();
    window.addEventListener('leadengine:crm-telemetry', handler);

    emitCrmTelemetry('crm.view.change', {
      phone: '+5511999888777',
      leadId: 'lead-1',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail as Record<string, unknown>;
    expect(detail.scope).toBe('crm');
    expect(detail.event).toBe('crm.view.change');
    expect(detail.phone).toMatch(/\*\*\*\*/);
    expect((window as any).analytics.track).toHaveBeenCalledWith('crm.view.change', detail);

    window.removeEventListener('leadengine:crm-telemetry', handler);
  });

  it('silently skips when window is unavailable', () => {
    const originalAdd = window.addEventListener;
    const spy = vi.spyOn(window, 'addEventListener');

    emitCrmTelemetry('crm.view.change');

    expect(spy).toHaveBeenCalled();
    window.addEventListener = originalAdd;
  });
});
