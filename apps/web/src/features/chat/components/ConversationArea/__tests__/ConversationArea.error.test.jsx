/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConversationArea from '../ConversationArea.jsx';

describe('ConversationArea', () => {
  it('renders with minimal ticket and handlers', () => {
    const ticket = {
      id: 'ticket-1',
      status: 'OPEN',
      contact: {
        name: 'Cliente Teste',
        phone: '+55 11 9999-0001',
        id: 'c1',
      },
      lead: { id: 'lead-1', value: 20000, probability: 70 },
      timeline: {},
      window: {},
      metadata: {},
    };

    const conversation = { timeline: [] };
    const messagesQuery = {
      data: { pages: [] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    };

    const typingIndicator = {
      agentsTyping: [],
      broadcastTyping: () => {},
    };

    const queryClient = new QueryClient();

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ConversationArea
          ticket={ticket}
          conversation={conversation}
          messagesQuery={messagesQuery}
          onSendMessage={() => {}}
          onCreateNote={() => {}}
          onSendTemplate={() => {}}
          onCreateNextStep={() => {}}
          onRegisterResult={() => {}}
          onRegisterCallResult={() => {}}
          onAssign={() => {}}
          onGenerateProposal={() => {}}
          onScheduleFollowUp={() => {}}
          onSendSMS={() => {}}
          onEditContact={() => {}}
          onAttachFile={() => {}}
          typingIndicator={typingIndicator}
        />
      </QueryClientProvider>
    );

    expect(getByText('Cliente Teste')).toBeDefined();
  });
});
