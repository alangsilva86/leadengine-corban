import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructorSpy = vi.fn<(path?: string) => void>();
const registerMock = vi.fn(() => vi.fn());

class FakeWhatsAppInstanceManager {
  on = vi.fn();
  off = vi.fn();

  constructor(public readonly sessionsPath?: string) {
    constructorSpy(sessionsPath);
  }
}

vi.mock('@ticketz/integrations', () => ({
  WhatsAppInstanceManager: FakeWhatsAppInstanceManager,
}));

vi.mock('../../sidecar-bridge', () => ({
  registerWhatsAppSidecarBridge: registerMock,
}));

describe('sidecar runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    registerMock.mockReset();
    constructorSpy.mockReset();
    delete process.env.WHATSAPP_SIDECAR_SESSIONS_PATH;
    delete process.env.WHATSAPP_SIDECAR_SESSIONS_DIR;
  });

  it('initializes the manager with the configured sessions path and caches the instance', async () => {
    process.env.WHATSAPP_SIDECAR_SESSIONS_PATH = '/tmp/sidecar-sessions';

    const module = await import('../sidecar-runtime');
    const { ensureWhatsAppSidecarManager } = module;

    const manager = ensureWhatsAppSidecarManager();
    const sameManager = ensureWhatsAppSidecarManager();

    expect(manager).toBeInstanceOf(FakeWhatsAppInstanceManager);
    expect(manager).toBe(sameManager);
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(constructorSpy).toHaveBeenCalledWith('/tmp/sidecar-sessions');
  });

  it('registers the bridge only once and stops it cleanly', async () => {
    const cleanupMock = vi.fn();
    registerMock.mockReturnValue(cleanupMock);

    const module = await import('../sidecar-runtime');
    const { ensureWhatsAppSidecarManager, startWhatsAppSidecarBridge, stopWhatsAppSidecarBridge, __testing } = module;

    const manager = ensureWhatsAppSidecarManager();

    startWhatsAppSidecarBridge();
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(manager, { dedupeTtlMs: undefined });
    expect(__testing.getBridgeCleanup()).toBe(cleanupMock);

    startWhatsAppSidecarBridge();
    expect(registerMock).toHaveBeenCalledTimes(1);

    stopWhatsAppSidecarBridge();
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(__testing.getBridgeCleanup()).toBeNull();
  });

  it('accepts an external manager and forwards dedupe TTL options', async () => {
    const cleanupMock = vi.fn();
    registerMock.mockReturnValue(cleanupMock);

    const module = await import('../sidecar-runtime');
    const { startWhatsAppSidecarBridge, stopWhatsAppSidecarBridge } = module;

    const { WhatsAppInstanceManager } = await import('@ticketz/integrations');
    const externalManager = new WhatsAppInstanceManager('custom-sessions');

    startWhatsAppSidecarBridge({ manager: externalManager, dedupeTtlMs: 1234 });

    expect(registerMock).toHaveBeenCalledWith(externalManager, { dedupeTtlMs: 1234 });

    stopWhatsAppSidecarBridge();
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });
});
