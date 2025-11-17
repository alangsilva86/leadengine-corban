import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UsersSettingsTab from '../components/UsersSettingsTab';
import AuthProvider from '@/features/auth/AuthProvider.jsx';

const queryClient = new QueryClient();

const mockUsersResponse = {
  success: true,
  data: {
    users: [
      {
        id: 'user-story-1',
        name: 'Alice Gestora',
        email: 'alice@corban.com',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: 'user-story-2',
        name: 'Bruno Operações',
        email: 'bruno@corban.com',
        role: 'SUPERVISOR',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    ],
  },
};

const mockAuthResponse = {
  data: {
    id: 'user-admin',
    email: 'admin@corban.com',
    tenant: { id: 'tenant-story', slug: 'demo-story' },
  },
};

const Providers = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (url?.includes('/api/users')) {
        return new Response(JSON.stringify(mockUsersResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url?.includes('/api/auth/me')) {
        return new Response(JSON.stringify(mockAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };
    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="p-6">
          {children}
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default {
  title: 'Features/Users/SettingsTab',
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = {
  render: () => (
    <Providers>
      <UsersSettingsTab />
    </Providers>
  ),
};
