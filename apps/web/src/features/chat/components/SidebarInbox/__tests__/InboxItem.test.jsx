/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { InboxItem } from '../InboxItem.jsx';

vi.mock('../Shared/StatusBadge.jsx', () => ({
  default: ({ status }) => <span data-testid="status">{status}</span>,
}));

vi.mock('../Shared/PipelineStepTag.jsx', () => ({
  default: ({ step }) => <span data-testid="pipeline-step">{step}</span>,
}));

vi.mock('../SlaBadge.jsx', () => ({
  default: ({ window }) => <span data-testid="sla">{window?.status ?? 'SLA'}</span>,
}));

vi.mock('../AssignmentMenu.jsx', () => ({
  default: ({ onAssign, onTransfer, onMute, onFollowUp, onMacro }) => (
    <div>
      <span role="menuitem" tabIndex={0} onClick={onAssign}>
        Atribuir
      </span>
      <span role="menuitem" tabIndex={0} onClick={onTransfer}>
        Transferir
      </span>
      <span role="menuitem" tabIndex={0} onClick={onMute}>
        Silenciar
      </span>
      <span role="menuitem" tabIndex={0} onClick={onFollowUp}>
        Follow-up
      </span>
      <span role="menuitem" tabIndex={0} onClick={onMacro}>
        Macro
      </span>
    </div>
  ),
}));

const baseTicket = {
  id: 'ticket-1',
  channel: 'WHATSAPP',
  contact: {
    name: 'João da Silva',
    phone: '+5511999999999',
    avatar: 'avatar.png',
  },
  subject: 'Novo atendimento',
  status: 'OPEN',
  pipelineStep: 'Qualificação',
  metadata: {},
  timeline: {
    unreadInboundCount: 2,
    lastDirection: 'INBOUND',
    lastInboundAt: '2024-01-02T12:34:00.000Z',
  },
  window: {
    status: 'ACTIVE',
  },
  qualityScore: 80,
  lead: {
    probability: 60,
  },
  lastMessagePreview: 'Olá, tudo bem?',
  userId: 'agent-1',
};

const renderComponent = (props = {}) =>
  render(
    <InboxItem
      ticket={{ ...baseTicket, ...props.ticket }}
      selected={props.selected}
      onSelect={props.onSelect}
      typingAgents={props.typingAgents}
      onAssign={props.onAssign}
      onTransfer={props.onTransfer}
      onMute={props.onMute}
      onFollowUp={props.onFollowUp}
      onMacro={props.onMacro}
    />
  );

describe('InboxItem', () => {
  afterEach(() => {
    cleanup();
  });

  it('dispara onSelect ao clicar e aplica estilo de seleção', () => {
    const onSelect = vi.fn();

    renderComponent({ selected: true, onSelect });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-primary/60');
    expect(button).toHaveClass('bg-surface-overlay-strong');

    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledWith(baseTicket.id);
  });

  it('exibe rótulo de digitação quando há agentes digitando', () => {
    renderComponent({ typingAgents: [{ userName: 'Maria' }] });

    expect(screen.getByText('Maria digitando…')).toBeInTheDocument();
    expect(screen.queryByText(baseTicket.lastMessagePreview)).not.toBeInTheDocument();
  });

  it('alternar entre estados atribuído e não atribuído', () => {
    const { rerender } = renderComponent({ ticket: { userId: 'agent-2' } });

    expect(screen.getByText('Atribuído')).toBeInTheDocument();

    rerender(
      <InboxItem
        ticket={{ ...baseTicket, userId: undefined }}
        typingAgents={[]}
      />
    );

    expect(screen.getByText('Não atribuído')).toBeInTheDocument();
  });

  it('aciona ações do menu de atribuição sem disparar seleção', () => {
    const onAssign = vi.fn();
    const onTransfer = vi.fn();
    const onMute = vi.fn();
    const onFollowUp = vi.fn();
    const onMacro = vi.fn();
    const onSelect = vi.fn();

    renderComponent({ onAssign, onTransfer, onMute, onFollowUp, onMacro, onSelect });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Atribuir' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Transferir' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Silenciar' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Follow-up' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Macro' }));

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: baseTicket.id }));
    expect(onTransfer).toHaveBeenCalledWith(expect.objectContaining({ id: baseTicket.id }));
    expect(onMute).toHaveBeenCalledWith(expect.objectContaining({ id: baseTicket.id }));
    expect(onFollowUp).toHaveBeenCalledWith(expect.objectContaining({ id: baseTicket.id }));
    expect(onMacro).toHaveBeenCalledWith(expect.objectContaining({ id: baseTicket.id }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
