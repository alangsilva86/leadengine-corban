import { describe, expect, it } from 'vitest';

import { campaignReducer, initialCampaignState } from '../campaignState';

describe('campaignReducer', () => {
  it('marks the list as loaded when campaigns arrive', () => {
    const next = campaignReducer(initialCampaignState, { type: 'set-campaigns', value: [{ id: 'c1' }] });
    expect(next.campaigns).toHaveLength(1);
    expect(next.campaignsLoaded).toBe(true);
  });

  it('keeps the same state when the loading flag does not change', () => {
    expect(campaignReducer(initialCampaignState, { type: 'set-campaigns-loading', value: false })).toBe(
      initialCampaignState,
    );
  });

  it('tracks dialogs and pending actions', () => {
    let state = campaignReducer(initialCampaignState, { type: 'set-create-campaign-open', value: true });
    state = campaignReducer(state, { type: 'set-pending-reassign', value: { id: 'c1' } });
    state = campaignReducer(state, { type: 'set-campaign-action', value: { id: 'c1', type: 'paused' } });
    expect(state).toMatchObject({
      isCreateCampaignOpen: true,
      pendingReassign: { id: 'c1' },
      campaignAction: { id: 'c1', type: 'paused' },
    });
  });
});
