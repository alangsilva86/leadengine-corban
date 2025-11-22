import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import useCampaignWorkflow from '../useCampaignWorkflow';
import type { WhatsAppConnectState } from '../useWhatsAppConnect';

const mockCampaignActions = vi.fn();

vi.mock('../hooks/useWhatsappCampaignActions', () => ({
  __esModule: true,
  default: (params: any) => mockCampaignActions(params),
}));

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

describe('useCampaignWorkflow', () => {
  beforeEach(() => {
    mockCampaignActions.mockReturnValue({ actions: 'ok' });
    mockCampaignActions.mockClear();
  });

  it('delegates to useWhatsappCampaignActions', () => {
    const dispatch = vi.fn();
    const instance = { id: 'inst-1' };

    const { result } = renderHook(() =>
      useCampaignWorkflow({
        state: baseState,
        dispatch,
        selectedAgreement: { id: 'agreement-1' },
        activeCampaign: null,
        instance,
        instances: [instance],
        handleAuthFallback: vi.fn(),
        logError: vi.fn(),
      })
    );

    expect(mockCampaignActions).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ actions: 'ok' });
    const params = mockCampaignActions.mock.calls[0]?.[0];
    expect(params?.instance).toEqual(instance);
    expect(params?.instances).toEqual([instance]);
  });
});
