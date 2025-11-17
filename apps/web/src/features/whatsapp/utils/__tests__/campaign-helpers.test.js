import { describe, expect, it } from 'vitest';

import { getCampaignStatusTone } from '../campaign-helpers.js';

describe('campaign status tone helpers', () => {
  it('returns the mapped tone for known statuses', () => {
    expect(getCampaignStatusTone('active')).toBe('success');
    expect(getCampaignStatusTone('paused')).toBe('warning');
    expect(getCampaignStatusTone('draft')).toBe('info');
    expect(getCampaignStatusTone('ended')).toBe('neutral');
    expect(getCampaignStatusTone('archived')).toBe('neutral');
  });

  it('falls back to neutral for unknown statuses', () => {
    expect(getCampaignStatusTone('unknown')).toBe('neutral');
    expect(getCampaignStatusTone(null)).toBe('neutral');
    expect(getCampaignStatusTone(undefined)).toBe('neutral');
  });
});
