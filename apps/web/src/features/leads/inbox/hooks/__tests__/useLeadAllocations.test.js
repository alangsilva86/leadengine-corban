/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useLeadAllocations } from '../useLeadAllocations.js';

const mockApiGet = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args) => mockApiGet(...args),
  apiPatch: (...args) => mockApiPatch(...args),
}));

vi.mock('@/lib/rate-limit.js', () => ({
  computeBackoffDelay: vi.fn(() => 1000),
  parseRetryAfterMs: vi.fn(() => null),
}));

vi.mock('@/hooks/useRateLimitBanner.js', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@/features/shared/usePlayfulLogger.js', () => ({
  __esModule: true,
  default: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.useRealTimers();
  mockApiGet.mockReset();
  mockApiPatch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useLeadAllocations', () => {
  it('consulta a API usando instanceId quando não há campanha ou convênio', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        {
          allocationId: 'lead-1',
          status: 'allocated',
        },
      ],
      meta: {},
    });

    const { result, unmount } = renderHook(() =>
      useLeadAllocations({ agreementId: null, campaignId: null, instanceId: 'instance-123' })
    );

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const [firstCall] = mockApiGet.mock.calls;
    expect(firstCall?.[0]).toBe('/api/lead-engine/allocations?instanceId=instance-123');

    await waitFor(() => expect(result.current.allocations).toHaveLength(1));
    expect(result.current.warningMessage).toMatch(/instância conectada/i);

    unmount();
  });

  it('exibe orientação quando não há contexto disponível', async () => {
    const { result, unmount } = renderHook(() =>
      useLeadAllocations({ agreementId: null, campaignId: null, instanceId: null })
    );

    await waitFor(() => {
      expect(result.current.warningMessage).toMatch(/instância ativa do whatsapp/i);
    });
    expect(mockApiGet).not.toHaveBeenCalled();

    unmount();
  });

  it('prioriza instanceId quando outros identificadores também estão disponíveis', async () => {
    mockApiGet.mockResolvedValue({ data: [], meta: {} });

    const { unmount } = renderHook(() =>
      useLeadAllocations({ agreementId: 'agreement-1', campaignId: 'campaign-1', instanceId: 'instance-xyz' })
    );

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());

    const [firstCall] = mockApiGet.mock.calls;
    expect(firstCall?.[0]).toBe('/api/lead-engine/allocations?instanceId=instance-xyz');
    expect(firstCall?.[0]).not.toContain('campaignId=');

    unmount();
  });

  it('reinicia carregamento quando a instância muda evitando requisição com campanha antiga', async () => {
    let resolveFirst;
    const firstCallPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    mockApiGet
      .mockImplementationOnce(() => firstCallPromise)
      .mockImplementationOnce(() => Promise.resolve({ data: [], meta: {} }))
      .mockImplementation(() => Promise.resolve({ data: [], meta: {} }));

    const { rerender, unmount } = renderHook(
      (props) => useLeadAllocations(props),
      {
        initialProps: { agreementId: null, campaignId: 'campaign-legacy', instanceId: 'instance-old' },
      }
    );

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));

    rerender({ agreementId: null, campaignId: 'campaign-legacy', instanceId: 'instance-new' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    const [, secondCall] = mockApiGet.mock.calls;
    expect(secondCall?.[0]).toBe('/api/lead-engine/allocations?instanceId=instance-new');

    resolveFirst({ data: [], meta: {} });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

    const subsequentCalls = mockApiGet.mock.calls.slice(1).map(([url]) => url);
    expect(subsequentCalls.every((url) => url.includes('instanceId=instance-new'))).toBe(true);
    expect(mockApiGet.mock.calls.every(([url]) => !url.includes('campaignId=campaign-legacy'))).toBe(true);

    unmount();
  });
});
