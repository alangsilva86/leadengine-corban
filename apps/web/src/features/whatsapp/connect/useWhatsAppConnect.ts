import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { toast } from 'sonner';

import usePlayfulLogger from '../../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../../onboarding/useOnboardingStepLabel.js';
import { getStatusInfo, resolveInstancePhone } from '../lib/instances';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import useCampaignWorkflow from './useCampaignWorkflow';
import useSessionUiState from './useSessionUiState';
import useTenantInstances from './useTenantInstances';
import { STATUS_COPY } from './hooks/useWhatsappSessionState';
import { createInstanceSchema } from './schemas';
import { buildInstanceViewModels, isInstanceConnected, resolveInstanceId } from './utils/instances';
import { readShowAllPreference } from './utils/preferences';

type Nullable<T> = T | null;

const SURFACE_COLOR_UTILS = {
  instancesPanel: 'border border-border/60 bg-surface-overlay-strong',
  qrInstructionsPanel: 'border border-border/60 bg-surface-overlay-quiet',
  glassTile: 'border border-surface-overlay-glass-border bg-surface-overlay-glass',
  glassTileDashed: 'border border-dashed border-surface-overlay-glass-border bg-surface-overlay-glass',
  glassTileActive: 'border-primary/60 bg-primary/10 ring-1 ring-primary/40 shadow-sm',
  glassTileIdle: 'border-surface-overlay-glass-border bg-surface-overlay-glass hover:border-primary/30',
  destructiveBanner: 'border border-destructive/40 bg-destructive/10 text-destructive',
  qrIllustration: 'border-surface-overlay-glass-border bg-surface-overlay-glass text-primary shadow-inner',
  progressTrack: 'bg-surface-overlay-glass',
  progressIndicator: 'bg-primary',
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Total de mensagens reportadas com o código 1 pelo broker.' },
  { code: '2', label: '2', description: 'Total de mensagens reportadas com o código 2 pelo broker.' },
  { code: '3', label: '3', description: 'Total de mensagens reportadas com o código 3 pelo broker.' },
  { code: '4', label: '4', description: 'Total de mensagens reportadas com o código 4 pelo broker.' },
  { code: '5', label: '5', description: 'Total de mensagens reportadas com o código 5 pelo broker.' },
];

export interface ErrorState {
  code: string | null;
  title: string | null;
  message: string;
}

export interface CampaignActionState {
  id: string | null;
  type: string | null;
}

export interface WhatsAppInstanceViewModel {
  key: string;
  id: string | null;
  displayName: string;
  phoneLabel: string;
  formattedPhone: string;
  addressLabel: string | null;
  statusInfo: ReturnType<typeof getStatusInfo>;
  metrics: ReturnType<typeof getInstanceMetrics>;
  statusValues: ReturnType<typeof getInstanceMetrics>['status'];
  rateUsage: ReturnType<typeof getInstanceMetrics>['rateUsage'];
  ratePercentage: number;
  lastUpdatedLabel: string;
  user: string | null;
  instance: any;
  isCurrent: boolean;
}

export interface WhatsAppConnectState {
  showAllInstances: boolean;
  qrPanelOpen: boolean;
  isQrDialogOpen: boolean;
  pairingPhoneInput: string;
  pairingPhoneError: string | null;
  requestingPairingCode: boolean;
  errorState: ErrorState | null;
  campaign: Nullable<any>;
  campaigns: any[];
  campaignsLoading: boolean;
  campaignError: string | null;
  campaignAction: CampaignActionState | null;
  instancePendingDelete: Nullable<any>;
  isCreateInstanceOpen: boolean;
  isCreateCampaignOpen: boolean;
  expandedInstanceId: string | null;
  pendingReassign: Nullable<any>;
  reassignIntent: 'reassign' | 'disconnect';
  persistentWarning: string | null;
}

