import { createElement, lazy, useCallback, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { isWhatsAppDebugEnabled } from '../debug/featureFlags.js';
import { getRuntimeEnv } from '../../lib/runtime-env.js';
import { getFrontendFeatureFlags } from '@/lib/feature-flags.js';
import type { ChatCommandCenterContainerProps } from '../chat/containers/ChatCommandCenterContainer';
import { WhatsAppInstancesProvider } from '../whatsapp/hooks/useWhatsAppInstances.jsx';
import AcceptInviteStep, { type InviteDetails } from './components/AcceptInviteStep.tsx';
import TeamSetupStep, { type TeamSetupResult } from './components/TeamSetupStep.tsx';
import OnboardingCompleteStep from './components/OnboardingCompleteStep.tsx';
import {
  STORAGE_KEY,
  normalizeOnboardingPage,
  useOnboardingState,
  type ActiveCampaign,
  type OnboardingAgreement,
  type OnboardingPage,
  type StoredOnboardingPage,
} from './useOnboardingState.js';
import { useOnboardingNavigationEvents } from './useOnboardingNavigationEvents.js';

type JourneyStage = {
  id: OnboardingPage;
  label: string;
};

type CurrentUserLike = {
  id?: string | null;
  tenantId?: string | null;
  tenant?: { id?: string | null } | null;
  [key: string]: unknown;
};

type OnboardingJourneyKind = 'app' | 'invite';

const ONBOARDING_PAGES: readonly StoredOnboardingPage[] = [
  'dashboard',
  'channels',
  'campaigns',
  'agreements',
  'inbox',
  'reports',
  'settings',
  'baileys-logs',
  'whatsapp-debug',
  'whatsapp',
  'accept-invite',
  'team',
  'complete',
];

const Dashboard = lazy(() => import('../../components/Dashboard.jsx'));
const AgreementGrid = lazy(() => import('../../components/AgreementGrid.jsx'));
const WhatsAppConnect = lazy(() => import('../whatsapp/connect/index'));
const WhatsAppCampaigns = lazy(() => import('../whatsapp/campaigns/index'));
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

const APP_JOURNEY_STAGES: JourneyStage[] = [
  { id: 'channels', label: 'Instâncias & Canais' },
  { id: 'campaigns', label: 'Campanhas' },
  { id: 'inbox', label: 'Inbox' },
];

const INVITE_JOURNEY_STAGES: JourneyStage[] = [
  { id: 'accept-invite', label: 'Validar convite' },
  { id: 'team', label: 'Equipe & Operador' },
  { id: 'channels', label: 'Conectar WhatsApp' },
];

const readInviteTokenFromLocation = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('token') ?? url.searchParams.get('invite');
  } catch {
    return null;
  }
};

type UseOnboardingJourneyOptions = {
  initialPage?: StoredOnboardingPage | null;
  currentUser?: CurrentUserLike | null;
  loadingCurrentUser?: boolean;
  journeyKind?: OnboardingJourneyKind;
  initialInviteToken?: string | null;
};

