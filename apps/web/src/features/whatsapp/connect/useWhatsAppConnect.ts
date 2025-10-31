import { useCallback, useEffect, useMemo, useReducer } from 'react';

import usePlayfulLogger from '../../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../../onboarding/useOnboardingStepLabel.js';
import useWhatsAppInstances from '../hooks/useWhatsAppInstances.jsx';
import useQrImageSource from '../hooks/useQrImageSource.js';
import {
  getStatusInfo,
  resolveInstancePhone,
  shouldDisplayInstance,
  looksLikeWhatsAppJid,
} from '../lib/instances';
import { formatPhoneNumber, formatTimestampLabel } from '../lib/formatting';
import { getInstanceMetrics } from '../lib/metrics';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import { createInstanceSchema } from './schemas';
import useWhatsappSessionState, { STATUS_COPY } from './hooks/useWhatsappSessionState';
import useWhatsappCampaignActions from './hooks/useWhatsappCampaignActions';
import useWhatsappPairing from './hooks/useWhatsappPairing';
import { pairingPhoneSchema, createInstanceSchema, createCampaignSchema } from './schemas';
import {
  fetchCampaigns,
  createCampaign as createCampaignRequest,
  deleteCampaign as deleteCampaignRequest,
  updateCampaignStatus as updateCampaignStatusRequest,
  reassignCampaign as reassignCampaignRequest,
  fetchCampaignImpact,
} from './services/campaignService';
import { executeCampaignAction } from './services/campaignActions';
import { requestPairingCode as requestPairingCodeService } from './services/pairingService';

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

