/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forwardRef } from 'react';

vi.mock('../DetailsPanel/LeadSummaryCard.jsx', () => ({
  __esModule: true,
  default: ({ lead }) => (
    <div data-testid="lead-summary">Lead summary: {lead?.status ?? 'unknown'}</div>
  ),
}));

vi.mock('../DetailsPanel/LeadDetailsTabs.jsx', () => ({
  __esModule: true,
  default: ({ ticket }) => (
    <div data-testid="lead-details">Lead details tabs: {ticket?.id ?? 'no-ticket'}</div>
  ),
}));

vi.mock('../DetailsPanel/ConsentInfo.jsx', () => ({
  __esModule: true,
  default: ({ consent }) => <div data-testid="consent-info">Consent: {JSON.stringify(consent)}</div>,
}));

vi.mock('../DetailsPanel/ProposalMiniSim.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="proposal-mini-sim">Proposal mini sim</div>,
}));

vi.mock('../DetailsPanel/NotesSection.jsx', () => ({
  __esModule: true,
  default: forwardRef((props, ref) => (
    <div ref={ref} data-testid="notes-section">Notes section</div>
  )),
}));

vi.mock('../DetailsPanel/TasksSection.jsx', () => ({
  __esModule: true,
  default: ({ ticket }) => (
    <div data-testid="tasks-section">Tasks for {ticket?.id ?? 'no-ticket'}</div>
  ),
}));

vi.mock('../DetailsPanel/AuditTrailLink.jsx', () => ({
  __esModule: true,
  default: ({ onOpenAudit }) => (
    <button type="button" data-testid="audit-trail" onClick={onOpenAudit}>
      Abrir auditoria
    </button>
  ),
}));

vi.mock('../Shared/AttachmentPreview.jsx', () => ({
  __esModule: true,
  default: ({ attachments }) => (
    <div data-testid="attachment-preview">Attachments: {attachments.length}</div>
  ),
}));

vi.mock('../Shared/StatusBadge.jsx', () => ({
  __esModule: true,
  default: ({ status }) => <div data-testid="status-badge">Status: {status}</div>,
}));

vi.mock('@/features/contacts/components/ContactSummary.jsx', () => ({
  __esModule: true,
  default: ({ contact }) => (
    <div data-testid="contact-summary">Contact: {contact?.name ?? 'sem nome'}</div>
  ),
}));

import { DetailsPanel } from '../DetailsPanel/DetailsPanel.jsx';

describe('DetailsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderiza os grupos de seções previstos em snapshot', () => {
    const ticket = {
      id: 'ticket-1',
      contact: {
        id: 'contact-1',
        name: 'Maria Silva',
        company: 'Empresa X',
        phone: '+55 11 99999-9999',
        email: 'maria@example.com',
        document: '123.456.789-00',
        consent: {
          whatsapp: true,
        },
      },
      lead: {
        status: 'open',
        value: 5000,
      },
      timeline: {
        firstInboundAt: '2023-09-10T10:00:00Z',
        unreadInboundCount: 2,
      },
      metadata: {
        attachments: [
          { id: 'file-1' },
          { id: 'file-2' },
        ],
      },
      notes: [
        { id: 'note-1', body: 'Primeira nota' },
        { id: 'note-2', body: 'Segunda nota' },
      ],
    };

    render(
      <DetailsPanel
        ticket={ticket}
        onCreateNote={vi.fn()}
        notesLoading={false}
        onReopenWindow={vi.fn()}
        onOpenAudit={vi.fn()}
      />
    );

    expect(screen.getByText('Contato principal')).toBeInTheDocument();
    expect(screen.getByText('Proposta rápida')).toBeInTheDocument();
    expect(screen.getByText('Timeline resumida')).toBeInTheDocument();
  });

  it('exibe links de atalho para a command bar', () => {
    const ticket = {
      id: 'ticket-2',
      contact: {
        id: 'contact-2',
        name: 'João Souza',
        phone: '+55 21 98888-7777',
      },
    };

    render(
      <DetailsPanel
        ticket={ticket}
        onCreateNote={vi.fn()}
        notesLoading={false}
        onReopenWindow={vi.fn()}
        onOpenAudit={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Atribuir' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telefonia' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Editar contato' })[0]).toBeInTheDocument();
  });
});