export function useOnboardingJourney(options?: UseOnboardingJourneyOptions) {
  const journeyKind: OnboardingJourneyKind = options?.journeyKind ?? 'app';
  const defaultPage: OnboardingPage = journeyKind === 'invite' ? 'accept-invite' : 'dashboard';
  const providedCurrentUser = options?.currentUser ?? null;
  const loadingCurrentUser = Boolean(options?.loadingCurrentUser);
  const storageKey = journeyKind === 'invite' ? `${STORAGE_KEY}_invite` : STORAGE_KEY;

  const debugDisabled = !WHATSAPP_DEBUG_ENABLED && !shouldEnableWhatsappDebug;
  const shouldRestorePage = journeyKind === 'invite' || options?.initialPage == null;
  const initialInviteTokenRef = useRef<string | null>(options?.initialInviteToken ?? readInviteTokenFromLocation());

  const {
    currentPage,
    safeCurrentPage,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    inviteDetails,
    teamSetupResult,
    initialInviteToken,
    setCurrentPage,
    setSelectedAgreement,
    setWhatsappStatus,
    setActiveCampaign,
    setInviteDetails,
    setTeamSetupResult,
    setInitialInviteToken,
  } = useOnboardingState({
    initialPage: options?.initialPage ?? null,
    defaultPage,
    storageKey,
    debugDisabled,
    shouldRestorePage,
    initialInviteToken: initialInviteTokenRef.current,
  });

  const handleExternalNavigation = useCallback(
    (targetPage: string) => {
      if (targetPage === 'contacts') {
        return;
      }

      if (!ONBOARDING_PAGES.includes(targetPage as StoredOnboardingPage)) {
        return;
      }

      const normalizedTarget = normalizeOnboardingPage(targetPage as StoredOnboardingPage);
      if (normalizedTarget === 'whatsapp-debug' && debugDisabled) {
        return;
      }

      setCurrentPage(normalizedTarget);
    },
    [debugDisabled, setCurrentPage]
  );

  useOnboardingNavigationEvents({ onNavigate: handleExternalNavigation });

  const onboardingStages = useMemo<JourneyStage[]>(
    () => (journeyKind === 'invite' ? [...INVITE_JOURNEY_STAGES] : [...APP_JOURNEY_STAGES]),
    [journeyKind]
  );

  const activeStep = useMemo<number>(() => {
    const stageIndex = onboardingStages.findIndex((stage) => stage.id === safeCurrentPage);
    if (stageIndex === -1) {
      return journeyKind === 'invite' && safeCurrentPage === 'complete' ? onboardingStages.length - 1 : 0;
    }
    return stageIndex;
  }, [journeyKind, onboardingStages, safeCurrentPage]);

  const currentUser = useMemo<CurrentUserLike | null>(() => {
    if (!providedCurrentUser?.id) {
      return null;
    }

    const tenantId = (providedCurrentUser.tenantId ?? providedCurrentUser.tenant?.id ?? null) as string | null;

    return {
      ...providedCurrentUser,
      tenantId,
    };
  }, [providedCurrentUser]);

  const computeNextSetupPage = useCallback((): OnboardingPage => {
    if (journeyKind === 'invite') {
      if (!inviteDetails) {
        return 'accept-invite';
      }
      if (!teamSetupResult) {
        return 'team';
      }
      return whatsappStatus === 'connected' ? 'complete' : 'channels';
    }

    if (whatsappStatus === 'connected') {
      return activeCampaign ? 'inbox' : 'campaigns';
    }

    return 'channels';
  }, [activeCampaign, inviteDetails, journeyKind, teamSetupResult, whatsappStatus]);

  const handleNavigate = useCallback(
    (nextPage: StoredOnboardingPage) => {
      const normalizedPage = normalizeOnboardingPage(nextPage);

      if (normalizedPage === 'whatsapp-debug' && debugDisabled) {
        return;
      }

      setCurrentPage(normalizedPage);
    },
    [debugDisabled]
  );

  const page = useMemo<ReactNode>(() => {
    const resolvedTenantId =
      selectedAgreement?.tenantId !== undefined && selectedAgreement?.tenantId !== null
        ? String(selectedAgreement.tenantId)
        : teamSetupResult?.tenant?.id ?? null;

    const providerProps = {
      key:
        selectedAgreement?.id !== undefined && selectedAgreement?.id !== null
          ? String(selectedAgreement.id)
          : resolvedTenantId ?? 'default-whatsapp-provider',
      tenantId: resolvedTenantId,
      agreementId:
        selectedAgreement?.id !== undefined && selectedAgreement?.id !== null
          ? String(selectedAgreement.id)
          : null,
      autoRefresh: true,
      initialFetch: true,
      pauseWhenHidden: false,
    };

    if (journeyKind === 'invite') {
      switch (safeCurrentPage) {
        case 'team':
          if (!inviteDetails) {
            return createElement(AcceptInviteStep, {
              invite: null,
              onboarding: { stages: onboardingStages, activeStep },
              initialToken: initialInviteToken,
              onInviteValidated: (details: InviteDetails) => {
                setInviteDetails(details);
                setTeamSetupResult(null);
                setInitialInviteToken(details.token);
                setCurrentPage('team');
              },
              onContinue: () => setCurrentPage('team'),
            });
          }
          return createElement(TeamSetupStep, {
            invite: inviteDetails,
            onboarding: { stages: onboardingStages, activeStep },
            onBack: () => {
              setTeamSetupResult(null);
              setCurrentPage('accept-invite');
            },
            onProvisioned: (result: TeamSetupResult) => {
              setTeamSetupResult(result);
            },
            onContinue: () => setCurrentPage('channels'),
          });
        case 'channels':
        case 'whatsapp':
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
              onContinue: () => setCurrentPage('complete'),
              onBack: () => setCurrentPage('team'),
            }),
          );
        case 'complete':
          return createElement(OnboardingCompleteStep, {
            result: teamSetupResult,
            onboarding: { stages: onboardingStages, activeStep },
            onRestart: () => {
              setInviteDetails(null);
              setTeamSetupResult(null);
              setSelectedAgreement(null);
              setActiveCampaign(null);
              setWhatsappStatus('disconnected');
              setInitialInviteToken(null);
              setCurrentPage('accept-invite');
            },
          });
        case 'accept-invite':
        default:
          return createElement(AcceptInviteStep, {
            invite: inviteDetails,
            onboarding: { stages: onboardingStages, activeStep },
            initialToken: initialInviteToken,
            onInviteValidated: (details: InviteDetails) => {
              setInviteDetails(details);
              setTeamSetupResult(null);
              setInitialInviteToken(details.token);
              setCurrentPage('team');
            },
            onContinue: () => setCurrentPage('team'),
          });
      }
    }

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
            setCurrentPage('channels');
          },
        });
      case 'channels':
      case 'whatsapp':
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
            onContinue: () => setCurrentPage('campaigns'),
            onBack: () => setCurrentPage('agreements'),
          }),
        );
      case 'campaigns':
        return createElement(
          WhatsAppInstancesProvider,
          providerProps,
          createElement(WhatsAppCampaigns, {
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
            onBack: () => setCurrentPage('channels'),
          }),
        );
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
    journeyKind,
    inviteDetails,
    initialInviteToken,
    teamSetupResult,
    setCurrentPage,
    setInviteDetails,
    setTeamSetupResult,
    setSelectedAgreement,
    setActiveCampaign,
    setWhatsappStatus,
    setInitialInviteToken,
  ]);

  return {
    currentPage,
    safeCurrentPage,
    onboardingStages,
    activeStep,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    inviteDetails,
    teamSetupResult,
    journeyKind,
    currentUser,
    loadingCurrentUser,
    handleNavigate,
    computeNextSetupPage,
    page,
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
