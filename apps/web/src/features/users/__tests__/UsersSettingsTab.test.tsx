import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersSettingsTab from '../components/UsersSettingsTab';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/features/auth/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { id: 'user-admin', tenant: { slug: 'demo-tenant' } },
    status: 'authenticated',
  }),
}));

const createMockResponse = (users) =>
  new Response(
    JSON.stringify({
      success: true,
      data: { users },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

describe('UsersSettingsTab', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    global.fetch = vi.fn((input) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (url?.includes('status=inactive')) {
        return Promise.resolve(
          createMockResponse([
            {
              id: 'user-inactive',
              name: 'Conta Inativa',
              email: 'inactive@example.com',
              role: 'AGENT',
              isActive: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastLoginAt: null,
            },
          ])
        );
      }
      return Promise.resolve(
        createMockResponse([
          {
            id: 'user-1',
            name: 'João Supervisor',
            email: 'joao@example.com',
            role: 'SUPERVISOR',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          },
        ])
      );
    });
  });

  const renderTab = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={client}>
        <UsersSettingsTab />
      </QueryClientProvider>
    );
  };

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('renderiza usuários retornados pela API', async () => {
    renderTab();

    expect(await screen.findByText('João Supervisor')).toBeInTheDocument();
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
  });

  it('atualiza o filtro e refaz a busca', async () => {
    renderTab();

    const inactiveFilter = await screen.findByRole('button', { name: /Inativos/i });
    await userEvent.click(inactiveFilter);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=inactive'), expect.any(Object));
    });

    expect(await screen.findByText('Conta Inativa')).toBeInTheDocument();
  });
});
