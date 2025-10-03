import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import UnderConstruction from './components/UnderConstruction.jsx';
import './App.css';

const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const AgreementGrid = lazy(() => import('./components/AgreementGrid.jsx'));
const WhatsAppConnect = lazy(() => import('./features/whatsapp/WhatsAppConnect.jsx'));
const ChatCommandCenter = lazy(() => import('./features/chat/ChatCommandCenter.jsx'));
const Reports = lazy(() => import('./components/Reports.jsx'));
const Settings = lazy(() => import('./components/Settings.jsx'));

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

  const activeStep = useMemo(() => {
    const stageIndex = journeyStages.findIndex((stage) => stage.id === currentPage);
    return stageIndex === -1 ? 0 : stageIndex;
  }, [currentPage]);

  const computeNextSetupPage = () => {
    if (!selectedAgreement) {
      return 'agreements';
    }

    if (whatsappStatus !== 'connected' || !activeCampaign) {
      return 'whatsapp';
    }

    return 'inbox';
  };

  const activeUser = useMemo(
    () => ({
      id: 'agent-mvp',
      name: 'Agente MVP',
    }),
    []
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onboarding={{
              stages: journeyStages,
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
              stages: journeyStages,
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
              stages: journeyStages,
              activeStep,
            }}
            onStatusChange={setWhatsappStatus}
            onCampaignReady={setActiveCampaign}
            onContinue={() => setCurrentPage('inbox')}
            onBack={() => setCurrentPage('agreements')}
          />
        );
      case 'inbox':
        return <ChatCommandCenter currentUser={activeUser} />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      onboarding={{
        stages: journeyStages,
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
