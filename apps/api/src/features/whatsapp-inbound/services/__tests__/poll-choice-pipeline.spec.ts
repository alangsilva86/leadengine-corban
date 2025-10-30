import { describe, expect, it, vi } from 'vitest';

import {
  persistPollChoiceVote,
  rewritePollVoteMessage,
  schedulePollInboxFallback,
  validatePollChoicePayload,
} from '../poll-choice-pipeline';
import type {
  PersistPollChoiceVoteDeps,
  RewritePollVoteMessageDeps,
  SchedulePollInboxFallbackDeps,
} from '../poll-choice-pipeline';
import type {
  PollChoiceEventPayload,
  PollChoiceSelectedOptionPayload,
  PollChoiceState,
} from '../../schemas/poll-choice';

describe('poll-choice-pipeline', () => {
  describe('validatePollChoicePayload', () => {
    it('flags missing payloads as invalid', () => {
      const result = validatePollChoicePayload(null);
      expect(result).toEqual({ status: 'invalid', reason: 'missing_payload' });
    });

    it('returns parsed payload when valid', () => {
      const payload = { pollId: 'poll-1', voterJid: 'voter@s.whatsapp.net', options: [], aggregates: {} };
      const result = validatePollChoicePayload(payload);
      expect(result.status).toBe('valid');
      expect(result).toMatchObject({ payload: expect.objectContaining({ pollId: 'poll-1' }) });
    });
  });

  describe('persistPollChoiceVote', () => {
    const basePayload: PollChoiceEventPayload = {
      pollId: 'poll-1',
      voterJid: '5511999999999@s.whatsapp.net',
      options: [],
      aggregates: {},
    };

    it('returns persisted vote data when service updates state', async () => {
      const recordMock: PersistPollChoiceVoteDeps['recordPollChoiceVote'] = vi.fn().mockResolvedValue({
        updated: true,
        selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        state: {
          pollId: 'poll-1',
          options: [],
          votes: {},
          aggregates: {},
          brokerAggregates: {},
          updatedAt: new Date().toISOString(),
        } as PollChoiceState,
      });

      const result = await persistPollChoiceVote(basePayload, { tenantId: 'tenant-1' }, { recordPollChoiceVote: recordMock });

      expect(recordMock).toHaveBeenCalledWith(basePayload, { tenantId: 'tenant-1' });
      expect(result.status).toBe('persisted');
      expect(result.candidateMessageIds).toContain('poll-1');
      expect(result.poll.selectedOptions).toEqual([{ id: 'opt-1', title: 'Option 1' }]);
    });

    it('returns duplicate status when service reports no update', async () => {
      const recordMock: PersistPollChoiceVoteDeps['recordPollChoiceVote'] = vi.fn().mockResolvedValue({
        updated: false,
        selectedOptions: [],
        state: {
          pollId: 'poll-1',
          options: [],
          votes: {},
          aggregates: {},
          brokerAggregates: {},
          updatedAt: new Date().toISOString(),
        } as PollChoiceState,
      });

      const result = await persistPollChoiceVote(basePayload, { tenantId: null }, { recordPollChoiceVote: recordMock });

      expect(result.status).toBe('duplicate');
      expect(result.poll.selectedOptions).toEqual([]);
    });
  });

  describe('rewritePollVoteMessage', () => {
    const poll = {
      pollId: 'poll-1',
      voterJid: '5511999999999@s.whatsapp.net',
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    } as PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };

    const state: PollChoiceState = {
      pollId: 'poll-1',
      options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
      votes: {},
      aggregates: {},
      brokerAggregates: {},
      updatedAt: new Date().toISOString(),
      context: { tenantId: 'tenant-from-state' },
    } as PollChoiceState;

    it('returns missing tenant when no context is resolved', async () => {
      const deps: RewritePollVoteMessageDeps = {
        updatePollVoteMessage: vi.fn(),
      };

      const result = await rewritePollVoteMessage(
        {
          poll,
          state,
          voterState: null,
          candidateMessageIds: ['candidate-1'],
          tenantContext: null,
        },
        deps
      );

      expect(result).toEqual({ status: 'missingTenant', candidates: ['candidate-1'] });
      expect(deps.updatePollVoteMessage).not.toHaveBeenCalled();
    });

    it('invokes update handler when tenant context is available', async () => {
      const deps: RewritePollVoteMessageDeps = {
        updatePollVoteMessage: vi.fn().mockResolvedValue(undefined),
      };

      const result = await rewritePollVoteMessage(
        {
          poll,
          state,
          voterState: null,
          candidateMessageIds: ['candidate-1'],
          tenantContext: 'tenant-override',
        },
        deps
      );

      expect(result).toEqual({ status: 'updated', tenantId: 'tenant-override' });
      expect(deps.updatePollVoteMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-override',
          pollId: 'poll-1',
          voterJid: '5511999999999@s.whatsapp.net',
        })
      );
    });
  });

  describe('schedulePollInboxFallback', () => {
    const poll = {
      pollId: 'poll-1',
      voterJid: '5511999999999',
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    } as PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };

    it('returns missing tenant when tenant context is absent', async () => {
      const result = await schedulePollInboxFallback(
        {
          tenantId: null,
          poll,
          identifiers: ['poll-1'],
          selectedOptions: poll.selectedOptions,
        },
        {}
      );

      expect(result).toEqual({ status: 'missingTenant', pollId: 'poll-1', tenantId: null, chatId: '5511999999999@s.whatsapp.net' });
    });

    it('skips inbox fallback when metadata matches existing poll message', async () => {
      const deps: SchedulePollInboxFallbackDeps = {
        findPollVoteMessageCandidate: vi.fn().mockResolvedValue({
          id: 'message-1',
          metadata: {
            rewrite: {
              pollVote: {
                selectedOptions: [{ id: 'opt-1' }],
              },
            },
          },
        }),
      } as unknown as SchedulePollInboxFallbackDeps;

      const result = await schedulePollInboxFallback(
        {
          tenantId: 'tenant-1',
          poll,
          identifiers: ['poll-1'],
          selectedOptions: poll.selectedOptions,
        },
        deps
      );

      expect(result).toEqual({
        status: 'skip',
        reason: 'up_to_date',
        pollId: 'poll-1',
        tenantId: 'tenant-1',
        chatId: '5511999999999@s.whatsapp.net',
        existingMessageId: 'message-1',
      });
    });

    it('requires inbox fallback when no existing message is available', async () => {
      const deps: SchedulePollInboxFallbackDeps = {
        findPollVoteMessageCandidate: vi.fn().mockResolvedValue(null),
      };

      const result = await schedulePollInboxFallback(
        {
          tenantId: 'tenant-1',
          poll,
          identifiers: ['poll-1'],
          selectedOptions: poll.selectedOptions,
        },
        deps
      );

      expect(result).toEqual({
        status: 'requireInbox',
        tenantId: 'tenant-1',
        pollId: 'poll-1',
        chatId: '5511999999999@s.whatsapp.net',
        existingMessageId: null,
      });
    });
  });
});
