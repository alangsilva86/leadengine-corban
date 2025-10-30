import { describe, expect, it } from 'vitest';

import {
  buildPollVoteMessageContent,
  processPollChoiceEvent,
  POLL_SPECIAL_EVENT,
} from '../poll-choice-handler';
import type { PollChoiceSelectedOptionPayload } from '../../../schemas/poll-choice';
import { __testing as webhookControllerTesting } from '../../webhook-controller';

describe('poll-choice handler module', () => {
  it('normalizes selected poll option titles', () => {
    const selected: PollChoiceSelectedOptionPayload[] = [
      { id: 'opt-yes', title: ' Sim 👍 ' },
    ];

    expect(buildPollVoteMessageContent(selected)).toBe('Sim 👍');
  });

  it('returns null when no poll option contains visible characters', () => {
    const selected: PollChoiceSelectedOptionPayload[] = [
      { id: 'ignored', title: '   ' },
    ];

    expect(buildPollVoteMessageContent(selected)).toBeNull();
  });

  it('exposes the handler used by the controller event map', () => {
    const defaultHandler = webhookControllerTesting.eventHandlers.defaults.POLL_CHOICE.handler;

    expect(processPollChoiceEvent).toBe(defaultHandler);
    expect(POLL_SPECIAL_EVENT).toBe('POLL_CHOICE');
  });
});