export type WhatsAppConnectAction =
  | { type: 'set-show-all-instances'; value: boolean }
  | { type: 'set-qr-panel-open'; value: boolean }
  | { type: 'set-qr-dialog-open'; value: boolean }
  | { type: 'set-pairing-phone-input'; value: string }
  | { type: 'set-pairing-phone-error'; value: string | null }
  | { type: 'set-requesting-pairing'; value: boolean }
  | { type: 'set-error-state'; value: ErrorState | null }
  | { type: 'set-campaign'; value: Nullable<any> }
  | { type: 'set-campaigns'; value: any[] }
  | { type: 'set-campaigns-loading'; value: boolean }
  | { type: 'set-campaign-error'; value: string | null }
  | { type: 'set-campaign-action'; value: CampaignActionState | null }
  | { type: 'set-instance-pending-delete'; value: Nullable<any> }
  | { type: 'set-create-instance-open'; value: boolean }
  | { type: 'set-create-campaign-open'; value: boolean }
  | { type: 'set-expanded-instance-id'; value: string | null }
  | { type: 'set-pending-reassign'; value: Nullable<any> }
  | { type: 'set-reassign-intent'; value: 'reassign' | 'disconnect' }
  | { type: 'set-persistent-warning'; value: string | null };

const reducer = (state: WhatsAppConnectState, action: WhatsAppConnectAction): WhatsAppConnectState => {
  switch (action.type) {
    case 'set-show-all-instances':
      return { ...state, showAllInstances: action.value };
    case 'set-qr-panel-open':
      if (state.qrPanelOpen === action.value) {
        return state;
      }
      return { ...state, qrPanelOpen: action.value };
    case 'set-qr-dialog-open':
      return { ...state, isQrDialogOpen: action.value };
    case 'set-pairing-phone-input':
      return { ...state, pairingPhoneInput: action.value };
    case 'set-pairing-phone-error':
      return { ...state, pairingPhoneError: action.value };
    case 'set-requesting-pairing':
      return { ...state, requestingPairingCode: action.value };
    case 'set-error-state':
      return { ...state, errorState: action.value };
    case 'set-campaign':
      return { ...state, campaign: action.value };
    case 'set-campaigns':
      return { ...state, campaigns: action.value };
    case 'set-campaigns-loading':
      return { ...state, campaignsLoading: action.value };
    case 'set-campaign-error':
      return { ...state, campaignError: action.value };
    case 'set-campaign-action':
      return { ...state, campaignAction: action.value };
    case 'set-instance-pending-delete':
      return { ...state, instancePendingDelete: action.value };
    case 'set-create-instance-open':
      return { ...state, isCreateInstanceOpen: action.value };
    case 'set-create-campaign-open':
      return { ...state, isCreateCampaignOpen: action.value };
    case 'set-expanded-instance-id':
      return { ...state, expandedInstanceId: action.value };
    case 'set-pending-reassign':
      return { ...state, pendingReassign: action.value };
    case 'set-reassign-intent':
      return { ...state, reassignIntent: action.value };
    case 'set-persistent-warning':
      return { ...state, persistentWarning: action.value };
    default:
      return state;
  }
};


export interface UseWhatsAppConnectParams {
  selectedAgreement: any;
  status?: string;
  activeCampaign?: any;
  onboarding?: any;
  onStatusChange?: (status: string) => void;
  onCampaignReady?: (campaign: any | null) => void;
  onBack?: () => void;
  onContinue?: () => void;
}

const readShowAllPreference = () => {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('wa_show_all_instances') === '1';
  } catch {
    return false;
  }
};

const persistShowAllPreference = (value: boolean) => {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('wa_show_all_instances', value ? '1' : '0');
  } catch {
    // ignore storage issues
  }
};

const initialState = (status: string | undefined, activeCampaign: any | undefined): WhatsAppConnectState => ({
  showAllInstances: readShowAllPreference(),
  qrPanelOpen: status !== 'connected',
  isQrDialogOpen: false,
  pairingPhoneInput: '',
  pairingPhoneError: null,
  requestingPairingCode: false,
  errorState: null,
  campaign: activeCampaign ?? null,
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
});

