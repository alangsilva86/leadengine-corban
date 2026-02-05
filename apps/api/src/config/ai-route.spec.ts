import { afterEach, describe, expect, it } from 'vitest';

import { getAiRoutingPreferences } from './ai-route';

const snapshotEnv = () => ({ ...process.env });

describe('ai-route', () => {
  const baseEnv = snapshotEnv();

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it('defaults server auto-reply to disabled when env is missing', () => {
    delete process.env.AI_AUTO_REPLY_ENABLED;
    delete process.env.AI_AUTO_REPLY_SERVER_ENABLED;
    delete process.env.AI_AUTO_REPLY_FORCE_SERVER;
    delete process.env.AI_ROUTE_ALLOW_SERVER_AUTO_REPLY;

    const prefs = getAiRoutingPreferences();
    expect(prefs.serverAutoReplyEnabled).toBe(false);
  });

  it('enables server auto-reply when AI_AUTO_REPLY_ENABLED=true', () => {
    process.env.AI_AUTO_REPLY_ENABLED = 'true';
    const prefs = getAiRoutingPreferences();
    expect(prefs.serverAutoReplyEnabled).toBe(true);
  });
});

