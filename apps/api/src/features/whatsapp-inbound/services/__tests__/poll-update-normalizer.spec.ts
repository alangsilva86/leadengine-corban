import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizePollUpdate,
  resolveMessageType,
  buildPollVoteText,
} from '../poll-update-normalizer';
import type { InboundWhatsAppEnvelope } from '../types';

describe('poll-update-normalizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const buildEnvelope = () =>
    ({
      tenantId: 'tenant-1',
      instanceId: 'instance-1',
      message: {
        id: 'wamid-1',
        metadata: {},
        payload: {},
      },
    }) as unknown as InboundWhatsAppEnvelope;

  it('detects poll_update using metadata hints', () => {
    const segments = {
      payload: {},
      message: { type: 'poll_choice' },
      metadata: { broker: { messageContentType: 'poll_update' } },
    } satisfies Parameters<typeof resolveMessageType>[0];

    expect(resolveMessageType(segments)).toBe('poll_update');
  });

  it('normalizes poll votes without original text when option label is available', () => {
    const envelope = buildEnvelope();
    const segments = {
      payload: { timestamp: '2024-05-10T12:00:05.000Z' },
      message: {
        type: 'poll_update',
        pollUpdateMessage: { pollCreationMessageId: 'poll-1' },
      },
      metadata: {
        poll: {
          id: 'poll-1',
          question: 'Qual sua cor favorita?',
        },
        pollChoice: {
          pollId: 'poll-1',
          vote: {
            selectedOptions: [{ id: 'option-azul', title: 'Azul' }],
            optionIds: ['option-azul'],
          },
        },
      },
    } as const;

    const baseMetadata = {
      tenantId: 'tenant-1',
      instanceId: 'instance-1',
    } satisfies Record<string, unknown>;

    const result = normalizePollUpdate({
      envelope,
      segments,
      baseMetadata,
      chatId: '5511999999999@s.whatsapp.net',
      externalId: 'wamid-1',
    });

    expect(result.isPollUpdate).toBe(true);
    expect(result.placeholder).toBe(false);

    const message = (result as Extract<typeof result, { placeholder: false }>).message as Record<string, unknown>;
    expect(message.text).toBe('Azul');
    expect(message.type).toBe('TEXT');

    const metadata = (result as Extract<typeof result, { placeholder: false }>).metadata as Record<string, unknown>;
    expect(metadata.placeholder).toBe(false);
    expect(metadata.chatId).toBe('5511999999999@s.whatsapp.net');

    const poll = (metadata.poll ?? {}) as Record<string, unknown>;
    expect(poll.id).toBe('poll-1');
    expect(poll.question).toBe('Qual sua cor favorita?');
    const selected = Array.isArray(poll.selectedOptions) ? (poll.selectedOptions as Record<string, unknown>[]) : [];
    expect(selected[0]?.title).toBe('Azul');

    const pollChoice = (metadata.pollChoice ?? {}) as Record<string, unknown>;
    const vote = (pollChoice.vote ?? {}) as Record<string, unknown>;
    expect(Array.isArray(vote.selectedOptions)).toBe(true);
    expect(vote.optionIds).toEqual(['option-azul']);
    expect(vote.timestamp).toBe('2024-05-10T12:00:05.000Z');
  });

  it('builds human-friendly text when vote has question but no option label', () => {
    const envelope = buildEnvelope();
    const segments = {
      payload: {},
      message: { type: 'poll_update' },
      metadata: {
        poll: { question: 'Você confirma sua presença?' },
        pollChoice: { vote: {} },
      },
    } as const;

    const baseMetadata = { tenantId: 'tenant-1' } satisfies Record<string, unknown>;

    const result = normalizePollUpdate({
      envelope,
      segments,
      baseMetadata,
      chatId: null,
      externalId: 'wamid-2',
    });

    expect(result.isPollUpdate).toBe(true);
    expect(result.placeholder).toBe(false);

    const message = (result as Extract<typeof result, { placeholder: false }>).message as Record<string, unknown>;
    expect(message.text).toBe(buildPollVoteText('Você confirma sua presença?', null));

    const metadata = (result as Extract<typeof result, { placeholder: false }>).metadata as Record<string, unknown>;
    expect(metadata.poll).toBeDefined();
    const poll = (metadata.poll ?? {}) as Record<string, unknown>;
    expect(poll.question).toBe('Você confirma sua presença?');
    expect(poll.selectedOptions).toBeUndefined();
    expect(poll.selectedOptionIds).toBeUndefined();
  });

  it('marks messages as placeholder when vote lacks question and choice text', () => {
    const envelope = buildEnvelope();
    const segments = {
      payload: {},
      message: { type: 'poll_update' },
      metadata: {
        poll: {},
        pollChoice: { vote: {} },
      },
    } as const;

    const baseMetadata = {
      tenantId: 'tenant-1',
      poll: { id: 'poll-legacy' },
    } satisfies Record<string, unknown>;

    const result = normalizePollUpdate({
      envelope,
      segments,
      baseMetadata,
      chatId: null,
      externalId: 'wamid-3',
    });

    expect(result.isPollUpdate).toBe(true);
    expect(result.placeholder).toBe(true);

    const metadata = (result as Extract<typeof result, { placeholder: true }>).metadata as Record<string, unknown>;
    expect(metadata.placeholder).toBe(true);
    const poll = (metadata.poll ?? {}) as Record<string, unknown>;
    expect(poll.id).toBe('poll-legacy');
    expect(typeof poll.updatedAt).toBe('string');
  });
});
