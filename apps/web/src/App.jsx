import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import './App.css';
import { apiGet } from './lib/api.js';
import { onAuthTokenChange, onTenantIdChange } from './lib/auth.js';

const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const AgreementGrid = lazy(() => import('./components/AgreementGrid.jsx'));
const WhatsAppConnect = lazy(() => import('./features/whatsapp/WhatsAppConnect.jsx'));
const ChatCommandCenter = lazy(() => import('./features/chat/ChatCommandCenter.jsx'));
const Reports = lazy(() => import('./components/Reports.jsx'));
const Settings = lazy(() => import('./components/Settings.jsx'));
const BaileysLogs = lazy(() => import('./features/debug/BaileysLogs.jsx'));

const STORAGE_KEY = 'leadengine_onboarding_v1';

const journeyStages = [
  { id: 'dashboard', label: 'Visão Geral' },
  { id: 'agreements', label: 'Convênios' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'inbox', label: 'Inbox' },
];

const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
    Carregando módulo...
  </div>
);

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [me, setMe] = useState(null);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true);

  const loadCurrentUser = useCallback(
    async (signal) => {
      setLoadingCurrentUser(true);

      try {
        const payload = await apiGet('/api/auth/me', { signal });

        if (signal?.aborted) {
          return;
        }

        setMe(payload?.data ?? null);
      } catch (error) {
        if (error?.name === 'AbortError' || signal?.aborted) {
          return;
        }

        if (error?.status === 401) {
          setMe(null);
          return;
        }

        console.warn('Failed to load current user from API', error);
        setMe(null);
      } finally {
        if (!signal?.aborted) {
          setLoadingCurrentUser(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const persisted = JSON.parse(raw);
      setCurrentPage(persisted.currentPage || 'dashboard');
      setSelectedAgreement(persisted.selectedAgreement || null);
      setWhatsappStatus(persisted.whatsappStatus || 'disconnected');
      setActiveCampaign(persisted.activeCampaign || null);
    } catch (error) {
      console.warn('Failed to restore onboarding state', error);
    }
  }, []);

  useEffect(() => {
    const payload = {
      currentPage,
      selectedAgreement,
      whatsappStatus,
      activeCampaign,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist onboarding state', error);
    }
  }, [currentPage, selectedAgreement, whatsappStatus, activeCampaign]);

  const onboardingStages = useMemo(() => {
    if (selectedAgreement || currentPage === 'agreements') {
      return journeyStages;
    }

    return journeyStages.filter((stage) => stage.id !== 'agreements');
  }, [currentPage, selectedAgreement]);

  const activeStep = useMemo(() => {
    const stageIndex = onboardingStages.findIndex((stage) => stage.id === currentPage);
    return stageIndex === -1 ? 0 : stageIndex;
  }, [currentPage, onboardingStages]);

  useEffect(() => {
    let abortController = new AbortController();

    const run = () => {
      loadCurrentUser(abortController.signal);
    };

    run();

    const unsubscribeToken = onAuthTokenChange(() => {
      abortController.abort();
      abortController = new AbortController();
      run();
    });

    const unsubscribeTenant = onTenantIdChange(() => {
      abortController.abort();
      abortController = new AbortController();
      run();
    });

    return () => {
      abortController.abort();
      unsubscribeToken();
      unsubscribeTenant();
    };
  }, [loadCurrentUser]);

  const currentUser = useMemo(() => {
    if (!me?.id) {
      return null;
    }

    const tenantId = me.tenantId ?? me.tenant?.id ?? null;

    return {
      ...me,
      tenantId,
    };
  }, [me]);

  const computeNextSetupPage = () => {
    if (whatsappStatus === 'connected') {
      return 'inbox';
    }

    return 'whatsapp';
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onboarding={{
              stages: onboardingStages,
              activeStep,
              selectedAgreement,
              whatsappStatus,
              activeCampaign,
            }}
            onStart={() => setCurrentPage(computeNextSetupPage())}
          />
        );
      case 'agreements':
        return (
          <AgreementGrid
            onboarding={{
              stages: onboardingStages,
              activeStep,
              selectedAgreement,
              whatsappStatus,
              activeCampaign,
            }}
            selectedAgreement={selectedAgreement}
            onSelect={(agreement) => {
              setSelectedAgreement(agreement);
              setActiveCampaign(null);
              setCurrentPage('whatsapp');
            }}
          />
        );
      case 'whatsapp':
        return (
          <WhatsAppConnect
            selectedAgreement={selectedAgreement}
            status={whatsappStatus}
            activeCampaign={activeCampaign}
            onboarding={{
              stages: onboardingStages,
              activeStep,
            }}
            onStatusChange={setWhatsappStatus}
            onCampaignReady={setActiveCampaign}
            onContinue={() => setCurrentPage('inbox')}
            onBack={() => setCurrentPage('agreements')}
          />
        );
      case 'inbox':
        if (loadingCurrentUser) {
          return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Carregando operador autenticado…
            </div>
          );
        }

        if (!currentUser) {
          return (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>Para acessar a Inbox, entre com sua conta novamente.</p>
              <p className="text-xs text-muted-foreground/80">
                A sessão atual expirou ou não foi possível identificar o operador.
              </p>
            </div>
          );
        }

        return <ChatCommandCenter currentUser={currentUser} />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'baileys-logs':
        return <BaileysLogs />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      onboarding={{
        stages: onboardingStages,
        activeStep,
        selectedAgreement,
        whatsappStatus,
        activeCampaign,
      }}
    >
      <Suspense fallback={<PageFallback />}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
}

export default App;
