/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPatchMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
}));

type WrapperProps = PropsWithChildren;

const createWrapper = (client: QueryClient) => ({ children }: WrapperProps) =>
  createElement(QueryClientProvider, { client }, children);

describe('useUpdateContactField', () => {
  let useUpdateContactField: typeof import('../useUpdateContactField').useUpdateContactField;

  beforeEach(async () => {
    ({ useUpdateContactField } = await import('../useUpdateContactField'));
  });

  afterEach(() => {
    apiPatchMock.mockReset();
  });

  it('updates a contact and invalidates relevant caches', async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    apiPatchMock.mockResolvedValue({ data: { id: 'contact-1', name: 'Updated Contact' } });

    const { result } = renderHook(() => useUpdateContactField({ contactId: 'contact-1' }), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ data: { name: 'Updated Contact' } });
    });

    expect(apiPatchMock).toHaveBeenCalledWith('/api/contacts/contact-1', {
      name: 'Updated Contact',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'tickets'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts', 'contact-1'] });

    invalidateSpy.mockRestore();
    client.clear();
  });

  it('allows overriding the contact id through mutation variables', async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    apiPatchMock.mockResolvedValue({ data: { id: 'contact-2', name: 'Another Contact' } });

    const { result } = renderHook(() => useUpdateContactField({ contactId: 'contact-1' }), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        targetContactId: 'contact-2',
        data: { phone: '+5511999999999' },
      });
    });

    expect(apiPatchMock).toHaveBeenCalledWith('/api/contacts/contact-2', {
      phone: '+5511999999999',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'tickets'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts', 'contact-2'] });

    invalidateSpy.mockRestore();
    client.clear();
  });
});

describe('useUpdateLeadField', () => {
  let useUpdateLeadField: typeof import('../useUpdateLeadField').useUpdateLeadField;

  beforeEach(async () => {
    ({ useUpdateLeadField } = await import('../useUpdateLeadField'));
  });

  afterEach(() => {
    apiPatchMock.mockReset();
  });

  it('updates a lead and invalidates relevant caches', async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    apiPatchMock.mockResolvedValue({ data: { id: 'lead-1', status: 'qualified' } });

    const { result } = renderHook(() => useUpdateLeadField({ leadId: 'lead-1' }), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ data: { status: 'qualified' } });
    });

    expect(apiPatchMock).toHaveBeenCalledWith('/api/leads/lead-1', { status: 'qualified' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'tickets'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['leads', 'lead-1'] });

    invalidateSpy.mockRestore();
    client.clear();
  });
});
