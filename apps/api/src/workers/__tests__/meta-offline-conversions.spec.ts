import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadConfigMock = vi.hoisted(() => vi.fn());
const markValidationMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/meta-offline-config', () => ({
  loadMetaOfflineConfig: (...args: unknown[]) => loadConfigMock(...args),
  markMetaOfflineValidationResult: (...args: unknown[]) => markValidationMock(...args),
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('meta offline conversions worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    loadConfigMock.mockReset();
    markValidationMock.mockReset();
  });

  it('skips execution when credentials are missing', async () => {
    loadConfigMock.mockResolvedValueOnce({
      accessToken: null,
      offlineEventSetId: null,
      eventName: null,
      actionSource: null,
    });

    const { dispatchMetaOfflineConversions } = await import('../meta-offline-conversions');

    const result = await dispatchMetaOfflineConversions('tenant-1', [
      { eventName: 'Lead', userData: { phone: '+5511999999999' } },
    ]);

    expect(result.skipped).toBe(true);
    expect(result.success).toBe(false);
    expect(markValidationMock).toHaveBeenCalledWith('tenant-1', {
      success: false,
      message: 'Credenciais Meta ausentes',
    });
  });

  it('sends events to the Graph API when configuration is valid', async () => {
    loadConfigMock.mockResolvedValueOnce({
      accessToken: 'token-123',
      offlineEventSetId: 'set_456',
      eventName: 'Lead',
      actionSource: 'phone_call',
    });

    const fetchResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as const;

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);

    const { dispatchMetaOfflineConversions } = await import('../meta-offline-conversions');

    const result = await dispatchMetaOfflineConversions(
      'tenant-42',
      [
        {
          eventName: 'Scheduled Call',
          eventTime: 1730220000000,
          userData: { em: 'hash@example.com' },
          customData: { value: 1200 },
        },
      ],
      { fetchImpl: fetchMock, graphApiVersion: 'v19.0' }
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/v19\.0\/set_456\/events$/);

    const parsedBody = JSON.parse(init?.body as string);
    expect(parsedBody).toMatchObject({
      access_token: 'token-123',
      data: [
        expect.objectContaining({
          event_name: 'Scheduled Call',
          action_source: 'PHONE_CALL',
          user_data: { em: 'hash@example.com' },
          custom_data: { value: 1200 },
        }),
      ],
    });

    expect(markValidationMock).toHaveBeenLastCalledWith('tenant-42', { success: true });
  });

  it('propagates Graph API errors', async () => {
    loadConfigMock.mockResolvedValueOnce({
      accessToken: 'token-abc',
      offlineEventSetId: 'set_xyz',
      eventName: 'Lead',
      actionSource: 'website',
    });

    const fetchResponse = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: { message: 'Invalid credentials' } }),
    } as const;

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);

    const { dispatchMetaOfflineConversions } = await import('../meta-offline-conversions');

    const result = await dispatchMetaOfflineConversions(
      'tenant-error',
      [{ eventName: 'LeadCaptured' }],
      { fetchImpl: fetchMock }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
    expect(markValidationMock).toHaveBeenLastCalledWith('tenant-error', {
      success: false,
      message: 'Invalid credentials',
    });
  });
});
