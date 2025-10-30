import { describe, expect, it } from 'vitest';

import { processNormalizedMessage } from '../normalized-message-handler';
import { processNormalizedMessage as originalProcessNormalizedMessage } from '../../webhook-routes';

describe('normalized-message handler module', () => {
  it('re-exports the normalization helper used by the webhook controller', () => {
    expect(processNormalizedMessage).toBe(originalProcessNormalizedMessage);
  });
});
