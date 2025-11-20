/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Suspense } from 'react';

import WhatsAppCampaigns from '../index';

const setCreateCampaignOpenMock = vi.fn();
const reloadCampaignsMock = vi.fn();
const updateCampaignStatusMock = vi.fn();
const deleteCampaignMock = vi.fn();
const setPendingReassignMock = vi.fn();
const setReassignIntentMock = vi.fn();
const reassignCampaignMock = vi.fn();
const onContinueMock = vi.fn();
const onNavigateStageMock = vi.fn();

const stubCampaign = { id: 'campaign-1', name: 'Campanha Demo' };

vi.mock('../../connect/useWhatsAppConnect', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    statusCopy: { badge: 'Operacional' },
    statusTone: 'success',
    confirmLabel: 'Ir para a Inbox',
    confirmDisabled: false,
    onBack: vi.fn(),
    onContinue: onContinueMock,
    campaigns: [stubCampaign],
    campaignsLoading: false,
    campaignError: null,
    campaignAction: null,
    reloadCampaigns: reloadCampaignsMock,
    updateCampaignStatus: updateCampaignStatusMock,
    deleteCampaign: deleteCampaignMock,
    reassignCampaign: reassignCampaignMock,
    canCreateCampaigns: true,
    selectedAgreement: { id: 'agreement-1', name: 'Convênio XPTO' },
    selectedInstance: { id: 'instance-1', name: 'Instância A' },
    setCreateCampaignOpen: setCreateCampaignOpenMock,
    isCreateCampaignOpen: false,
    createCampaign: vi.fn(),
    renderInstances: [{ id: 'instance-1', name: 'Instância A', connected: true }],
    setPendingReassign: setPendingReassignMock,
    pendingReassign: null,
    setReassignIntent: setReassignIntentMock,
    reassignIntent: 'reassign',
    fetchCampaignImpact: vi.fn(),
    agreementName: 'Convênio XPTO',
    persistentWarning: 'Os leads continuam chegando normalmente.',
    nextStage: 'Inbox',
    stepLabel: 'Passo 3 de 5',
    onboardingDescription: 'Configure campanhas para distribuir os leads.',
  })),
}));

vi.mock('../../components/CampaignsPanel.jsx', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid="campaigns-panel">
      <button type="button" onClick={props.onCreateClick}>
        Nova campanha
      </button>
      <button type="button" onClick={() => props.onReassign(stubCampaign)}>
        Reatribuir campanha
      </button>
      <button type="button" onClick={() => props.onDisconnect(stubCampaign)}>
        Desconectar campanha
      </button>
    </div>
  ),
}));

vi.mock('../../components/CreateCampaignDialog.jsx', () => ({
  __esModule: true,
  default: ({ open, onOpenChange }) =>
    open ? (
      <div data-testid="create-campaign-dialog">
        Criar campanha
        <button type="button" onClick={() => onOpenChange(false)}>
          Fechar
        </button>
      </div>
    ) : null,
}));

vi.mock('../../components/ReassignCampaignDialog.jsx', () => ({
  __esModule: true,
  default: ({ open, onClose }) =>
    open ? (
      <div data-testid="reassign-campaign-dialog">
        Reatribuir campanha
        <button type="button" onClick={() => onClose(false)}>
          Cancelar
        </button>
      </div>
    ) : null,
}));

describe('WhatsAppCampaigns', () => {
  beforeEach(() => {
    setCreateCampaignOpenMock.mockClear();
    reloadCampaignsMock.mockClear();
    updateCampaignStatusMock.mockClear();
    deleteCampaignMock.mockClear();
    setPendingReassignMock.mockClear();
    setReassignIntentMock.mockClear();
    reassignCampaignMock.mockClear();
    onContinueMock.mockClear();
    onNavigateStageMock.mockClear();
  });

  it('renders the campaigns dashboard and handles actions', async () => {
    render(
      <Suspense fallback={<span>loading</span>}>
        <WhatsAppCampaigns />
      </Suspense>
    );

    expect(await screen.findByText('Gerencie suas campanhas')).toBeInTheDocument();
    expect(screen.getByText('Os leads continuam chegando normalmente.')).toBeInTheDocument();
    expect(screen.getByTestId('campaigns-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Nova campanha'));
    expect(setCreateCampaignOpenMock).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('Reatribuir campanha'));
    expect(setPendingReassignMock).toHaveBeenCalledWith(stubCampaign);
    expect(setReassignIntentMock).toHaveBeenCalledWith('reassign');

    fireEvent.click(screen.getByText('Desconectar campanha'));
    expect(setPendingReassignMock).toHaveBeenCalledWith(stubCampaign);
    expect(setReassignIntentMock).toHaveBeenCalledWith('disconnect');

    fireEvent.click(screen.getByText('Ir para a Inbox'));
    expect(onContinueMock).toHaveBeenCalledTimes(1);
  });

  it('navigates between stages when the stepper is clicked', async () => {
    render(
      <Suspense fallback={<span>loading</span>}>
        <WhatsAppCampaigns
          onboarding={{
            stages: [
              { id: 'channels', label: 'Canais' },
              { id: 'campaigns', label: 'Campanhas' },
              { id: 'inbox', label: 'Inbox' },
            ],
            activeStep: 1,
          }}
          onNavigateStage={onNavigateStageMock}
        />
      </Suspense>
    );

    fireEvent.click(await screen.findByText('Inbox'));
    expect(onNavigateStageMock).toHaveBeenCalledWith('inbox');
  });
});
