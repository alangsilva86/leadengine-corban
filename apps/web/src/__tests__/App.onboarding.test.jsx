/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const STORAGE_KEY = 'leadengine_onboarding_v1';

const layoutMockState = { calls: [] };

const defaultApiGetImplementation = async (url) => {
  if (url === '/api/auth/me') {
    return { data: { id: 'user-1', tenantId: 'tenant-1' } };
  }

  if (url === '/api/lead-engine/agreements') {
    return { data: [] };
  }

  return { data: null };
};

const apiGetMock = vi.fn(defaultApiGetImplementation);

vi.mock('../lib/api.js', () => ({
  apiGet: (...args) => apiGetMock(...args),
}));

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args) => apiGetMock(...args),
}));

const onAuthTokenChangeMock = vi.fn(() => () => {});
const onTenantIdChangeMock = vi.fn(() => () => {});

vi.mock('../lib/auth.js', () => ({
  onAuthTokenChange: (...args) => onAuthTokenChangeMock(...args),
  onTenantIdChange: (...args) => onTenantIdChangeMock(...args),
}));

vi.mock('../components/Layout.jsx', () => ({
  default: ({ children, onboarding, currentPage, onNavigate }) => {
    layoutMockState.calls.push({
      currentPage,
      stages: onboarding?.stages ?? [],
      activeStep: onboarding?.activeStep ?? null,
    });

    return (
      <div data-testid="layout" data-current-page={currentPage}>
        <div data-testid="layout-stages">
          {(onboarding?.stages ?? []).map((stage) => stage.id).join(',')}
        </div>
        <div data-testid="layout-active-step">{onboarding?.activeStep ?? ''}</div>
        <button type="button" data-testid="navigate-dashboard" onClick={() => onNavigate?.('dashboard')}>
          Ir para dashboard
        </button>
        <button type="button" data-testid="navigate-agreements" onClick={() => onNavigate?.('agreements')}>
          Ir para agreements
        </button>
        {children}
      </div>
    );
  },
}));

vi.mock('../components/Dashboard.jsx', () => ({
  default: ({ onboarding, onStart }) => (
    <div data-testid="dashboard-page">
      <div data-testid="dashboard-stages">{(onboarding?.stages ?? []).map((stage) => stage.id).join(',')}</div>
      <button type="button" onClick={() => onStart?.()}>Começar</button>
    </div>
  ),
}));

vi.mock('../components/AgreementGrid.jsx', () => ({
  default: () => <div data-testid="agreements-page">Convênios</div>,
}));

vi.mock('../features/whatsapp/WhatsAppConnect.jsx', () => ({
  default: ({ onContinue }) => (
    <div data-testid="whatsapp-page">
      <button type="button" onClick={() => onContinue?.()}>Continuar para Inbox</button>
    </div>
  ),
}));

vi.mock('../features/chat/ChatCommandCenter.jsx', () => ({
  default: () => <div data-testid="inbox-page">Inbox</div>,
}));

vi.mock('../components/Reports.jsx', () => ({
  default: () => <div data-testid="reports-page">Reports</div>,
}));

vi.mock('../components/Settings.jsx', () => ({
  default: () => <div data-testid="settings-page">Settings</div>,
}));

vi.mock('../features/debug/BaileysLogs.jsx', () => ({
  default: () => <div data-testid="baileys-page">Logs</div>,
}));

// Import after mocks are registered
import App from '../App.jsx';
import useAgreements from '../features/agreements/useAgreements.js';

const getLatestLayoutCall = () => layoutMockState.calls.at(-1) ?? null;

