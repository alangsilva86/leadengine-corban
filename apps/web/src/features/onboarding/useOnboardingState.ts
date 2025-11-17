import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { InviteDetails } from './components/AcceptInviteStep.tsx';
import type { TeamSetupResult } from './components/TeamSetupStep.tsx';

export type OnboardingPage =
  | 'dashboard'
  | 'channels'
  | 'campaigns'
  | 'agreements'
  | 'inbox'
  | 'reports'
  | 'settings'
  | 'baileys-logs'
  | 'whatsapp-debug'
  | 'accept-invite'
  | 'team'
  | 'complete';

export type StoredOnboardingPage = OnboardingPage | 'whatsapp';

export type OnboardingAgreement = {
  id?: string | number | null;
  tenantId?: string | number | null;
  [key: string]: unknown;
};

export type ActiveCampaign = Record<string, unknown> | null;

export const STORAGE_KEY = 'leadengine_onboarding_v1';

export type UseOnboardingStateOptions = {
  initialPage?: StoredOnboardingPage | null;
  defaultPage: OnboardingPage;
  storageKey: string;
  debugDisabled: boolean;
  shouldRestorePage: boolean;
  initialInviteToken?: string | null;
};

export type UseOnboardingStateResult = {
  currentPage: OnboardingPage;
  safeCurrentPage: OnboardingPage;
  selectedAgreement: OnboardingAgreement | null;
  whatsappStatus: string;
  activeCampaign: ActiveCampaign;
  inviteDetails: InviteDetails | null;
  teamSetupResult: TeamSetupResult | null;
  initialInviteToken: string | null;
  setCurrentPage: Dispatch<SetStateAction<OnboardingPage>>;
  setSelectedAgreement: Dispatch<SetStateAction<OnboardingAgreement | null>>;
  setWhatsappStatus: Dispatch<SetStateAction<string>>;
  setActiveCampaign: Dispatch<SetStateAction<ActiveCampaign>>;
  setInviteDetails: Dispatch<SetStateAction<InviteDetails | null>>;
  setTeamSetupResult: Dispatch<SetStateAction<TeamSetupResult | null>>;
  setInitialInviteToken: Dispatch<SetStateAction<string | null>>;
};

export const normalizeOnboardingPage = (
  page?: StoredOnboardingPage | null,
  fallback: OnboardingPage = 'dashboard'
): OnboardingPage => {
  if (!page) {
    return fallback;
  }

  if (page === 'whatsapp') {
    return 'channels';
  }

  return page as OnboardingPage;
};

export function useOnboardingState(options: UseOnboardingStateOptions): UseOnboardingStateResult {
  const {
    initialPage,
    defaultPage,
    storageKey,
    debugDisabled,
    shouldRestorePage,
    initialInviteToken,
  } = options;

  const normalizedInitialPage = normalizeOnboardingPage(initialPage ?? null, defaultPage);
  const [currentPage, setCurrentPage] = useState<OnboardingPage>(normalizedInitialPage);
  const [selectedAgreement, setSelectedAgreement] = useState<OnboardingAgreement | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string>('disconnected');
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [teamSetupResult, setTeamSetupResult] = useState<TeamSetupResult | null>(null);
  const [initialInviteTokenState, setInitialInviteToken] = useState<string | null>(initialInviteToken ?? null);

  const safeCurrentPage = useMemo<OnboardingPage>(() => {
    if (debugDisabled && currentPage === 'whatsapp-debug') {
      return 'dashboard';
    }
    return currentPage;
  }, [currentPage, debugDisabled]);

  useEffect(() => {
    try {
      const raw = typeof window === 'undefined' ? null : localStorage.getItem(storageKey);
      if (!raw) return;
      const persisted = JSON.parse(raw);
      const restoredPage = normalizeOnboardingPage(persisted.currentPage as StoredOnboardingPage | null, defaultPage);
      const safeRestoredPage = debugDisabled && restoredPage === 'whatsapp-debug' ? 'dashboard' : restoredPage;

      if (shouldRestorePage) {
        setCurrentPage(safeRestoredPage);
      } else if (debugDisabled) {
        setCurrentPage((prev) => (prev === 'whatsapp-debug' ? 'dashboard' : prev));
      }

      setSelectedAgreement(persisted.selectedAgreement || null);
      setWhatsappStatus(persisted.whatsappStatus || 'disconnected');
      setActiveCampaign(persisted.activeCampaign || null);
      setInviteDetails(persisted.inviteDetails || null);
      setTeamSetupResult(persisted.teamSetupResult || null);
      setInitialInviteToken(persisted.initialInviteToken || null);
    } catch (error) {
      console.warn('Failed to restore onboarding state', error);
    }
  }, [debugDisabled, shouldRestorePage, storageKey, defaultPage]);

  useEffect(() => {
    const payload = {
      currentPage: safeCurrentPage,
      selectedAgreement,
      whatsappStatus,
      activeCampaign,
      inviteDetails,
      teamSetupResult,
      initialInviteToken: initialInviteTokenState,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist onboarding state', error);
    }
  }, [
    safeCurrentPage,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    inviteDetails,
    teamSetupResult,
    initialInviteTokenState,
    storageKey,
  ]);

  return {
    currentPage,
    safeCurrentPage,
    selectedAgreement,
    whatsappStatus,
    activeCampaign,
    inviteDetails,
    teamSetupResult,
    initialInviteToken: initialInviteTokenState,
    setCurrentPage,
    setSelectedAgreement,
    setWhatsappStatus,
    setActiveCampaign,
    setInviteDetails,
    setTeamSetupResult,
    setInitialInviteToken,
  };
}

export default useOnboardingState;
