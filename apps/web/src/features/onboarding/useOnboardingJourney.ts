import {
  createElement,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { apiGet } from '../../lib/api.js';
import { onAuthTokenChange, onTenantIdChange } from '../../lib/auth.js';
import { isWhatsAppDebugEnabled } from '../debug/featureFlags.js';
import { getRuntimeEnv } from '../../lib/runtime-env.js';
import { getFrontendFeatureFlags } from '@/lib/feature-flags.js';
import type { ChatCommandCenterContainerProps } from '../chat/containers/ChatCommandCenterContainer';
import { WhatsAppInstancesProvider } from '../whatsapp/hooks/useWhatsAppInstances.jsx';

type OnboardingPage =
  | 'dashboard'
  | 'agreements'
  | 'whatsapp'
  | 'inbox'
  | 'reports'
  | 'settings'
  | 'baileys-logs'
  | 'whatsapp-debug';

type JourneyStage = {
  id: 'dashboard' | 'agreements' | 'whatsapp' | 'inbox';
  label: string;
};

type CurrentUserLike = {
  id?: string | null;
  tenantId?: string | null;
  tenant?: { id?: string | null } | null;
  [key: string]: unknown;
};

type OnboardingAgreement = {
  id?: string | number | null;
  tenantId?: string | number | null;
  [key: string]: unknown;
};

const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  'dashboard',
  'agreements',
  'whatsapp',
  'inbox',
  'reports',
  'settings',
  'baileys-logs',
  'whatsapp-debug',
];

const Dashboard = lazy(() => import('../../components/Dashboard.jsx'));
const AgreementGrid = lazy(() => import('../../components/AgreementGrid.jsx'));
const WhatsAppConnect = lazy(() => import('../whatsapp/connect/index'));
const ChatCommandCenter = lazy<ComponentType<ChatCommandCenterContainerProps>>(() =>
  import('../chat/containers/ChatCommandCenterContainer.js')
);
const Reports = lazy(() => import('../../components/Reports.jsx'));
const Settings = lazy(() => import('../../components/Settings.jsx'));
const BaileysLogs = lazy(() => import('../debug/BaileysLogs.jsx'));
const WhatsAppDebugLazy = lazy(() => import('../debug/WhatsAppDebug.jsx'));

const WHATSAPP_DEBUG_ENABLED = isWhatsAppDebugEnabled();

const frontendFeatureFlags = getFrontendFeatureFlags(getRuntimeEnv());
const shouldEnableWhatsappDebug = frontendFeatureFlags.whatsappDebug;

const STORAGE_KEY = 'leadengine_onboarding_v1';

const journeyStages: JourneyStage[] = [
  { id: 'dashboard', label: 'Visão Geral' },
  { id: 'agreements', label: 'Convênios' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'inbox', label: 'Inbox' },
];

