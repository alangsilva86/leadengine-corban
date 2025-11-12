import { describe, expect, it } from 'vitest';

import type { WhatsAppConnectState } from '../connect/useWhatsAppConnect';
import { whatsappConnectReducer } from '../connect/useWhatsAppConnect';

describe('whatsappConnectReducer', () => {
  const baseState: WhatsAppConnectState = {
    showAllInstances: false,
    qrPanelOpen: true,
    isQrDialogOpen: false,
    pairingPhoneInput: '',
    pairingPhoneError: null,
    requestingPairingCode: false,
    errorState: null,
    campaign: null,
    campaigns: [],
    campaignsLoading: false,
    campaignError: null,
    campaignAction: null,
    instancePendingDelete: null,
    isCreateInstanceOpen: false,
    isCreateCampaignOpen: false,
    expandedInstanceId: null,
    pendingReassign: null,
    reassignIntent: 'reassign',
    persistentWarning: null,
  };

  it('returns the existing state when qr panel visibility does not change', () => {
    const nextState = whatsappConnectReducer(baseState, {
      type: 'set-qr-panel-open',
      value: true,
    });

    expect(nextState).toBe(baseState);
  });

  it('returns a new state when qr panel visibility changes', () => {
    const nextState = whatsappConnectReducer(baseState, {
      type: 'set-qr-panel-open',
      value: false,
    });

    expect(nextState).not.toBe(baseState);
    expect(nextState.qrPanelOpen).toBe(false);
  });
});
