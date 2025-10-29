import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstancesApiService } from '../instancesApi';
import { createInstancesStore } from '../../state/instancesStore';

const BASE_PATH = '/api/integrations/whatsapp/instances';

describe('instancesApiService', () => {
  const apiGet = vi.fn();
  const apiPost = vi.fn();
  const apiDelete = vi.fn();

  const createService = () => {
    const bundle = createInstancesStore({
      readCache: () => null,
      persistCache: vi.fn(),
      clearCache: vi.fn(),
    });

    const service = createInstancesApiService({
      store: bundle.store,
      events: bundle.events,
      api: {
        get: apiGet,
        post: apiPost,
        delete: apiDelete,
      },
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      getAuthToken: () => 'token',
    });

    return { bundle, service };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads instances using base endpoint', async () => {
    const { bundle, service } = createService();
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });

    const result = await service.loadInstances();

    expect(result.success).toBe(true);
    expect(apiGet).toHaveBeenCalledWith(BASE_PATH);
    expect(bundle.store.getState().instances).toHaveLength(1);
  });

  it('forces refresh when requested and not rate limited', async () => {
    const { service } = createService();
    apiGet.mockResolvedValue({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });

    await service.loadInstances({ forceRefresh: true });

    expect(apiGet).toHaveBeenCalledWith(`${BASE_PATH}?refresh=1`);
  });

  it('connectInstance returns parsed payload and updates store', async () => {
    const { bundle, service } = createService();
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });
    await service.loadInstances();

    apiGet.mockResolvedValueOnce({
      instance: {
        id: 'inst-1',
        status: 'connected',
        connected: true,
      },
      qr: { qrCode: 'qr-data' },
    });

    const response = await service.connectInstance({ instanceId: 'inst-1' });

    expect(response?.instanceId).toBe('inst-1');
    expect(response?.qr?.qrCode).toBe('qr-data');
    expect(bundle.store.getState().currentInstance?.id).toBe('inst-1');
  });
});
