/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DetailsPanel from '../DetailsPanel/DetailsPanel.jsx';

const createTicket = () => ({
  contact: {
    id: 'contact-1',
    name: 'Maria Souza',
    phone: '+55 11 99999-9999',
    email: 'maria@example.com',
  },
  lead: {
    status: 'open',
  },
  metadata: {
    attachments: [],
  },
  notes: [
    {
      id: 'note-1',
      body: 'Primeira nota registrada.',
      authorName: 'Agente',
      createdAt: new Date().toISOString(),
    },
  ],
  timeline: {},
});

describe('DetailsPanel - Notes section focus', () => {
  afterEach(() => {
    cleanup();
  });

  it('foca o campo de notas ao abrir novamente a seção “Notas internas”', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DetailsPanel
          ticket={createTicket()}
          onCreateNote={vi.fn()}
          notesLoading={false}
          onReopenWindow={vi.fn()}
          onOpenAudit={vi.fn()}
        />
      </QueryClientProvider>
    );

    const attachmentsTab = screen.getByRole('tab', { name: /anexos & notas/i });
    await user.click(attachmentsTab);

    const notesTrigger = screen.getByRole('button', { name: /notas internas/i });

    await user.click(notesTrigger);
    await waitFor(() => expect(notesTrigger).toHaveAttribute('aria-expanded', 'false'));

    await user.click(notesTrigger);
    await waitFor(() => expect(notesTrigger).toHaveAttribute('aria-expanded', 'true'));

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/adicionar nota interna/i);
      expect(textarea).toHaveFocus();
    });
  });
});
