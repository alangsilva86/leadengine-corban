import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

import { whatsappConnectReducer } from '../useWhatsAppConnect';
import useTenantInstances from '../useTenantInstances';

const mockLoadInstances = vi.fn();
const mockSelectInstance = vi.fn();

const mockUseWhatsAppInstances = vi.fn(() => ({
  instances: [
    { id: 'inst-1', metadata: { tenantId: 'tenant-a' }, connected: true, status: 'connected' },
    { id: 'inst-2', metadata: { tenantId: 'tenant-b' }, connected: true, status: 'connected' },
  ],
  instancesReady: true,
  currentInstance: { id: 'inst-1', metadata: { tenantId: 'tenant-a' } },
  status: 'connected',
  qrData: null,
  secondsLeft: null,
  loadingInstances: false,
  loadingQr: false,
  isAuthenticated: true,
  deletingInstanceId: null,
  liveEvents: [],
  loadInstances: mockLoadInstances,
  selectInstance: mockSelectInstance,
  generateQr: vi.fn(),
  connectInstance: vi.fn(),
  createInstance: vi.fn(),
  deleteInstance: vi.fn(),
  markConnected: vi.fn(),
  handleAuthFallback: vi.fn(),
  setSecondsLeft: vi.fn(),
  setGeneratingQrState: vi.fn(),
  setStatus: vi.fn(),
  realtimeConnected: true,
  selectedInstanceStatus: 'connected',
}));

vi.mock('../../hooks/useWhatsAppInstances.jsx', () => ({
  __esModule: true,
  default: (params: any) => mockUseWhatsAppInstances(params),
}));

const baseState = {
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
  reassignIntent: 'reassign' as const,
  persistentWarning: null,
};

describe('useTenantInstances', () => {
  beforeEach(() => {
    mockUseWhatsAppInstances.mockClear();
    mockLoadInstances.mockReset();
    mockSelectInstance.mockReset();
    window.localStorage.clear();
  });

  it('filters instances by tenant and toggles showAllInstances', async () => {
    const { result } = renderHook(() => {
      const [state, setState] = useState(baseState);
      const dispatch = (action: any) => setState((prev) => whatsappConnectReducer(prev, action));

      return useTenantInstances({
        state,
        dispatch,
        selectedAgreement: { id: 'agreement-1', tenantId: 'tenant-a' },
        status: 'disconnected',
        activeCampaign: null,
        onStatusChange: vi.fn(),
        onError: vi.fn(),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        campaignInstanceId: null,
      });
    });

    expect(result.current.renderInstances).toHaveLength(1);
    expect(result.current.renderInstances[0]?.id).toBe('inst-1');

    await act(async () => {
      result.current.setShowAllInstances(true);
    });

    expect(result.current.showAllInstances).toBe(true);
    expect(result.current.renderInstances).toHaveLength(1);
  });

  it('falls back to all instances when tenant id is missing', () => {
    const { result } = renderHook(() => {
      const [state, setState] = useState(baseState);
      const dispatch = (action: any) => setState((prev) => whatsappConnectReducer(prev, action));

      return useTenantInstances({
        state,
        dispatch,
        selectedAgreement: { id: 'agreement-1' },
        status: 'connected',
        activeCampaign: null,
        onStatusChange: vi.fn(),
        onError: vi.fn(),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        campaignInstanceId: null,
      });
    });

    expect(result.current.renderInstances).toHaveLength(2);
    expect(result.current.tenantScopeNotice).toBeNull();
  });
});
