import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ContactsPage from '../pages/ContactsPage.jsx';

const mockBulkMutate = vi.fn();
const authState = { user: { role: 'AGENT' } };

vi.mock('@/features/auth/AuthProvider.jsx', () => ({
  useAuth: () => authState,
}));

vi.mock('../hooks/useContactsApi.js', () => ({
  useContactsQuery: () => ({
    data: {
      pages: [
        {
          items: [
            {
              id: 'contact-1',
              name: 'Alice Doe',
              phone: '+5511999990000',
              email: 'alice@example.com',
              status: 'ACTIVE',
              tags: ['VIP', 'INSS', 'Portabilidade'],
              lastInteractionAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: 'contact-2',
              name: 'Bruno Lima',
              phone: '+5562988887777',
              status: 'ARCHIVED',
              tags: [],
            },
          ],
          pagination: { page: 1, limit: 50, total: 2, hasNext: false },
        },
      ],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useContactTagsQuery: () => ({ data: [{ tag: 'VIP', count: 1 }] }),
  useContactLeadIndex: () => ({
    data: {
      complete: true,
      index: new Map([
        ['contact-1', { id: 'lead-1', contactId: 'contact-1', stage: 'proposal', potentialValue: 4500, ownerName: 'Ana Souza' }],
      ]),
    },
    refetch: vi.fn(),
  }),
  useContactBulkMutation: () => ({ mutate: mockBulkMutate, isPending: false }),
  useMergeContactsMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateContactMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdateContactMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateContactTaskMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useContactsLiveUpdates.js', () => ({
  __esModule: true,
  default: vi.fn(),
}));

const renderPage = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContactsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ContactsPage', () => {
  beforeEach(() => {
    mockBulkMutate.mockReset();
    authState.user = { role: 'AGENT' };
  });

  it('renderiza cabeçalho, busca e contatos com dados formatados', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByText('2 contatos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por nome, telefone ou e-mail')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice Doe' })).toHaveAttribute('href', '/contacts/contact-1');
    expect(screen.getByText('+55 (11) 99999-0000')).toBeInTheDocument();
    // Etapa do lead e valor vindos do funil
    expect(screen.getByText('Proposta')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    // Status só aparece quando não é "Ativo"
    expect(screen.queryByText('Ativo')).not.toBeInTheDocument();
    expect(screen.getByText('Arquivado')).toBeInTheDocument();
    // Tags: duas visíveis e o restante resumido
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('seleciona todos e adiciona tag em massa pela rota real da API', () => {
    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: /Selecionar todos os contatos/i }));
    const bar = screen.getByRole('region', { name: /Ações para contatos selecionados/i });
    expect(within(bar).getByText('2 contatos selecionados')).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: /Mesclar/i })).not.toBeInTheDocument();

    fireEvent.click(within(bar).getByRole('button', { name: /Adicionar tag/i }));
    const dialog = screen.getByRole('dialog', { name: 'Adicionar tag' });
    fireEvent.change(within(dialog).getByLabelText('Tag'), { target: { value: 'INSS' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar tag' }));

    expect(mockBulkMutate).toHaveBeenCalledTimes(1);
    expect(mockBulkMutate.mock.calls[0][0]).toEqual({ contactIds: ['contact-1', 'contact-2'], addTags: ['INSS'] });
  });

  it('mostra a mesclagem de duplicados apenas para administradores', () => {
    authState.user = { role: 'ADMIN' };
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Alice Doe' }));
    const bar = screen.getByRole('region', { name: /Ações para contatos selecionados/i });
    expect(within(bar).getByRole('button', { name: /Mesclar duplicados/i })).toBeDisabled();
  });
});
