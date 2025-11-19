/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ConversationHeader from '../ConversationHeader.jsx';

vi.mock('../../hooks/useTicketJro.js', () => ({
  __esModule: true,
  default: () => ({ state: 'neutral', label: 'Em andamento', progress: 0.5 }),
}));

vi.mock('@/features/chat/hooks/useInstancePresentation.js', () => ({
  __esModule: true,
  default: () => ({ label: 'Instância mock', color: '#94A3B8', phone: null, number: null }),
}));

describe('ConversationHeader', () => {
  it('renders without crashing for basic ticket', () => {
    const ticket = {
      id: 'ticket-1',
      status: 'OPEN',
      contact: { name: 'Cliente Teste', phone: '+55 11 99999-0000', id: 'contact-1' },
      window: {},
      lead: { value: 10000, probability: 80 },
    };

    const { getByText } = render(
      <ConversationHeader
        ticket={ticket}
        onRegisterResult={() => {}}
        onRegisterCallResult={() => {}}
        onAssign={() => {}}
        onSendTemplate={() => {}}
        onCreateNextStep={() => {}}
        onGenerateProposal={() => {}}
        onScheduleFollowUp={() => {}}
        onAttachFile={() => {}}
      />
    );

    expect(getByText('Cliente Teste')).toBeDefined();
  });
});
