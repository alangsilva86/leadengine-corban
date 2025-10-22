/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ConversationHeader from '../ConversationHeader.jsx';

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
