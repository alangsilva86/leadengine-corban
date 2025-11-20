/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useInstanceMetrics, {
  categorizeHealth,
  computeHealthScore,
  computeLoadLevel,
  resolveProvider,
  resolveTimestamp,
} from '../useInstanceMetrics.js';

describe('useInstanceMetrics', () => {
  const buildViewModel = (overrides = {}) => ({
    displayName: overrides.displayName ?? 'Instância',
    formattedPhone: overrides.formattedPhone ?? '11999990000',
    phoneLabel: overrides.phoneLabel ?? '+55119999990000',
    instance: overrides.instance ?? { id: 'instance-1', provider: 'CloudZap', updatedAt: '2024-05-01T10:00:00Z' },
    statusInfo: overrides.statusInfo ?? { variant: 'success', label: 'Ativo' },
    metrics: overrides.metrics ?? { queued: 5, failed: 0 },
    ratePercentage: overrides.ratePercentage ?? 50,
    ...overrides,
  });

  it('resolve helpers enrich instances with computed health and provider data', () => {
    const instance = buildViewModel({
      instance: { id: 'instance-1', providerName: 'MetaCloud', syncedAt: '2024-05-02T12:00:00Z' },
      metrics: { queued: 2, failed: 1 },
      ratePercentage: 40,
    });

    const provider = resolveProvider(instance.instance);
    const timestamp = resolveTimestamp(instance.instance);
    const loadLevel = computeLoadLevel(instance.metrics, instance.ratePercentage);
    const healthScore = computeHealthScore('connected', instance.metrics, instance.ratePercentage);

    expect(provider).toBe('MetaCloud');
    expect(timestamp?.toISOString()).toBe('2024-05-02T12:00:00.000Z');
    expect(loadLevel).toBe('baixa');
    expect(categorizeHealth(healthScore)).toBe('alta');
  });

  it('aplica filtros de status, saúde e provider mantendo opções ordenadas', () => {
    const vmA = buildViewModel({ instance: { id: 'a', provider: 'Zeta', updatedAt: '2024-05-01T10:00:00Z' } });
    const vmB = buildViewModel({
      instance: { id: 'b', provider: 'Alpha', updatedAt: '2024-05-03T10:00:00Z' },
      statusInfo: { variant: 'info' },
      metrics: { queued: 60, failed: 5 },
      ratePercentage: 95,
    });
    const { result } = renderHook(() => useInstanceMetrics({ instanceViewModels: [vmA, vmB], instancesReady: true }));

    expect(result.current.providerOptions).toEqual(['Alpha', 'Zeta']);
    expect(result.current.filteredInstances).toHaveLength(2);
    expect(result.current.enrichedInstances.find((item) => item.instance.id === 'b')?.connectionState).toBe(
      'reconnecting',
    );

    act(() => result.current.setHealthFilter('baixa'));
    expect(result.current.filteredInstances.map((item) => item.instance.id)).toEqual(['b']);

    act(() => result.current.setProviderFilter('Zeta'));
    expect(result.current.filteredInstances.map((item) => item.instance.id)).toEqual(['a']);

    act(() => result.current.setStatusFilter('reconnecting'));
    expect(result.current.filteredInstances.map((item) => item.instance.id)).toEqual(['b']);
    expect(result.current.filtersApplied).toBe(2);
  });

  it('ordena por atualização e carga, calculando sumário e prioridade', () => {
    const vmA = buildViewModel({
      instance: { id: 'a', provider: 'Zeta', updatedAt: '2024-05-01T10:00:00Z' },
      metrics: { queued: 1, failed: 0 },
    });
    const vmB = buildViewModel({
      displayName: 'Instância B',
      instance: { id: 'b', provider: 'Alpha', updatedAt: '2024-05-03T10:00:00Z' },
      metrics: { queued: 80, failed: 12 },
      statusInfo: { variant: 'destructive' },
      ratePercentage: 92,
    });
    const vmC = buildViewModel({
      displayName: 'Instância C',
      instance: { id: 'c', provider: 'Beta', updatedAt: '2024-05-02T10:00:00Z' },
      metrics: { queued: 30, failed: 3 },
      statusInfo: { variant: 'success' },
      ratePercentage: 70,
    });

    const { result } = renderHook(() =>
      useInstanceMetrics({ instanceViewModels: [vmA, vmB, vmC], instancesReady: true }),
    );

    expect(result.current.summary).toMatchObject({
      state: 'ready',
      queueTotal: 111,
      failureTotal: 15,
      totals: { connected: 2, attention: 1, reconnecting: 0, disconnected: 0 },
    });

    expect(result.current.priorityInstance.instance.id).toBe('b');

    act(() => result.current.setSortBy('updated'));
    expect(result.current.filteredInstances.map((item) => item.instance.id)).toEqual(['b', 'c', 'a']);

    act(() => result.current.setSortBy('load'));
    expect(result.current.filteredInstances.map((item) => item.instance.id)).toEqual(['b', 'c', 'a']);
  });
});
