import { beforeEach, describe, expect, it, vi } from 'vitest';
import emitCrmTelemetry from '../utils/telemetry';

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
    const detail = handler.mock.calls[0]?.[0].detail as Record<string, unknown>;
    expect(detail.scope).toBe('crm');
    expect(detail.event).toBe('crm.view.change');
    expect(detail.phone).toMatch(/\*\*\*\*/);
    expect((window as any).analytics.track).toHaveBeenCalledWith('crm.view.change', detail);

    window.removeEventListener('leadengine:crm-telemetry', handler);
  });

  it('does not throw when analytics is unavailable or tracking fails', () => {
    delete (window as any).analytics;
    expect(() => emitCrmTelemetry('crm.view.change')).not.toThrow();

    (window as any).analytics = {
      track: vi.fn(() => {
        throw new Error('offline');
      }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => emitCrmTelemetry('crm.view.change', { leadId: 'lead-1' })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
