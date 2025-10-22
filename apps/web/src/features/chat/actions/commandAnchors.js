export const CONVERSATION_ACTION_IDS = {
  assign: 'conversation-action-assign',
  scheduleFollowUp: 'conversation-action-schedule-follow-up',
  registerResult: 'conversation-action-register-result',
  phone: 'conversation-action-phone',
};

export const COMMAND_ACTION_ANCHOR_ALIASES = {
  'assign-owner': [CONVERSATION_ACTION_IDS.assign],
  'quick-followup': [CONVERSATION_ACTION_IDS.scheduleFollowUp],
  'register-result': [CONVERSATION_ACTION_IDS.registerResult],
  'phone-call': [CONVERSATION_ACTION_IDS.phone],
};

export const getPrimaryCommandAnchorId = (actionId) => `command-${actionId}`;

export const getAllAnchorIdsForCommand = (actionId) => {
  const aliases = COMMAND_ACTION_ANCHOR_ALIASES[actionId] ?? [];
  return [getPrimaryCommandAnchorId(actionId), ...aliases];
};

export default COMMAND_ACTION_ANCHOR_ALIASES;
