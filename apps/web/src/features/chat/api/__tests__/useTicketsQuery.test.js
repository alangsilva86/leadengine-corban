/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args) => apiGetMock(...args),
}));

let useTicketsQuery;

describe('useTicketsQuery', () => {
  beforeEach(async () => {
    ({ useTicketsQuery } = await import('../useTicketsQuery.js'));
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('inclui ordenação padrão na requisição e na query key', async () => {
    apiGetMock.mockResolvedValue({ data: { items: [], metrics: null, pagination: { page: 1, limit: 40 } } });

    const client = new QueryClient();
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client }, children);

    renderHook(() => useTicketsQuery({ filters: { state: 'open' } }), {
      wrapper,
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));

    const [url] = apiGetMock.mock.calls[0];
    const searchParams = new URL(url, 'http://localhost').searchParams;

    expect(searchParams.get('sortBy')).toBe('lastMessageAt');
    expect(searchParams.get('sortOrder')).toBe('desc');

    const [query] = client.getQueryCache().getAll();
    expect(query?.queryKey?.[2]).toMatchObject({
      sortBy: 'lastMessageAt',
      sortOrder: 'desc',
    });

    client.clear();
  });

  it('permite customizar ordenação ao buscar tickets', async () => {
    apiGetMock.mockResolvedValue({ data: { items: [], metrics: null, pagination: { page: 1, limit: 10 } } });

    const sortBy = 'createdAt';
    const sortOrder = 'asc';

    const client = new QueryClient();
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client }, children);

    renderHook(
      () =>
        useTicketsQuery({
          limit: 10,
          sortBy,
          sortOrder,
          includeMetrics: false,
          filters: { scope: 'mine' },
        }),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1));

    const [url] = apiGetMock.mock.calls[0];
    const searchParams = new URL(url, 'http://localhost').searchParams;

    expect(searchParams.get('sortBy')).toBe(sortBy);
    expect(searchParams.get('sortOrder')).toBe(sortOrder);
    expect(searchParams.get('limit')).toBe('10');
    expect(searchParams.get('metrics')).toBeNull();
    expect(searchParams.get('scope')).toBe('mine');

    const [query] = client.getQueryCache().getAll();
    expect(query?.queryKey?.[2]).toMatchObject({
      sortBy,
      sortOrder,
      limit: 10,
      includeMetrics: false,
    });

    client.clear();
  });
});

