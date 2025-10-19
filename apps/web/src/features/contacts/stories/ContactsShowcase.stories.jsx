import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ContactsPage from '../pages/ContactsPage.jsx';
import ContactSummary from '../components/ContactSummary.jsx';

const queryClient = new QueryClient();

const mockContactsPayload = {
  success: true,
  data: {
    items: [
      {
        id: 'contact-1',
        name: 'Alice Doe',
        phone: '+55 11 99999-0000',
        email: 'alice@example.com',
        tags: ['VIP', 'Onboarding'],
        lastInteractionAt: new Date().toISOString(),
      },
      {
        id: 'contact-2',
        name: 'Bruno Silva',
        phone: '+55 21 98888-1234',
        email: 'bruno@empresa.com',
        tags: ['Retenção'],
        lastInteractionAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ],
    pagination: {
      page: 1,
      limit: 60,
      hasNext: false,
    },
  },
};

const MockedContactsPage = () => {
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && url.includes('/api/contacts')) {
        return new Response(JSON.stringify(mockContactsPayload), {
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

  return <ContactsPage />;
};

export default {
  title: 'Features/Contacts',
  parameters: {
    layout: 'fullscreen',
  },
};

export const ListView = () => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <MockedContactsPage />
    </MemoryRouter>
  </QueryClientProvider>
);

export const SummaryCard = () => (
  <div className="max-w-4xl p-6">
    <ContactSummary
      contact={{
        name: 'Alice Doe',
        phone: '+55 11 99999-0000',
        email: 'alice@example.com',
        document: '123.456.789-00',
        tags: ['VIP', 'Onboarding'],
        customFields: { origem: 'Facebook Ads', fase: 'Prospecção' },
      }}
    />
  </div>
);
