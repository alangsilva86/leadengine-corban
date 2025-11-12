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

  it('normalizes create payload without agreement data', async () => {
    const { service } = createService();
    apiPost.mockResolvedValueOnce({ instances: [], instance: null });
    apiGet.mockResolvedValue({ instances: [] });

    await service.createInstance({ name: 'Nova', tenantId: 'tenant-1' });

    expect(apiPost).toHaveBeenCalledWith(BASE_PATH, { name: 'Nova', tenantId: 'tenant-1' });
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

  it('deletes instances using DELETE and forwards wipe flag', async () => {
    const { service } = createService();
    apiGet.mockResolvedValue({ instances: [] });
    apiDelete.mockResolvedValueOnce({});

    await service.deleteInstance({ instanceId: 'inst-1', hard: true });

    expect(apiDelete).toHaveBeenCalledWith(`${BASE_PATH}/inst-1?wipe=1`);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('deletes JID instances using DELETE and encodes identifiers', async () => {
    const { service } = createService();
    apiGet.mockResolvedValue({ instances: [] });
    apiDelete.mockResolvedValue({});

    await service.deleteInstance({ instanceId: '123@s.whatsapp.net' });

    expect(apiDelete).toHaveBeenCalledWith(`${BASE_PATH}/123%40s.whatsapp.net`);
    expect(apiPost).not.toHaveBeenCalled();
  });
});
