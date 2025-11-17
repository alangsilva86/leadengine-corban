import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersSettingsTab from '../components/UsersSettingsTab';

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/features/auth/AuthProvider.jsx', () => ({
  useAuth: () => ({
    user: { id: 'user-admin', tenant: { slug: 'demo-tenant' } },
    status: 'authenticated',
  }),
}));

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const buildUsersApiMock = () => {
  const state = {
    nextId: 5,
    activeUsers: [
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
    ],
    inactiveUsers: [
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
    ],
  };

  const findUser = (userId: string) => {
    const collection = [...state.activeUsers, ...state.inactiveUsers];
    return collection.find((user) => user.id === userId);
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? input.toString() : input?.url ?? '';
    const method = (init?.method ?? 'GET').toUpperCase();
    const parsed = new URL(url, 'http://localhost');

    if (method === 'GET' && parsed.pathname === '/api/users') {
      const status = parsed.searchParams.get('status') ?? 'active';
      let users = state.activeUsers;
      if (status === 'inactive') {
        users = state.inactiveUsers;
      } else if (status === 'all') {
        users = [...state.activeUsers, ...state.inactiveUsers];
      }
      return jsonResponse({ success: true, data: { users } });
    }

    if (method === 'POST' && parsed.pathname === '/api/users') {
      const body = JSON.parse((init?.body as string) ?? '{}');
      const newUser = {
        id: `user-${state.nextId++}`,
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
      };
      state.activeUsers.push(newUser);
      return jsonResponse({ success: true, data: newUser });
    }

    if (method === 'PATCH' && parsed.pathname.startsWith('/api/users/')) {
      const userId = parsed.pathname.replace('/api/users/', '');
      const current = findUser(userId);
      const body = JSON.parse((init?.body as string) ?? '{}');
      if (!current) {
        return jsonResponse({ success: true, data: body });
      }
      Object.assign(current, body, { updatedAt: new Date().toISOString() });
      return jsonResponse({ success: true, data: current });
    }

    if (method === 'DELETE' && parsed.pathname.startsWith('/api/users/')) {
      const userId = parsed.pathname.replace('/api/users/', '');
      const current = findUser(userId);
      if (current) {
        current.isActive = false;
        current.updatedAt = new Date().toISOString();
      }
      return jsonResponse({ success: true, data: current });
    }

    return jsonResponse({ success: true, data: { users: [] } });
  });

  return { fetchMock };
};

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

describe('UsersSettingsTab', () => {
  const originalFetch = global.fetch;
  let apiMock: ReturnType<typeof buildUsersApiMock>;

  beforeEach(() => {
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    apiMock = buildUsersApiMock();
    global.fetch = apiMock.fetchMock as typeof fetch;
  });

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

    const inactiveFilter = await screen.findByText('Inativos');
    await userEvent.click(inactiveFilter);

    await waitFor(() => {
      expect(apiMock.fetchMock).toHaveBeenCalledWith(expect.stringContaining('status=inactive'), expect.any(Object));
    });

    expect(await screen.findByText('Conta Inativa')).toBeInTheDocument();
  });

  it('permite criar um novo usuário via modal', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: /Novo usuário/i }));
    await user.type(screen.getByLabelText('Nome completo'), 'Nova Gestora');
    await user.type(screen.getByLabelText('E-mail corporativo'), 'nova.gestora@example.com');
    await user.type(screen.getByLabelText('Senha provisória'), 'senhaSegura1');
    await user.type(screen.getByLabelText('Confirme a senha'), 'senhaSegura1');
    await user.click(screen.getByRole('button', { name: 'Criar usuário' }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Usuário criado com sucesso.');
    });

    expect(await screen.findByText('Nova Gestora')).toBeInTheDocument();

    const postCall = apiMock.fetchMock.mock.calls.find(([_url, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse((postCall?.[1]?.body ?? '{}') as string)).toMatchObject({
      name: 'Nova Gestora',
      role: 'AGENT',
    });
  });

  it('atualiza a função direto na tabela', async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('João Supervisor');
    await user.click(screen.getByLabelText('Alterar função de João Supervisor'));
    await user.click(await screen.findByText('Administrador'));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Função atualizada.');
    });

    const patchCall = apiMock.fetchMock.mock.calls.find(([_url, init]) => init?.method === 'PATCH');
    expect(patchCall?.[0]).toContain('/api/users/user-1');
    expect(JSON.parse((patchCall?.[1]?.body ?? '{}') as string)).toMatchObject({ role: 'ADMIN' });
  });
});
