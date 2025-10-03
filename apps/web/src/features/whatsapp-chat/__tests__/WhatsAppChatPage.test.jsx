import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

import WhatsAppChatPage from '../WhatsAppChatPage.jsx';

vi.mock('../hooks/useWhatsAppChat.js', () => ({
  default: vi.fn(),
}));

const createHookState = (overrides = {}) => ({
  tickets: [],
  ticketsMeta: { total: 0 },
  ticketsLoading: false,
  ticketsError: null,
  ticketFilters: { status: ['OPEN', 'PENDING', 'ASSIGNED'], search: '' },
  setTicketFilters: vi.fn(),
  refreshTickets: vi.fn(),
  selectTicket: vi.fn(),
  selectedTicket: null,
  selectedTicketId: null,
  messages: [],
  messagesMeta: { hasNext: false },
  messagesLoading: false,
  messagesError: null,
  loadMoreMessages: vi.fn(),
  sendMessage: vi.fn(),
  composerBusy: false,
  contact: null,
  lead: null,
  leadBusy: false,
  updateLead: vi.fn(),
  appendNote: vi.fn(),
  notesBusy: false,
  notesFilter: 'all',
  setNotesFilter: vi.fn(),
  filteredNotes: [],
  updateOutcome: vi.fn(),
  outcomeBusy: false,
  markTicketResolved: vi.fn(),
  timeline: [],
  realtime: { connected: false, connectionError: null },
  ...overrides,
});

beforeEach(async () => {
  const module = await import('../hooks/useWhatsAppChat.js');
  module.default.mockReturnValue(createHookState());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WhatsAppChatPage', () => {
  it('renders ticket filters and placeholder message when no ticket selected', () => {
    render(<WhatsAppChatPage tenantId="tenant-123" />);

    expect(screen.getByPlaceholderText('Buscar por contato, assunto ou tag')).toBeInTheDocument();
    expect(screen.getByText('Nenhum ticket encontrado com os filtros selecionados.')).toBeInTheDocument();
    expect(screen.getByText('Selecione um ticket para visualizar a conversa.')).toBeInTheDocument();
  });
});
