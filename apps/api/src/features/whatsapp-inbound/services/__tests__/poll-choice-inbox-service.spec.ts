import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoistedMocks = vi.hoisted(() => ({
  ingestInboundWhatsAppMessage: vi.fn(),
}));

vi.mock('../inbound-lead-service', () => hoistedMocks);

import {
  PollChoiceInboxNotificationStatus,
  triggerPollChoiceInboxNotification,
} from '../poll-choice-inbox-service';

const ingestInboundWhatsAppMessageMock = hoistedMocks.ingestInboundWhatsAppMessage;

describe('triggerPollChoiceInboxNotification', () => {
  const baseTimestamp = new Date().toISOString();
  const basePoll = {
    pollId: 'poll-xyz',
    voterJid: '5511999999999@s.whatsapp.net',
    messageId: 'wamid-poll',
    selectedOptionIds: ['opt-1'],
    selectedOptions: [{ id: 'opt-1', title: 'Primeira opção' }],
    options: [
      { id: 'opt-1', title: 'Primeira opção', selected: true },
      { id: 'opt-2', title: 'Segunda opção', selected: false },
    ],
    aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1, 'opt-2': 0 } },
    timestamp: baseTimestamp,
  } satisfies Parameters<typeof triggerPollChoiceInboxNotification>[0]['poll'];

  const baseState = {
    pollId: 'poll-xyz',
    options: [
      { id: 'opt-1', title: 'Primeira opção', index: 0 },
      { id: 'opt-2', title: 'Segunda opção', index: 1 },
    ],
    votes: {
      '5511999999999@s.whatsapp.net': {
        optionIds: ['opt-1'],
        selectedOptions: [{ id: 'opt-1', title: 'Primeira opção' }],
        messageId: 'wamid-poll',
        timestamp: baseTimestamp,
      },
    },
    aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1, 'opt-2': 0 } },
    brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1, 'opt-2': 0 } },
    updatedAt: baseTimestamp,
    context: { question: '  Qual é a sua cor favorita?  ' },
  } satisfies Parameters<typeof triggerPollChoiceInboxNotification>[0]['state'];

  beforeEach(() => {
    ingestInboundWhatsAppMessageMock.mockReset();
  });

  it('builds a synthetic message envelope and delegates ingestion', async () => {
    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(true);

    const result = await triggerPollChoiceInboxNotification({
      poll: basePoll,
      state: baseState,
      selectedOptions: basePoll.selectedOptions,
      tenantId: 'tenant-abc',
      instanceId: 'instance-xyz',
      requestId: 'req-1',
    });

    expect(result).toEqual({ status: PollChoiceInboxNotificationStatus.Ok, persisted: true });
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);
    const [envelope] = ingestInboundWhatsAppMessageMock.mock.calls[0] ?? [];
    expect(envelope).toMatchObject({
      origin: 'poll_choice',
      instanceId: 'instance-xyz',
      tenantId: 'tenant-abc',
      message: {
        direction: 'INBOUND',
        metadata: expect.objectContaining({
          poll: expect.objectContaining({
            id: 'poll-xyz',
            label: 'Qual é a sua cor favorita?',
            selectedOptionIds: ['opt-1'],
          }),
        }),
      },
    });
    expect(envelope.message?.payload?.text).toContain('Resposta de enquete recebida.');
    expect(envelope.message?.payload?.text).toContain('Enquete: Qual é a sua cor favorita?');
  });

  it('skips ingestion when tenant is missing', async () => {
    const result = await triggerPollChoiceInboxNotification({
      poll: basePoll,
      state: baseState,
      selectedOptions: basePoll.selectedOptions,
      tenantId: '',
      instanceId: null,
      requestId: null,
    });

    expect(result).toEqual({
      status: PollChoiceInboxNotificationStatus.MissingTenant,
      persisted: false,
    });
    expect(ingestInboundWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it('skips ingestion when chat id cannot be normalized', async () => {
    const result = await triggerPollChoiceInboxNotification({
      poll: { ...basePoll, voterJid: undefined as unknown as string },
      state: baseState,
      selectedOptions: basePoll.selectedOptions,
      tenantId: 'tenant-abc',
      instanceId: null,
      requestId: 'req-2',
    });

    expect(result).toEqual({
      status: PollChoiceInboxNotificationStatus.InvalidChatId,
      persisted: false,
    });
    expect(ingestInboundWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it('returns rejected status when ingestion declines persistence', async () => {
    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(false);

    const result = await triggerPollChoiceInboxNotification({
      poll: basePoll,
      state: baseState,
      selectedOptions: basePoll.selectedOptions,
      tenantId: 'tenant-abc',
      instanceId: 'instance-xyz',
      requestId: 'req-3',
    });

    expect(result).toEqual({
      status: PollChoiceInboxNotificationStatus.IngestRejected,
      persisted: false,
    });
  });

  it('returns error status when ingestion throws', async () => {
    ingestInboundWhatsAppMessageMock.mockRejectedValueOnce(new Error('boom'));

    const result = await triggerPollChoiceInboxNotification({
      poll: basePoll,
      state: baseState,
      selectedOptions: basePoll.selectedOptions,
      tenantId: 'tenant-abc',
      instanceId: 'instance-xyz',
      requestId: 'req-4',
    });

    expect(result).toEqual({
      status: PollChoiceInboxNotificationStatus.IngestError,
      persisted: false,
    });
  });
});