describe('App onboarding journey', () => {
  beforeEach(() => {
    layoutMockState.calls = [];
    localStorage.clear();
    apiGetMock.mockImplementation(defaultApiGetImplementation);
  });

  afterEach(() => {
    cleanup();
    layoutMockState.calls = [];
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('navigates to WhatsApp when no instance is connected', async () => {
    render(<App />);

    await waitFor(() =>
      expect(screen.getByTestId('layout-stages')).toHaveTextContent('dashboard,whatsapp,inbox')
    );

    const startButton = await screen.findByRole('button', { name: /começar/i });
    await userEvent.click(startButton);

    await waitFor(() => expect(screen.getByTestId('layout')).toHaveAttribute('data-current-page', 'whatsapp'));
    expect(await screen.findByTestId('whatsapp-page')).toBeInTheDocument();

    const latestLayout = getLatestLayoutCall();
    expect(latestLayout?.stages.map((stage) => stage.id)).toEqual(['dashboard', 'whatsapp', 'inbox']);
    expect(latestLayout?.activeStep).toBe(1);
  });

  it('navigates directly to inbox when WhatsApp is connected without an agreement', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentPage: 'dashboard',
        selectedAgreement: null,
        whatsappStatus: 'connected',
        activeCampaign: null,
      })
    );

    render(<App />);

    const startButton = await screen.findByRole('button', { name: /começar/i });
    await userEvent.click(startButton);

    await waitFor(() => expect(screen.getByTestId('layout')).toHaveAttribute('data-current-page', 'inbox'));
    expect(await screen.findByTestId('inbox-page')).toBeInTheDocument();

    const latestLayout = getLatestLayoutCall();
    expect(latestLayout?.stages.map((stage) => stage.id)).toEqual(['dashboard', 'whatsapp', 'inbox']);
    expect(latestLayout?.activeStep).toBe(2);
  });

  it('restores agreements stage when an agreement is selected', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentPage: 'dashboard',
        selectedAgreement: { id: 'agreement-1', name: 'Mock Agreement' },
        whatsappStatus: 'disconnected',
        activeCampaign: null,
      })
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByTestId('layout-stages')).toHaveTextContent('dashboard,agreements,whatsapp,inbox')
    );

    const startButton = await screen.findByRole('button', { name: /começar/i });
    await userEvent.click(startButton);

    await waitFor(() => expect(screen.getByTestId('layout')).toHaveAttribute('data-current-page', 'whatsapp'));

    const latestLayout = getLatestLayoutCall();
    expect(latestLayout?.stages.map((stage) => stage.id)).toEqual([
      'dashboard',
      'agreements',
      'whatsapp',
      'inbox',
    ]);
    expect(latestLayout?.activeStep).toBe(2);
  });

  it('includes agreements stage when navigating manually to agreements', async () => {
    render(<App />);

    const goAgreements = await screen.findByTestId('navigate-agreements');
    await userEvent.click(goAgreements);

    await waitFor(() =>
      expect(screen.getByTestId('layout-stages')).toHaveTextContent('dashboard,agreements,whatsapp,inbox')
    );
    expect(await screen.findByTestId('agreements-page')).toBeInTheDocument();

    const latestLayout = getLatestLayoutCall();
    expect(latestLayout?.stages.map((stage) => stage.id)).toEqual([
      'dashboard',
      'agreements',
      'whatsapp',
      'inbox',
    ]);
    expect(latestLayout?.activeStep).toBe(1);
  });
});

describe('useAgreements hook', () => {
  beforeEach(() => {
    apiGetMock.mockImplementation(defaultApiGetImplementation);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('carrega convênios automaticamente e expõe estado carregado', async () => {
    const mockAgreements = [
      {
        id: 'agreement-1',
        name: 'Convênio Teste',
      },
    ];

    apiGetMock.mockResolvedValueOnce({ data: mockAgreements });

    const { result } = renderHook(() => useAgreements());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.agreements).toEqual(mockAgreements);
    expect(result.current.error).toBeNull();
    expect(apiGetMock).toHaveBeenCalledWith('/api/lead-engine/agreements');
  });

  it('permite tentar novamente após uma falha', async () => {
    const mockAgreements = [
      {
        id: 'agreement-2',
        name: 'Convênio Sucesso',
      },
    ];

    apiGetMock.mockRejectedValueOnce(new Error('Network error'));
    apiGetMock.mockResolvedValueOnce({ data: mockAgreements });

    const { result } = renderHook(() => useAgreements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.agreements).toEqual([]);

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.agreements).toEqual(mockAgreements);
    expect(apiGetMock).toHaveBeenCalledTimes(2);
  });
});

