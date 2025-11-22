import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import useSessionUiState from '../useSessionUiState';
import type { WhatsAppConnectState } from '../useWhatsAppConnect';

const mockSessionState = {
  statusCopy: { badge: 'ok', description: '', tone: 'success' },
  statusTone: 'success',
  countdownMessage: null,
  qrImageSrc: null,
  isGeneratingQrImage: false,
  qrStatusMessage: 'ready',
  isBusy: false,
  canContinue: true,
  qrPanelOpen: true,
  isQrDialogOpen: false,
  handleViewQr: vi.fn(),
  handleGenerateQr: vi.fn(),
  handleMarkConnected: vi.fn(),
};

const mockPairingState = {
  pairingPhoneInput: '',
  pairingPhoneError: null,
  requestingPairingCode: false,
  handlePairingPhoneChange: vi.fn(),
  handleRequestPairingCode: vi.fn(),
};

const sessionMock = vi.fn(() => mockSessionState);
const pairingMock = vi.fn(() => mockPairingState);

vi.mock('../hooks/useWhatsappSessionState', () => ({
  __esModule: true,
  default: (params: any) => sessionMock(params),
}));

vi.mock('../hooks/useWhatsappPairing', () => ({
  __esModule: true,
  default: (params: any) => pairingMock(params),
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

describe('useSessionUiState', () => {
  beforeEach(() => {
    sessionMock.mockClear();
    pairingMock.mockClear();
  });

  it('merges session and pairing state', () => {
    const dispatch = vi.fn();
    const setErrorMessage = vi.fn();

    const { result } = renderHook(() =>
      useSessionUiState({
        state: baseState,
        dispatch,
        localStatus: 'connected',
        qrData: null,
        secondsLeft: null,
        setSecondsLeft: vi.fn(),
        setInstanceStatus: vi.fn(),
        setGeneratingQrState: vi.fn(),
        loadingInstances: false,
        loadingQr: false,
        instance: { id: 'inst-1' },
        realtimeConnected: true,
        selectInstance: vi.fn(),
        generateQr: vi.fn(),
        markConnected: vi.fn(),
        connectInstance: vi.fn(),
        loadInstances: vi.fn(),
        setErrorMessage,
        selectedAgreementId: 'agreement-1',
        requestingPairingCode: false,
      })
    );

    expect(result.current.statusCopy).toEqual(mockSessionState.statusCopy);
    expect(result.current.handleRequestPairingCode).toBe(mockPairingState.handleRequestPairingCode);
    expect(sessionMock).toHaveBeenCalled();
    expect(pairingMock).toHaveBeenCalled();
  });
});