export function useOnboardingJourney() {
  const [currentPage, setCurrentPage] = useState<OnboardingPage>('dashboard');
  const [selectedAgreement, setSelectedAgreement] = useState<OnboardingAgreement | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string>('disconnected');
  const [activeCampaign, setActiveCampaign] = useState<Record<string, unknown> | null>(null);
  const [me, setMe] = useState<CurrentUserLike | null>(null);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState<boolean>(true);

  const safeCurrentPage = useMemo<OnboardingPage>(() => {
    if (!WHATSAPP_DEBUG_ENABLED && !shouldEnableWhatsappDebug && currentPage === 'whatsapp-debug') {
      return 'dashboard';
    }
    return currentPage;
  }, [currentPage, shouldEnableWhatsappDebug]);

  const loadCurrentUser = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingCurrentUser(true);

      try {
        const payload = await apiGet<{ data?: CurrentUserLike | null }>('/api/auth/me', { signal });

        if (signal?.aborted) {
          return;
        }

        setMe(payload?.data ?? null);
      } catch (error: any) {
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
      const restoredPage = persisted.currentPage || 'dashboard';
      if (!WHATSAPP_DEBUG_ENABLED && restoredPage === 'whatsapp-debug') {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage(restoredPage);
      }
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

  useEffect(() => {
    const handleExternalNavigation = (event: Event) => {
      const { detail } = event as CustomEvent<string>;
      const targetPage = typeof detail === 'string' ? detail : null;
      if (!targetPage) {
        return;
      }

      if (targetPage === 'contacts') {
        return;
      }

      if (!ONBOARDING_PAGES.includes(targetPage as OnboardingPage)) {
        return;
      }

      setCurrentPage(targetPage as OnboardingPage);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('leadengine:navigate', handleExternalNavigation);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('leadengine:navigate', handleExternalNavigation);
      }
    };
  }, []);

  const onboardingStages = useMemo<JourneyStage[]>(() => {
    if (selectedAgreement || currentPage === 'agreements') {
      return journeyStages;
    }

    return journeyStages.filter((stage) => stage.id !== 'agreements');
  }, [currentPage, selectedAgreement]);

  const activeStep = useMemo<number>(() => {
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
      unsubscribeToken?.();
      unsubscribeTenant?.();
    };
  }, [loadCurrentUser]);

  const currentUser = useMemo<CurrentUserLike | null>(() => {
    if (!me?.id) {
      return null;
    }

    const tenantId = (me.tenantId ?? me.tenant?.id ?? null) as string | null;

    return {
      ...me,
      tenantId,
    };
  }, [me]);

  const computeNextSetupPage = useCallback((): OnboardingPage => {
    if (whatsappStatus === 'connected') {
      return 'inbox';
    }

    return 'whatsapp';
  }, [whatsappStatus]);

  const handleNavigate = useCallback(
    (nextPage: OnboardingPage) => {
      if (nextPage === 'whatsapp-debug' && !WHATSAPP_DEBUG_ENABLED && !shouldEnableWhatsappDebug) {
        return;
      }

      setCurrentPage(nextPage);
    },
    [shouldEnableWhatsappDebug]
  );

  const renderPage = useCallback((): ReactNode => {
    switch (safeCurrentPage) {
      case 'dashboard':
        return createElement(Dashboard, {
          onboarding: {
            stages: onboardingStages,
            activeStep,
            selectedAgreement,
            whatsappStatus,
            activeCampaign,
          },
          onStart: () => setCurrentPage(computeNextSetupPage()),
        });
      case 'agreements':
        return createElement(AgreementGrid, {
          onboarding: {
            stages: onboardingStages,
            activeStep,
            selectedAgreement,
            whatsappStatus,
            activeCampaign,
          },
          selectedAgreement,
          onSelect: (agreement: OnboardingAgreement) => {
            setSelectedAgreement(agreement);
            setActiveCampaign(null);
            setCurrentPage('whatsapp');
          },
        });
      case 'whatsapp': {
        const providerProps = {
          key:
            selectedAgreement?.id !== undefined && selectedAgreement?.id !== null
              ? String(selectedAgreement.id)
              : 'default-whatsapp-provider',
          tenantId:
            selectedAgreement?.tenantId !== undefined && selectedAgreement?.tenantId !== null
              ? String(selectedAgreement.tenantId)
              : null,
          agreementId:
            selectedAgreement?.id !== undefined && selectedAgreement?.id !== null
              ? String(selectedAgreement.id)
              : null,
          autoRefresh: true,
          initialFetch: true,
          pauseWhenHidden: false,
        };

        return createElement(
          WhatsAppInstancesProvider,
          providerProps,
          createElement(WhatsAppConnect, {
            selectedAgreement,
            status: whatsappStatus,
            activeCampaign,
            onboarding: {
              stages: onboardingStages,
              activeStep,
            },
            onStatusChange: setWhatsappStatus,
            onCampaignReady: setActiveCampaign,
            onContinue: () => setCurrentPage('inbox'),
            onBack: () => setCurrentPage('agreements'),
          }),
        );
      }
      case 'inbox':
        if (loadingCurrentUser) {
          return createElement(
            'div',
            { className: 'flex h-full items-center justify-center text-sm text-muted-foreground' },
            'Carregando operador autenticado…'
          );
        }

        if (!currentUser) {
          return createElement(
            'div',
            {
              className:
                'flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground',
            },
            createElement('p', null, 'Para acessar a Inbox, entre com sua conta novamente.'),
            createElement(
              'p',
              { className: 'text-xs text-muted-foreground/80' },
              'A sessão atual expirou ou não foi possível identificar o operador.'
            )
          );
        }

        return createElement(ChatCommandCenter, { currentUser });
      case 'reports':
        return createElement(Reports, null);
      case 'settings':
        return createElement(Settings, null);
      case 'baileys-logs':
        return createElement(BaileysLogs, null);
      case 'whatsapp-debug':
        if (shouldEnableWhatsappDebug || WHATSAPP_DEBUG_ENABLED) {
          return createElement(WhatsAppDebugLazy, null);
        }
        return createElement(Dashboard, null);
      default:
        return createElement(Dashboard, null);
    }
  }, [
    safeCurrentPage,
    onboardingStages,
    activeStep,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    loadingCurrentUser,
    currentUser,
    computeNextSetupPage,
    shouldEnableWhatsappDebug,
  ]);

  return {
    currentPage,
    safeCurrentPage,
    onboardingStages,
    activeStep,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    currentUser,
    loadingCurrentUser,
    handleNavigate,
    computeNextSetupPage,
    renderPage,
    onboarding: {
      stages: onboardingStages,
      activeStep,
      selectedAgreement,
      whatsappStatus,
      activeCampaign,
    },
  };
}

export default useOnboardingJourney;
