import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  encodePollVoteMessage,
  encryptPollVoteForTest,
} from '../../../../lib/whatsapp-crypto/__tests__/test-utils';
import { getPollMetadata } from '../poll-metadata-service';
import {
  normalizePollUpdate,
  resolveMessageType,
  buildPollVoteText,
} from '../poll-update-normalizer';
import type { InboundWhatsAppEnvelope } from '../types';

// normalizePollUpdate consulta metadados persistidos da enquete; aqui não há enquete salva.
vi.mock('../poll-metadata-service', () => ({
  getPollMetadata: vi.fn(async () => null),
}));

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

  it('normalizes poll votes without original text when option label is available', async () => {
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

    const result = await normalizePollUpdate({
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

  it('builds human-friendly text when vote has question but no option label', async () => {
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

    const result = await normalizePollUpdate({
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

  it('decrypts the encrypted vote with the stored poll metadata (real AES-GCM payload)', async () => {
    const pollEncKey = randomBytes(32);
    const voterJid = '5511888888888@s.whatsapp.net';
    const optionHash = (name: string) => createHash('sha256').update(name).digest();
    const azulId = optionHash('Azul').toString('base64url');
    const encIv = randomBytes(12);
    const encPayload = encryptPollVoteForTest({
      pollMsgId: 'poll-crypto',
      pollCreatorJid: '5511999999999@s.whatsapp.net',
      voterJid,
      pollEncKey,
      encIv,
      plaintext: encodePollVoteMessage([optionHash('Azul')]),
    });
    vi.mocked(getPollMetadata).mockResolvedValueOnce({
      pollId: 'poll-crypto',
      question: 'Qual sua cor favorita?',
      options: [
        { id: optionHash('Verde').toString('base64url'), title: 'Verde', index: 0 },
        { id: azulId, title: 'Azul', index: 1 },
      ],
      creationMessageId: 'poll-crypto',
      creationMessageKey: { remoteJid: '5511999999999@s.whatsapp.net' },
      messageSecret: pollEncKey.toString('base64'),
    });

    const result = await normalizePollUpdate({
      envelope: buildEnvelope(),
      segments: {
        payload: {},
        message: {
          type: 'poll_update',
          pollUpdateMessage: {
            vote: { encPayload: encPayload.toString('base64'), encIv: encIv.toString('base64') },
          },
        },
        metadata: { poll: { id: 'poll-crypto' } },
      },
      baseMetadata: { tenantId: 'tenant-1' },
      chatId: voterJid,
      externalId: 'wamid-crypto',
    });

    expect(result).toMatchObject({ isPollUpdate: true, placeholder: false });
    const metadata = (result as Extract<typeof result, { placeholder: false }>).metadata as Record<string, any>;
    expect(metadata.poll.selectedOptionIds).toEqual([azulId]);
    expect(metadata.poll.selectedOptions).toEqual([{ id: azulId, title: 'Azul', text: 'Azul' }]);
    expect(metadata.pollChoice.vote.optionIds).toEqual([azulId]);
    expect(Buffer.from(azulId, 'base64url').length).toBe(32);
  });

  it('marks messages as placeholder when vote lacks question and choice text', async () => {
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

    const result = await normalizePollUpdate({
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
