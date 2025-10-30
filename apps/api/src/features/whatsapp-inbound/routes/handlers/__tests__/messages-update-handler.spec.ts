import { describe, expect, it } from 'vitest';

import { processMessagesUpdate } from '../messages-update-handler';
import { __testing as webhookControllerTesting } from '../../webhook-controller';

describe('messages-update handler module', () => {
  it('re-exports the default status update handler used by the controller', () => {
    const defaultHandler =
      webhookControllerTesting.eventHandlers.defaults.WHATSAPP_MESSAGES_UPDATE.handler;

    expect(processMessagesUpdate).toBe(defaultHandler);
  });
});