interface CampaignActionState {
  id: string | null;
  type: string | null;
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
  onContinue?: () => void;
  onBack?: () => void;
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
  onContinue,
  onBack,
}: UseWhatsAppConnectParams) => {
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const [state, dispatch] = useReducer(reducer, initialState(status, activeCampaign));
  const setCampaignError = useCallback(
    (value: string | null) => {
      dispatch({ type: 'set-campaign-error', value });
    },
    [dispatch]
  );
  const setCampaignAction = useCallback(
    (value: CampaignActionState | null) => {
      dispatch({ type: 'set-campaign-action', value });
    },
    [dispatch]
  );
  const {
    instances,
    instancesReady,
    currentInstance: instance,
    status: localStatus,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    isAuthenticated: hookIsAuthenticated,
    deletingInstanceId,
    liveEvents,
    loadInstances,
    selectInstance,
    generateQr,
    connectInstance,
    createInstance: createInstanceAction,
    deleteInstance: deleteInstanceAction,
    markConnected,
    handleAuthFallback,
    setSecondsLeft,
    setGeneratingQrState,
    setStatus: setInstanceStatus,
    realtimeConnected,
  } = useWhatsAppInstances({
    selectedAgreement,
    status,
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
    campaignInstanceId: activeCampaign?.instanceId ?? null,
  });

  useEffect(() => {
    persistShowAllPreference(state.showAllInstances);
  }, [state.showAllInstances]);

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

  const setShowAllInstances = useCallback((value: boolean) => {
    dispatch({ type: 'set-show-all-instances', value });
  }, []);

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

  const campaignState = useWhatsappCampaignActions({
    state,
    dispatch,
    selectedAgreement,
    activeCampaign,
    instance,
    instances,
    handleAuthFallback,
    logError,
    onCampaignReady,
  });

  const sessionState = useWhatsappSessionState({
    state,
    localStatus,
    qrData,
    secondsLeft,
    setSecondsLeft,
    setInstanceStatus,
    onStatusChange,
    setGeneratingQrState,
    loadingInstances,
    loadingQr,
    requestingPairingCode: state.requestingPairingCode,
    instance,
    selectInstance,
    generateQr,
    markConnected,
    onContinue,
    setQrPanelOpen,
    setQrDialogOpen,
  });

  const pairingState = useWhatsappPairing({
    state,
    setPairingPhoneInput,
    setPairingPhoneError,
    setRequestingPairing,
    instanceId: instance?.id,
    selectedAgreementId: selectedAgreement?.id,
    connectInstance,
    loadInstances,
    setErrorMessage,
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
    confirmLabel,
    confirmDisabled,
    isBusy,
    canContinue,
    qrPanelOpen,
    isQrDialogOpen,
    handleConfirm,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
  } = sessionState;

  const {
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
  } = pairingState;

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'whatsapp',
    fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Inbox de Leads' },
  });

  const copy = statusCopyData ?? STATUS_COPY.disconnected;

  const hasAgreement = Boolean(selectedAgreement?.id);
  const agreementName = selectedAgreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhum convênio selecionado';
  const hasCampaign = Boolean(campaign);
  const isAuthenticated = hookIsAuthenticated;
  
  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const onboardingDescription = hasAgreement
    ? 'Utilize o QR Code para sincronizar o número que você usa com os clientes. Após a conexão, o Lead Engine entrega automaticamente os leads do convênio selecionado. Campanhas são opcionais e podem ser configuradas quando precisar de roteamento avançado.'
    : 'Utilize o QR Code para sincronizar o número que você usa com os clientes. Você pode vincular um convênio quando for conveniente e criar campanhas opcionais apenas se precisar de roteamento avançado.';
  const nextInstanceOrdinal = instances.length + 1;
  const defaultInstanceName = hasAgreement && agreementName
    ? `${agreementName} • WhatsApp ${nextInstanceOrdinal}`
    : `Instância WhatsApp ${nextInstanceOrdinal}`;
  const visibleInstances = useMemo(() => instances.filter(shouldDisplayInstance), [instances]);
  const totalInstanceCount = instances.length;
  const visibleInstanceCount = visibleInstances.length;
  const hasHiddenInstances = totalInstanceCount > visibleInstanceCount;
  const renderInstances = state.showAllInstances ? instances : visibleInstances;
  const instanceViewModels = useMemo<WhatsAppInstanceViewModel[]>(() => {
    return renderInstances.map((entry, index) => {
      const statusInfo = getStatusInfo(entry);
      const metrics = getInstanceMetrics(entry);
      const phoneLabel = resolveInstancePhone(entry) ?? '';
      const formattedPhone = formatPhoneNumber(phoneLabel);
      const addressCandidate =
        (typeof entry?.address === 'string' && entry.address) ||
        (typeof entry?.jid === 'string' && entry.jid) ||
        (typeof entry?.session === 'string' && entry.session) ||
        null;
      const lastUpdated = entry?.updatedAt ?? entry?.lastSeen ?? entry?.connectedAt ?? null;
      const user = typeof entry?.user === 'string' ? entry.user : null;
      const rateUsage = metrics.rateUsage;
      const ratePercentage = Math.max(0, Math.min(100, rateUsage?.percentage ?? 0));
      const key =
        (typeof entry?.id === 'string' && entry.id) ||
        (typeof entry?.name === 'string' && entry.name) ||
        `instance-${index}`;

      return {
        key,
        id: typeof entry?.id === 'string' ? entry.id : null,
        displayName:
          (typeof entry?.name === 'string' && entry.name) ||
          (typeof entry?.id === 'string' ? entry.id : 'Instância'),
        phoneLabel,
        formattedPhone,
        addressLabel:
          addressCandidate && addressCandidate !== phoneLabel ? addressCandidate : null,
        statusInfo,
        metrics,
        statusValues: metrics.status,
        rateUsage,
        ratePercentage,
        lastUpdatedLabel: formatTimestampLabel(lastUpdated),
        user,
        instance: entry,
        isCurrent:
          Boolean(instance?.id && entry?.id && instance.id === entry.id) ||
          instance === entry,
      };
    });
  }, [instance?.id, renderInstances]);
  const hasRenderableInstances = instanceViewModels.length > 0;
  const instancesCountLabel = instancesReady
    ? state.showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const showFilterNotice = instancesReady && hasHiddenInstances && !state.showAllInstances;

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
    void loadInstances({ forceRefresh: true });
  }, [loadInstances]);

  const handleCreateInstance = useCallback(() => {
    setErrorMessage(null);
    setCreateInstanceOpen(true);
  }, [setCreateInstanceOpen, setErrorMessage]);

  const submitCreateInstance = useCallback(
    async ({ name, id }: { name: string; id?: string }) => {
      const parsed = createInstanceSchema.safeParse({ name, id });
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? 'Informe um nome válido para a nova instância.';
        setErrorMessage(message);
        throw new Error(message);
      }

      try {
        await createInstanceAction({ name: parsed.data.name, id: parsed.data.id ?? '' });
        setCreateInstanceOpen(false);
      } catch (err: any) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível criar uma nova instância';
        setErrorMessage(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [createInstanceAction, setCreateInstanceOpen, setErrorMessage]
  );

    [createInstanceAction, setErrorMessage]
  );

  const createCampaign = useCallback(
    async ({ name, instanceId, status: requestedStatus = 'active' }: { name: string; instanceId: string; status?: string }) => {
      if (!selectedAgreement?.id) {
        throw new Error('Vincule um convênio antes de criar campanhas.');
      }

      const parsed = createCampaignSchema.safeParse({ name, instanceId, status: requestedStatus });
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? 'Falha ao validar os dados da campanha.';
        setCampaignError(message);
        throw new Error(message);
      }

      const targetInstance =
        instances.find((entry) => entry && entry.id === parsed.data.instanceId) ?? null;
      const brokerId =
        targetInstance && targetInstance.metadata && typeof targetInstance.metadata === 'object'
          ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
          : null;

      return executeCampaignAction({
        actionType: 'create',
        setCampaignAction,
        setCampaignError,
        service: () =>
          createCampaignRequest({
            agreementId: selectedAgreement.id,
            agreementName: selectedAgreement.name,
            instanceId: parsed.data.instanceId,
            ...(brokerId ? { brokerId } : {}),
            name: parsed.data.name || `${selectedAgreement.name} • ${parsed.data.instanceId}`,
            status: parsed.data.status,
          }),
        onSuccess: async (payload) => {
          await loadCampaignsRef.current?.({
            preferredAgreementId: selectedAgreement.id,
            preferredCampaignId: payload?.id ?? null,
            preferredInstanceId: payload?.instanceId ?? instance?.id ?? null,
          });
        },
        successToastMessage: 'Campanha criada com sucesso.',
        errorToastTitle: 'Falha ao criar campanha',
        defaultErrorMessage: 'Não foi possível criar a campanha',
        logError,
        logLabel: 'Falha ao criar campanha WhatsApp',
        onUnauthorized: (error) => handleAuthFallback({ error }),
      });
    },
    [
      selectedAgreement?.id,
      selectedAgreement?.name,
      instances,
      instance?.id,
      setCampaignAction,
      setCampaignError,
      handleAuthFallback,
      logError,
    ]
  );

  const updateCampaignStatus = useCallback(
    async (target: any, nextStatus: string) => {
      if (!target?.id) {
        return;
      }

      await executeCampaignAction({
        actionType: nextStatus,
        actionId: target.id,
        setCampaignAction,
        setCampaignError,
        service: () => updateCampaignStatusRequest(target.id, nextStatus),
        onSuccess: async () => {
          await loadCampaignsRef.current?.({
            preferredAgreementId: selectedAgreement?.id ?? null,
            preferredCampaignId: target?.id ?? null,
            preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
          });
        },
        successToastMessage:
          nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.',
        errorToastTitle: 'Falha ao atualizar campanha',
        defaultErrorMessage: 'Não foi possível atualizar a campanha',
        logError,
        logLabel: 'Falha ao atualizar status da campanha',
        onUnauthorized: (error) => handleAuthFallback({ error }),
      });
    },
    [
      selectedAgreement?.id,
      instance?.id,
      setCampaignAction,
      setCampaignError,
      handleAuthFallback,
      logError,
    ]
  );

  const deleteCampaign = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      const currentCampaignId = state.campaign?.id ?? null;

      await executeCampaignAction({
        actionType: 'delete',
        actionId: target.id,
        setCampaignAction,
        setCampaignError,
        service: () => deleteCampaignRequest(target.id),
        onSuccess: async () => {
          await loadCampaignsRef.current?.({
            preferredAgreementId: selectedAgreement?.id ?? null,
            preferredCampaignId: currentCampaignId === target.id ? null : currentCampaignId,
            preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
          });
        },
        successToastMessage: 'Campanha removida com sucesso.',
        errorToastTitle: 'Falha ao remover campanha',
        defaultErrorMessage: 'Não foi possível remover a campanha',
        logError,
        logLabel: 'Falha ao remover campanha WhatsApp',
        onUnauthorized: (error) => handleAuthFallback({ error }),
      });
    },
    [
      state.campaign?.id,
      selectedAgreement?.id,
      instance?.id,
      setCampaignAction,
      setCampaignError,
      handleAuthFallback,
      logError,
    ]
  );

  const reassignCampaign = useCallback(
    async (target: any, requestedInstanceId: string | null) => {
      if (!target?.id) {
        return;
      }

      if (requestedInstanceId === target.instanceId) {
        const error = new Error('Selecione uma opção diferente para concluir ou escolha desvincular a campanha.');
        setCampaignError(error.message);
        throw error;
      }

      await executeCampaignAction({
        actionType: 'reassign',
        actionId: target.id,
        setCampaignAction,
        setCampaignError,
        service: () => reassignCampaignRequest(target.id, requestedInstanceId ?? null),
        onSuccess: async () => {
          await loadCampaignsRef.current?.({
            preferredAgreementId: selectedAgreement?.id ?? null,
            preferredCampaignId: target?.id ?? null,
            preferredInstanceId: requestedInstanceId ?? instance?.id ?? null,
          });
        },
        successToastMessage: requestedInstanceId
          ? 'Campanha reatribuída com sucesso.'
          : 'Campanha desvinculada da instância.',
        errorToastTitle: 'Falha ao reatribuir campanha',
        defaultErrorMessage: 'Não foi possível reatribuir a campanha',
        logError,
        logLabel: 'Falha ao reatribuir campanha WhatsApp',
        onUnauthorized: (error) => handleAuthFallback({ error }),
      });
    },
    [
      selectedAgreement?.id,
      instance?.id,
      setCampaignAction,
      setCampaignError,
      handleAuthFallback,
      logError,
    ]
  );

  const handlePairingPhoneChange = useCallback(
    (event: any) => {
      const value = typeof event?.target?.value === 'string' ? event.target.value : '';
      dispatch({ type: 'set-pairing-phone-input', value });
      if (state.pairingPhoneError) {
        dispatch({ type: 'set-pairing-phone-error', value: null });
      }
    },
    [state.pairingPhoneError]
  );

  const handleRequestPairingCode = useCallback(async () => {
    if (!instance?.id) {
      dispatch({
        type: 'set-pairing-phone-error',
        value: 'Selecione uma instância para solicitar o pareamento por código.',
      });
      return;
    }

    const validation = pairingPhoneSchema.safeParse({ phone: state.pairingPhoneInput });
    if (!validation.success) {
      const message = validation.error.errors[0]?.message ?? 'Informe o telefone que receberá o código.';
      dispatch({ type: 'set-pairing-phone-error', value: message });
      return;
    }

    dispatch({ type: 'set-pairing-phone-error', value: null });
    dispatch({ type: 'set-requesting-pairing', value: true });
    try {
      const result = await requestPairingCodeService(connectInstance, instance.id, validation.data.phone);
      await loadInstances({
        connectResult: result || undefined,
        preferredInstanceId: instance.id,
        forceRefresh: true,
      });
      toast.success(
        'Solicitamos o código de pareamento. Abra o WhatsApp oficial e informe o código recebido para concluir a conexão.'
      );
    } catch (err: any) {
      const friendly = resolveFriendlyError(
        err,
        'Não foi possível solicitar o pareamento por código. Verifique o telefone informado e tente novamente.'
      );
      dispatch({ type: 'set-pairing-phone-error', value: friendly.message });
      setErrorMessage(friendly.message, {
        code: friendly.code ?? null,
        title: friendly.title ?? 'Falha ao solicitar pareamento por código',
      });
    } finally {
      dispatch({ type: 'set-requesting-pairing', value: false });
    }
  }, [
    instance?.id,
    state.pairingPhoneInput,
    connectInstance,
    loadInstances,
    resolveFriendlyError,
    setErrorMessage,
  ]);

  const handleInstanceSelect = useCallback(
    async (inst: any, { skipAutoQr = false } = {}) => {
      if (!inst) return;

      if (campaign && campaign.instanceId !== inst.id) {
        clearCampaign();
      }

      await selectInstance(inst, { skipAutoQr });
    },
    [campaign, clearCampaign, selectInstance]
  );

  const handleDeleteInstance = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      await deleteInstanceAction(target);
      setInstancePendingDelete(null);
    },
    [deleteInstanceAction, setInstancePendingDelete]
  );

  const removalTargetLabel =
    state.instancePendingDelete?.name ||
    state.instancePendingDelete?.displayId ||
    state.instancePendingDelete?.id ||
    'selecionada';
  const removalKind =
    state.instancePendingDelete?.kind || (state.instancePendingDelete?.isSession ? 'session' : null);
  const removalTargetIsSession =
    removalKind === 'session' ||
    (state.instancePendingDelete?.id ? looksLikeWhatsAppJid(state.instancePendingDelete.id) : false);
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
    confirmLabel,
    confirmDisabled,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    hasAgreement,
    agreementDisplayName,
    selectedAgreement,
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
    localStatus,
    onBack,
    onContinue: handleConfirm,
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
    setShowAllInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    timelineItems,
    realtimeConnected,
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
    showAllInstances: state.showAllInstances,
    handleRetry: () => loadInstances({ forceRefresh: true }),
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
  };
};

export default useWhatsAppConnect;
