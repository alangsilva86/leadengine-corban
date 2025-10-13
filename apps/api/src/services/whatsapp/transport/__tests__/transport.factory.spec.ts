import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';

vi.mock('@ticketz/integrations', () => ({
  WhatsAppInstanceManager: class WhatsAppInstanceManagerMock {},
}));

let buildWhatsAppTransport: typeof import('../transport').buildWhatsAppTransport;
let resolveWhatsAppTransport: typeof import('../transport').resolveWhatsAppTransport;
let resetWhatsAppTransportCache: typeof import('../transport').resetWhatsAppTransportCache;
let HttpBrokerTransport: typeof import('../http-broker-transport').HttpBrokerTransport;
let DryRunTransport: typeof import('../dryrun-transport').DryRunTransport;
type WhatsAppTransport = import('../transport').WhatsAppTransport;

describe('WhatsApp transport factory', () => {
  beforeAll(async () => {
    const transportModule = await import('../transport');
    buildWhatsAppTransport = transportModule.buildWhatsAppTransport;
    resolveWhatsAppTransport = transportModule.resolveWhatsAppTransport;
    resetWhatsAppTransportCache = transportModule.resetWhatsAppTransportCache;

    HttpBrokerTransport = (await import('../http-broker-transport')).HttpBrokerTransport;
    DryRunTransport = (await import('../dryrun-transport')).DryRunTransport;
  });

  afterEach(() => {
    resetWhatsAppTransportCache();
    delete process.env.WHATSAPP_MODE;
    refreshWhatsAppEnv();
  });

  it('builds an HTTP transport when mode is http', () => {
    const transport = buildWhatsAppTransport('http');
    expect(transport).toBeInstanceOf(HttpBrokerTransport);
  });

  it('builds a dryrun transport when mode is dryrun', () => {
    const transport = buildWhatsAppTransport('dryrun');
    expect(transport).toBeInstanceOf(DryRunTransport);
  });

  it('allows injecting a custom sidecar transport implementation', () => {
    const customTransport = {
      mode: 'sidecar' as const,
      sendText: vi.fn(),
      sendMedia: vi.fn(),
      checkRecipient: vi.fn(),
      getStatus: vi.fn(),
    } satisfies Partial<WhatsAppTransport>;

    const resolved = buildWhatsAppTransport('sidecar', {
      sidecarTransport: customTransport as WhatsAppTransport,
    });

    expect(resolved).toBe(customTransport);
  });

  it('throws a canonical error when transport mode is disabled', () => {
    expect(() => buildWhatsAppTransport('disabled')).toThrow(WhatsAppTransportError);
  });

  it('caches resolved transports per mode and refreshes when mode changes', () => {
    process.env.WHATSAPP_MODE = 'dryrun';
    refreshWhatsAppEnv();
    resetWhatsAppTransportCache();

    const first = resolveWhatsAppTransport();
    const second = resolveWhatsAppTransport();

    expect(second).toBe(first);
    expect(first).toBeInstanceOf(DryRunTransport);

    process.env.WHATSAPP_MODE = 'http';
    refreshWhatsAppEnv();
    resetWhatsAppTransportCache();

    const httpTransport = resolveWhatsAppTransport();
    expect(httpTransport).toBeInstanceOf(HttpBrokerTransport);
    expect(httpTransport).not.toBe(first);
  });
});
