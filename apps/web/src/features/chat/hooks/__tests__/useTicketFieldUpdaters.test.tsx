import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

const apiPatchMock = vi.hoisted(() => vi.fn(async () => ({ data: {} })));

vi.mock('@/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api.js')>();
  return {
    ...actual,
    apiPatch: (...args: Parameters<typeof actual.apiPatch>) =>
      apiPatchMock(...(args as Parameters<typeof actual.apiPatch>)),
  } satisfies typeof import('@/lib/api.js');
});

describe('useTicketFieldUpdaters', () => {
  let queryClient: QueryClient;
  let useTicketFieldUpdaters: typeof import('../useTicketFieldUpdaters').default;

  beforeEach(async () => {
    queryClient = new QueryClient();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
    apiPatchMock.mockClear();
    ({ default: useTicketFieldUpdaters } = await import('../useTicketFieldUpdaters'));
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('normalizes contact fields before triggering mutation', async () => {
    const { result } = renderHook(
      () =>
        useTicketFieldUpdaters({
          controller: { selectedTicketId: 'ticket-1' },
          selectedTicket: { id: 'ticket-1' } as any,
          selectedContact: { id: 'contact-1', phone: '1188887777' } as any,
          selectedLead: null,
          currentUser: null,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.onContactFieldSave('phone', '(11) 9999-9999');
    });

    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/contacts/contact-1',
      { phone: '1199999999' },
    );
  });

  it('updates next step and notifies success', async () => {
    const { result } = renderHook(
      () =>
        useTicketFieldUpdaters({
          controller: { selectedTicketId: 'ticket-1' },
          selectedTicket: {
            id: 'ticket-1',
            metadata: { nextAction: { description: 'Anterior' } },
          } as any,
          selectedContact: { id: 'contact-1' } as any,
          selectedLead: null,
          currentUser: { id: 'agent-1' },
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.onNextStepSave(' Novo passo ');
    });

    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/tickets/ticket-1/next-step',
      expect.objectContaining({ description: 'Novo passo' }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('Próximo passo atualizado.');
  });

  it('normalizes deal fields before calling API', async () => {
    const { result } = renderHook(
      () =>
        useTicketFieldUpdaters({
          controller: { selectedTicketId: 'ticket-1' },
          selectedTicket: { id: 'ticket-1' } as any,
          selectedContact: { id: 'contact-1' } as any,
          selectedLead: {
            id: 'lead-1',
            customFields: { deal: { netValue: 100 } },
          } as any,
          currentUser: null,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.onDealFieldSave('netValue', '1.234,56');
    });

    expect(apiPatchMock).toHaveBeenCalledWith(
      '/api/leads/lead-1/deal',
      { netValue: 1234.56 },
    );
  });
});