const useWhatsAppConnect = ({
  selectedAgreement,
  status = 'disconnected',
  activeCampaign,
  onboarding,
  onStatusChange,
  onCampaignReady,
  onBack,
  onContinue,
}: UseWhatsAppConnectParams) => {
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const [state, dispatch] = useReducer(reducer, initialState(status, activeCampaign));
  const setQrPanelOpen = useCallback((value: boolean) => {
    dispatch({ type: 'set-qr-panel-open', value });
  }, []);

  const setQrDialogOpen = useCallback((value: boolean) => {
    dispatch({ type: 'set-qr-dialog-open', value });
  }, []);

  const setInstancePendingDelete = useCallback((value: any) => {
    dispatch({ type: 'set-instance-pending-delete', value });
  }, []);

  const setCreateInstanceOpen = useCallback((value: boolean) => {
    dispatch({ type: 'set-create-instance-open', value });
  }, []);

  const setPairingPhoneInput = useCallback((value: string) => {
    dispatch({ type: 'set-pairing-phone-input', value });
  }, []);

  const setPairingPhoneError = useCallback((value: string | null) => {
    dispatch({ type: 'set-pairing-phone-error', value });
  }, []);

  const setRequestingPairing = useCallback((value: boolean) => {
    dispatch({ type: 'set-requesting-pairing', value });
  }, []);

  const setExpandedInstanceId = useCallback((value: string | null) => {
    dispatch({ type: 'set-expanded-instance-id', value });
  }, []);

  const setErrorMessage = useCallback(
    (message: string | null, meta: Partial<ErrorState> = {}) => {
      if (message) {
        const copy = resolveWhatsAppErrorCopy(meta.code ?? null, message);
        dispatch({
          type: 'set-error-state',
          value: {
            code: copy.code ?? meta.code ?? null,
            title: meta.title ?? copy.title ?? 'Algo deu errado',
            message: copy.description ?? message,
          },
        });
      } else {
        dispatch({ type: 'set-error-state', value: null });
      }
    },
    []
  );

  const tenantState = useTenantInstances({
    selectedAgreement,
    status,
    activeCampaign,
    onStatusChange,
    onError: (message: string | null, meta?: any) => {
      if (!message) {
        dispatch({ type: 'set-error-state', value: null });
        return;
      }
      const copy = resolveWhatsAppErrorCopy(meta?.code ?? null, message);
      dispatch({
        type: 'set-error-state',
        value: {
          code: copy.code ?? meta?.code ?? null,
          title: meta?.title ?? copy.title ?? 'Algo deu errado',
          message: copy.description ?? message,
        },
      });
    },
    logger: { log, warn, error: logError },
    dispatch,
    state,
    campaignInstanceId: activeCampaign?.instanceId ?? null,
  });

  const campaignState = useCampaignWorkflow({
    state,
    dispatch,
    selectedAgreement,
    activeCampaign,
    instance: tenantState.instance,
    instances: tenantState.tenantScopedInstances,
    handleAuthFallback: tenantState.handleAuthFallback,
    logError,
    ...(onCampaignReady ? { onCampaignReady } : {}),
  });

  const sessionUiState = useSessionUiState({
    state,
    dispatch,
    localStatus: tenantState.localStatus,
    qrData: tenantState.qrData,
    secondsLeft: tenantState.secondsLeft,
    setSecondsLeft: tenantState.setSecondsLeft,
    setInstanceStatus: tenantState.setInstanceStatus,
    onStatusChange,
    setGeneratingQrState: tenantState.setGeneratingQrState,
    loadingInstances: tenantState.loadingInstances,
    loadingQr: tenantState.loadingQr,
    instance: tenantState.instance,
    realtimeConnected: tenantState.realtimeConnected,
    selectInstance: tenantState.selectInstance,
    generateQr: tenantState.generateQr,
    markConnected: tenantState.markConnected,
    connectInstance: tenantState.connectInstance,
    loadInstances: tenantState.loadInstances,
    setErrorMessage,
    selectedAgreementId: selectedAgreement?.id,
    requestingPairingCode: state.requestingPairingCode,
  });

  const {
    campaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    reloadCampaigns,
    fetchCampaignImpact,
    setCreateCampaignOpen,
    isCreateCampaignOpen,
    setPendingReassign,
    pendingReassign,
    setReassignIntent,
    reassignIntent,
    persistentWarning,
    clearCampaign,
  } = campaignState;

  const {
    statusCopy: statusCopyData,
    statusTone,
    countdownMessage,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    isBusy,
    canContinue,
    qrPanelOpen,
    isQrDialogOpen,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
  } = sessionUiState;

  const {
    instance,
    renderInstances,
    instancesReady,
    hasHiddenInstances,
    visibleInstanceCount,
    totalInstanceCount,
    tenantScopeNotice,
    tenantFilterId,
    tenantFilterLabel,
    tenantFilteredOutCount,
    selectedInstanceBelongsToTenant,
    tenantScopedInstances,
    localStatus,
    qrData,
    loadingInstances,
    loadingQr,
    isAuthenticated,
    deletingInstanceId,
    liveEvents,
    loadInstances,
    selectInstance,
    generateQr,
    connectInstance,
    createInstance,
    deleteInstance,
    markConnected,
    handleAuthFallback,
    setSecondsLeft,
    setGeneratingQrState,
    setInstanceStatus,
    realtimeConnected,
    selectedInstanceStatus,
    showAllInstances,
    setShowAllInstances,
    createInstanceWarning,
    canCreateInstance,
    nextInstanceOrdinal,
  } = tenantState;

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'channels',
    fallbackStep: { number: 2, label: 'Passo 2', nextStage: 'Inbox' },
  });

  const copy = statusCopyData ?? STATUS_COPY.disconnected;

  const hasAgreement = Boolean(selectedAgreement?.id);
  const agreementName = selectedAgreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhuma origem vinculada';
  const hasCampaign = Boolean(campaign);

  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const onboardingDescription =
    '1. Conecte seus números ao Lead Engine. 2. Vincule origens comerciais (convênios, parceiros ou filas) quando fizer sentido. 3. Ative campanhas apenas se precisar de roteamento avançado.';
  const defaultInstanceName = hasAgreement && agreementName
    ? `${agreementName} • WhatsApp ${nextInstanceOrdinal}`
    : `Instância WhatsApp ${nextInstanceOrdinal}`;
  const hasConnectedInstances =
    renderInstances.some(isInstanceConnected) ||
    (selectedInstanceBelongsToTenant && instance ? isInstanceConnected(instance) : false);
  const connectionHealthy =
    Boolean(instance) &&
    selectedInstanceBelongsToTenant &&
    isInstanceConnected(instance) &&
    localStatus === 'connected';
  const canCreateCampaigns = hasConnectedInstances && connectionHealthy;
  const confirmLabel = hasCampaign ? 'Ir para a Inbox' : 'Continuar';
  const confirmDisabled = !canContinue || !connectionHealthy;
  const instanceViewModels = useMemo<WhatsAppInstanceViewModel[]>(() => {
    return buildInstanceViewModels(renderInstances, instance ?? null);
  }, [instance?.id, renderInstances]);
  const hasRenderableInstances = instanceViewModels.length > 0;
  const instancesCountLabel = instancesReady
    ? showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const showFilterNotice = instancesReady && hasHiddenInstances && !showAllInstances;

  const timelineItems = useMemo(() => {
    if (!instance) {
      return [];
    }

    const metadata = instance.metadata && typeof instance.metadata === 'object' ? instance.metadata : {};
    const historyEntries = Array.isArray(metadata.history) ? metadata.history : [];

    const normalizedHistory = historyEntries
      .map((entry: any, index: number) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const timestamp =
          (typeof entry.at === 'string' && entry.at) ||
          (typeof entry.timestamp === 'string' && entry.timestamp) ||
          null;

        return {
          id: `history-${instance.id}-${timestamp ?? index}`,
          instanceId: instance.id,
          type: typeof entry.action === 'string' ? entry.action : 'status-sync',
          status: typeof entry.status === 'string' ? entry.status : entry.status ?? null,
          connected: typeof entry.connected === 'boolean' ? entry.connected : null,
          phoneNumber: typeof entry.phoneNumber === 'string' ? entry.phoneNumber : null,
          timestamp: timestamp ?? new Date(Date.now() - index * 1000).toISOString(),
        };
      })
      .filter(Boolean) as any[];

    const liveForInstance = liveEvents.filter((event) => event.instanceId === instance.id);

    const merged = [...liveForInstance, ...normalizedHistory];

    return merged
      .sort((a, b) => {
        const aTime = new Date(a.timestamp ?? '').getTime();
        const bTime = new Date(b.timestamp ?? '').getTime();
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, 12);
  }, [instance, liveEvents]);

  const handleRefreshInstances = useCallback(() => {
    void loadInstances();
  }, [loadInstances]);

  const handleCreateInstance = useCallback(() => {
    if (!canCreateInstance) {
      if (createInstanceWarning) {
        toast.warning(createInstanceWarning);
        setErrorMessage(createInstanceWarning, { code: 'MISSING_TENANT' });
      }
      return;
    }
    setErrorMessage(null);
    setCreateInstanceOpen(true);
  }, [canCreateInstance, createInstanceWarning, setCreateInstanceOpen, setErrorMessage]);

  const submitCreateInstance = useCallback(
    async ({ name, id }: { name: string; id?: string }) => {
      if (!canCreateInstance) {
        const warningMessage =
          createInstanceWarning ??
          'Selecione um acordo com tenantId válido para criar um novo canal do WhatsApp.';
        toast.warning(warningMessage);
        setErrorMessage(warningMessage, { code: 'MISSING_TENANT' });
        throw new Error(warningMessage);
      }
      const parsed = createInstanceSchema.safeParse({ name, id });
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? 'Informe um nome válido para a nova instância.';
        setErrorMessage(message);
        throw new Error(message);
      }

      try {
        await createInstance({ name: parsed.data.name, id: parsed.data.id ?? '' });
        setCreateInstanceOpen(false);
      } catch (err: any) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível criar uma nova instância';
        setErrorMessage(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [
      canCreateInstance,
      createInstanceWarning,
      createInstance,
      setCreateInstanceOpen,
      setErrorMessage,
    ]
  );

  const handleInstanceSelect = useCallback(
    async (inst: any, { skipAutoQr = false } = {}) => {
      const targetId = resolveInstanceId(inst);
      if (!targetId) return;

      if (campaign && campaign.instanceId !== inst.id) {
        clearCampaign();
      }

      await selectInstance(targetId, { skipAutoQr });
    },
    [campaign, clearCampaign, selectInstance]
  );

  const handleDeleteInstance = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      await deleteInstance(target);
      setInstancePendingDelete(null);
    },
    [deleteInstance, setInstancePendingDelete]
  );

  const removalTargetLabel =
    state.instancePendingDelete?.name ||
    state.instancePendingDelete?.displayId ||
    state.instancePendingDelete?.id ||
    'selecionada';
  const removalKind =
    state.instancePendingDelete?.kind || (state.instancePendingDelete?.isSession ? 'session' : null);
  const removalTargetIsSession = removalKind === 'session';
  const removalDialogTitle = removalTargetIsSession ? 'Desconectar sessão' : 'Remover instância';
  const removalDialogAction = removalTargetIsSession ? 'Desconectar sessão' : 'Remover instância';
  const deletionDialog = {
    open: Boolean(state.instancePendingDelete),
    target: state.instancePendingDelete,
    title: removalDialogTitle,
    actionLabel: removalDialogAction,
    targetLabel: removalTargetLabel,
  };

  return {
    state,
    surfaceStyles: SURFACE_COLOR_UTILS,
    statusCopy: copy,
    statusTone,
    countdownMessage,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    hasAgreement,
    agreementDisplayName,
    selectedAgreement,
    tenantFilterId,
    tenantFilterLabel,
    tenantFilteredOutCount,
    tenantScopeNotice,
    selectedInstanceBelongsToTenant,
    selectedInstance: instance,
    selectedInstancePhone,
    selectedInstanceStatusInfo,
    instancesReady,
    hasHiddenInstances,
    hasRenderableInstances,
    instanceViewModels,
    showFilterNotice,
    instancesCountLabel,
    loadingInstances,
    isAuthenticated,
    copy,
    connectionStatus: localStatus,
    localStatus,
    onBack,
    handleRefreshInstances,
    handleCreateInstance,
    submitCreateInstance,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    campaign,
    persistentWarning,
    canCreateInstance,
    createInstanceWarning,
    setShowAllInstances,
    renderInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    timelineItems,
    realtimeConnected,
    connectionHealthy,
    handleInstanceSelect,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
    handleDeleteInstance,
    deletionDialog,
    setInstancePendingDelete,
    isBusy,
    canContinue,
    qrPanelOpen,
    isQrDialogOpen,
    hasCampaign,
    statusCodeMeta,
    defaultInstanceName,
    deletingInstanceId,
    errorState: state.errorState,
    loadInstances,
    reloadCampaigns,
    showAllInstances,
    handleRetry: () => loadInstances(),
    setCreateInstanceOpen,
    setCreateCampaignOpen,
    isCreateInstanceOpen: state.isCreateInstanceOpen,
    isCreateCampaignOpen,
    setExpandedInstanceId,
    expandedInstanceId: state.expandedInstanceId,
    setPendingReassign,
    pendingReassign,
    setReassignIntent,
    reassignIntent,
    fetchCampaignImpact,
    agreementName,
    nextStage,
    stepLabel,
    onboardingDescription,
    canCreateCampaigns,
    confirmLabel,
    confirmDisabled,
    onContinue,
  }; 
};

export default useWhatsAppConnect;
export { reducer as whatsappConnectReducer };
