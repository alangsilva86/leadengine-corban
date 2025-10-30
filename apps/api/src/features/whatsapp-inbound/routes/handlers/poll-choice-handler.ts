import { __testing as pollVoteUpdaterTesting } from '../../services/poll-vote-updater';

export {
  processPollChoiceEvent,
  type PollChoiceHandlerOutcome,
} from '../webhook-routes';

export const POLL_SPECIAL_EVENT = 'POLL_CHOICE' as const;

export const buildPollVoteMessageContent = pollVoteUpdaterTesting.buildPollVoteMessageContent;
