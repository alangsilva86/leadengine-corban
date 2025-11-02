/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeCrmFilters } from '../../utils/filter-serialization.ts';

const apiGetMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}));

type WrapperProps = PropsWithChildren;

const createWrapper = (client: QueryClient) => ({ children }: WrapperProps) =>
  createElement(QueryClientProvider, { client }, children);

describe('useCrmLeads', () => {
  let useCrmLeads: typeof import('../useCrmLeads').useCrmLeads;

  beforeEach(async () => {
    ({ useCrmLeads } = await import('../useCrmLeads'));
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('includes the search term when building the query cache key', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    apiGetMock.mockResolvedValue({
      data: { items: [], nextCursor: null, total: 0 },
    });

    const initialFilters = { search: 'Acme Corp', stages: ['qualification'] };

    try {
      const { rerender } = renderHook(
        ({ filters }) => useCrmLeads(filters),
        {
          initialProps: { filters: initialFilters },
          wrapper: createWrapper(client),
        }
      );

      await waitFor(() => {
        expect(apiGetMock).toHaveBeenCalledTimes(1);
      });

      const firstKey = serializeCrmFilters(initialFilters);
      const hasFirstKey = client
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'crm' &&
            query.queryKey[1] === 'leads' &&
            query.queryKey[2] === firstKey
        );

      expect(hasFirstKey).toBe(true);

      const nextFilters = { ...initialFilters, search: 'Beta LLC' };
      rerender({ filters: nextFilters });

      await waitFor(() => {
        expect(apiGetMock).toHaveBeenCalledTimes(2);
      });

      const nextKey = serializeCrmFilters(nextFilters);
      const hasNextKey = client
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'crm' &&
            query.queryKey[1] === 'leads' &&
            query.queryKey[2] === nextKey
        );

      expect(hasNextKey).toBe(true);
      expect(firstKey).not.toEqual(nextKey);
    } finally {
      client.clear();
    }
  });
});
