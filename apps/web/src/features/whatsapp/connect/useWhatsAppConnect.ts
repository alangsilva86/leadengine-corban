import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';

import usePlayfulLogger from '../../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../../onboarding/useOnboardingStepLabel.js';
import useWhatsAppInstances from '../hooks/useWhatsAppInstances.jsx';
import {
  getStatusInfo,
  resolveInstancePhone,
  shouldDisplayInstance,
  looksLikeWhatsAppJid,
} from '../lib/instances';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import { pairingPhoneSchema, createInstanceSchema, createCampaignSchema } from './schemas';
import {
  fetchCampaigns,
  createCampaign as createCampaignRequest,
  deleteCampaign as deleteCampaignRequest,
  updateCampaignStatus as updateCampaignStatusRequest,
  reassignCampaign as reassignCampaignRequest,
  fetchCampaignImpact,
} from './services/campaignService';
import { requestPairingCode as requestPairingCodeService } from './services/pairingService';

type Nullable<T> = T | null;

const STATUS_TONES = {
  disconnected: 'warning',
  connecting: 'info',
  connected: 'success',
  qr_required: 'warning',
  fallback: 'neutral',
} as const;

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

const statusCopy = {
  disconnected: {
    badge: 'Pendente',
    description:
      'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: STATUS_TONES.disconnected,
  },
  connecting: {
    badge: 'Conectando',
    description:
      'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
    tone: STATUS_TONES.connecting,
  },
  connected: {
    badge: 'Ativo',
    description: 'Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.',
    tone: STATUS_TONES.connected,
  },
  qr_required: {
    badge: 'QR necessário',
    description: 'Gere um novo QR Code e escaneie para reativar a sessão.',
    tone: STATUS_TONES.qr_required,
  },
} as const;

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Total de mensagens reportadas com o código 1 pelo broker.' },
  { code: '2', label: '2', description: 'Total de mensagens reportadas com o código 2 pelo broker.' },
  { code: '3', label: '3', description: 'Total de mensagens reportadas com o código 3 pelo broker.' },
  { code: '4', label: '4', description: 'Total de mensagens reportadas com o código 4 pelo broker.' },
  { code: '5', label: '5', description: 'Total de mensagens reportadas com o código 5 pelo broker.' },
];

const VISIBLE_INSTANCE_STATUSES = new Set(['connected', 'connecting']);

interface ErrorState {
  code: string | null;
  title: string | null;
  message: string;
}

interface CampaignActionState {
  id: string | null;
  type: string | null;
}

interface WhatsAppConnectState {
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

type WhatsAppConnectAction =
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


const mergeQr = (primary: any, secondary: any) => {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    qr: primary.qr ?? secondary.qr ?? null,
    qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
    qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
    expiresAt:
      primary.expiresAt ?? secondary.expiresAt ?? primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
  };
};

const extractQrPayload = (payload: any) => {
  if (!payload) return null;

  const parseCandidate = (candidate: any): any => {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
      return { qr: candidate, qrCode: candidate, qrExpiresAt: null, expiresAt: null };
    }

    if (typeof candidate !== 'object') {
      return null;
    }

    const source = candidate;

    const directQr =
      typeof source.qr === 'string'
        ? source.qr
        : typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : typeof source.code === 'string'
        ? source.code
        : typeof source.image === 'string'
        ? source.image
        : typeof source.value === 'string'
        ? source.value
        : null;

    const qrCodeCandidate =
      typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : null;

    const qrExpiresCandidate =
      typeof source.qrExpiresAt === 'string'
        ? source.qrExpiresAt
        : typeof source.qr_expires_at === 'string'
        ? source.qr_expires_at
        : null;

    const expiresCandidate =
      typeof source.expiresAt === 'string'
        ? source.expiresAt
        : typeof source.expiration === 'string'
        ? source.expiration
        : typeof source.expires === 'string'
        ? source.expires
        : null;

    let normalized = null;

    if (directQr || qrCodeCandidate || qrExpiresCandidate || expiresCandidate) {
      normalized = {
        qr: directQr ?? qrCodeCandidate ?? null,
        qrCode: qrCodeCandidate ?? directQr ?? null,
        qrExpiresAt: qrExpiresCandidate ?? null,
        expiresAt: expiresCandidate ?? qrExpiresCandidate ?? null,
      };
    }

    const nestedCandidates = [
      source.qr,
      source.qrData,
      source.qrPayload,
      source.qr_info,
      source.data,
      source.payload,
      source.result,
      source.response,
    ];

    for (const nestedSource of nestedCandidates) {
      const nested = parseCandidate(nestedSource);
      if (nested) {
        normalized = mergeQr(normalized, nested);
        break;
      }
    }

    return normalized;
  };

  const normalized = parseCandidate(payload);

  if (!normalized) {
    return null;
  }

  const finalPayload: any = { ...normalized };
  if (!finalPayload.qr && finalPayload.qrCode) {
    finalPayload.qr = finalPayload.qrCode;
  }
  if (!finalPayload.qrCode && finalPayload.qr) {
    finalPayload.qrCode = finalPayload.qr;
  }
  if (!finalPayload.expiresAt && finalPayload.qrExpiresAt) {
    finalPayload.expiresAt = finalPayload.qrExpiresAt;
  }
  if (!finalPayload.qrExpiresAt && finalPayload.expiresAt) {
    finalPayload.qrExpiresAt = finalPayload.expiresAt;
  }

  return finalPayload;
};

const getQrImageSrc = (qrPayload: any) => {
  if (!qrPayload) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const payload = extractQrPayload(qrPayload);
  if (!payload) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const { qr } = payload;
  if (!qr || typeof qr !== 'string') {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const normalized = qr.trim();
  if (normalized.startsWith('data:image')) {
    return { code: normalized, immediate: normalized, needsGeneration: false, isBaileys: false };
  }

  if (/^https?:\/\//i.test(normalized)) {
    return { code: normalized, immediate: normalized, needsGeneration: false, isBaileys: false };
  }

  if (/^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length > 100) {
    return {
      code: normalized,
      immediate: `data:image/png;base64,${normalized}`,
      needsGeneration: false,
      isBaileys: false,
    };
  }

  const isBaileys = /BAILEYS/i.test(normalized);

  return {
    code: normalized,
    immediate: null,
    needsGeneration: true,
    isBaileys,
  };
};

const useQrImageSource = (qrPayload: any) => {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const [src, setSrc] = useState<string | null>(immediate ?? null);
  const [isGenerating, setIsGenerating] = useState<boolean>(Boolean(needsGeneration && !immediate));

  useEffect(() => {
    let cancelled = false;

    if (immediate) {
      setSrc(immediate);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    if (!code || !needsGeneration) {
      setSrc(null);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    setSrc(null);
    setIsGenerating(true);
    import('qrcode')
      .then(({ toDataURL }) => toDataURL(code, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 }))
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Falha ao gerar QR Code', error);
          setSrc(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, immediate, needsGeneration]);

  return { src, isGenerating };
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
    sessionActive,
    authDeferred,
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

  useEffect(() => {
    dispatch({ type: 'set-qr-panel-open', value: localStatus !== 'connected' });
  }, [localStatus]);

  useEffect(() => {
    dispatch({ type: 'set-campaign', value: activeCampaign ?? null });
  }, [activeCampaign]);

  useEffect(() => {
    if (!selectedAgreement) {
      dispatch({ type: 'set-campaign', value: null });
    }
  }, [selectedAgreement?.id]);

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

  const resolveFriendlyError = useCallback((error: any, fallbackMessage: string) => {
    const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
    const rawMessage =
      error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
    const copy = resolveWhatsAppErrorCopy(codeCandidate, rawMessage ?? fallbackMessage);
    return {
      code: copy.code,
      title: copy.title,
      message: copy.description ?? rawMessage ?? fallbackMessage,
    };
  }, []);

  const loadCampaignsRef = useRef<
    (options?: {
      preferredAgreementId?: string | null;
      preferredCampaignId?: string | null;
      preferredInstanceId?: string | null;
    }) => Promise<void>
  >(() => Promise.resolve());

  const loadCampaigns = useCallback(
    async ({
      preferredAgreementId,
      preferredCampaignId,
      preferredInstanceId,
    }: {
      preferredAgreementId?: string | null;
      preferredCampaignId?: string | null;
      preferredInstanceId?: string | null;
    } = {}) => {
      const agreementId = preferredAgreementId ?? selectedAgreement?.id ?? null;

      if (!agreementId) {
        dispatch({ type: 'set-campaigns', value: [] });
        dispatch({ type: 'set-campaign-error', value: null });
        return;
      }

      dispatch({ type: 'set-campaigns-loading', value: true });
      dispatch({ type: 'set-campaign-error', value: null });
      try {
        const items = await fetchCampaigns({ agreementId, instanceId: preferredInstanceId ?? undefined });
        dispatch({ type: 'set-campaigns', value: items });

        if (preferredCampaignId) {
          const found = items.find((c) => c && c.id === preferredCampaignId) || null;
          dispatch({ type: 'set-campaign', value: found });
        }
      } catch (err: any) {
        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Falha ao carregar campanhas');
        dispatch({ type: 'set-campaign-error', value: message });
      } finally {
        dispatch({ type: 'set-campaigns-loading', value: false });
      }
    },
    [selectedAgreement?.id]
  );

  useEffect(() => {
    loadCampaignsRef.current = loadCampaigns;
  }, [loadCampaigns]);

  useEffect(() => {
    void loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
      preferredCampaignId: state.campaign?.id ?? null,
      preferredInstanceId: instance?.id ?? null,
    });
  }, [selectedAgreement?.id, instance?.id]);

  const reloadCampaigns = useCallback(() => {
    return loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
      preferredCampaignId: state.campaign?.id ?? null,
      preferredInstanceId: instance?.id ?? null,
    });
  }, [loadCampaigns, selectedAgreement?.id, state.campaign?.id, instance?.id]);

  useEffect(() => {
    dispatch({ type: 'set-pairing-phone-input', value: '' });
    dispatch({ type: 'set-pairing-phone-error', value: null });
  }, [instance?.id, selectedAgreement?.id]);

  useEffect(() => {
    if (!state.campaign || !onCampaignReady) {
      return;
    }
    onCampaignReady(state.campaign);
  }, [state.campaign, onCampaignReady]);

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'whatsapp',
    fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Inbox de Leads' },
  });

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        if (localStatus !== 'connected' && localStatus !== 'connecting') {
          setInstanceStatus('qr_required');
          onStatusChange?.('disconnected');
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange, setSecondsLeft, setInstanceStatus]);

  const copy = statusCopy[localStatus as keyof typeof statusCopy] ?? statusCopy.disconnected;

  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);

  useEffect(() => {
    setGeneratingQrState(isGeneratingQrImage);
  }, [isGeneratingQrImage, setGeneratingQrState]);

  const hasAgreement = Boolean(selectedAgreement?.id);
  const agreementName = selectedAgreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhum convênio selecionado';
  const hasCampaign = Boolean(state.campaign);
  const canSynchronize = sessionActive && !authDeferred;
  const isAuthenticated = hookIsAuthenticated;
  const canContinue = localStatus === 'connected' && Boolean(instance);
  const statusTone = copy.tone || STATUS_TONES.fallback;
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || state.requestingPairingCode;
  const confirmLabel = 'Ir para a inbox de leads';
  const confirmDisabled = !canContinue || isBusy;
  const qrStatusMessage =
    localStatus === 'connected'
      ? 'Conexão ativa — QR oculto.'
      : countdownMessage || (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');
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
  const instancesCountLabel = instancesReady
    ? state.showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const hasRenderableInstances = renderInstances.length > 0;
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
    dispatch({ type: 'set-create-instance-open', value: true });
  }, [setErrorMessage]);

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
        dispatch({ type: 'set-create-instance-open', value: false });
      } catch (err: any) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível criar uma nova instância';
        setErrorMessage(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
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
        dispatch({ type: 'set-campaign-error', value: message });
        throw new Error(message);
      }

      const targetInstance =
        instances.find((entry) => entry && entry.id === parsed.data.instanceId) ?? null;
      const brokerId =
        targetInstance && targetInstance.metadata && typeof targetInstance.metadata === 'object'
          ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
          : null;

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: null, type: 'create' } });

      try {
        const payload = await createCampaignRequest({
          agreementId: selectedAgreement.id,
          agreementName: selectedAgreement.name,
          instanceId: parsed.data.instanceId,
          ...(brokerId ? { brokerId } : {}),
          name: parsed.data.name || `${selectedAgreement.name} • ${parsed.data.instanceId}`,
          status: parsed.data.status,
        });

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement.id,
          preferredCampaignId: payload?.id ?? null,
          preferredInstanceId: payload?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Campanha criada com sucesso.');
        return payload;
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível criar a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        logError('Falha ao criar campanha WhatsApp', err);
        toast.error('Falha ao criar campanha', { description: message });
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [
      selectedAgreement?.id,
      selectedAgreement?.name,
      instances,
      instance?.id,
      handleAuthFallback,
      logError,
    ]
  );

  const updateCampaignStatus = useCallback(
    async (target: any, nextStatus: string) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: nextStatus } });

      try {
        await updateCampaignStatusRequest(target.id, nextStatus);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success(
          nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.'
        );
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível atualizar a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao atualizar campanha', { description: message });
        logError('Falha ao atualizar status da campanha', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
  );

  const deleteCampaign = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'delete' } });
      const currentCampaignId = state.campaign?.id ?? null;

      try {
        await deleteCampaignRequest(target.id);
        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: currentCampaignId === target.id ? null : currentCampaignId,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Campanha removida com sucesso.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível remover a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao remover campanha', { description: message });
        logError('Falha ao remover campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [state.campaign?.id, selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
  );

  const reassignCampaign = useCallback(
    async (target: any, requestedInstanceId: string | null) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'reassign' } });

      try {
        if (requestedInstanceId === target.instanceId) {
          const error = new Error('Selecione uma opção diferente para concluir ou escolha desvincular a campanha.');
          dispatch({ type: 'set-campaign-error', value: error.message });
          throw error;
        }

        await reassignCampaignRequest(target.id, requestedInstanceId ?? null);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: requestedInstanceId ?? instance?.id ?? null,
        });
        toast.success(
          requestedInstanceId
            ? 'Campanha reatribuída com sucesso.'
            : 'Campanha desvinculada da instância.'
        );
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao reatribuir campanha', { description: message });
        logError('Falha ao reatribuir campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
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

      if (state.campaign && state.campaign.instanceId !== inst.id) {
        dispatch({ type: 'set-campaign', value: null });
      }

      await selectInstance(inst, { skipAutoQr });
    },
    [selectInstance, state.campaign]
  );

  const handleViewQr = useCallback(
    async (inst: any) => {
      if (!inst) return;
      await selectInstance(inst, { skipAutoQr: true });
      await generateQr(inst.id);
      dispatch({ type: 'set-qr-dialog-open', value: true });
    },
    [selectInstance, generateQr]
  );

  const handleGenerateQr = useCallback(async () => {
    if (!instance?.id) return;
    await generateQr(instance.id);
  }, [generateQr, instance?.id]);

  const handleMarkConnected = useCallback(async () => {
    const success = await markConnected();
    if (success) {
      dispatch({ type: 'set-qr-dialog-open', value: false });
    }
  }, [markConnected]);

  const handleDeleteInstance = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      await deleteInstanceAction(target);
      dispatch({ type: 'set-instance-pending-delete', value: null });
    },
    [deleteInstanceAction]
  );

  const handleConfirm = useCallback(() => {
    if (!canContinue) {
      return;
    }
    onContinue?.();
  }, [canContinue, onContinue]);

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
    renderInstances,
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
    campaigns: state.campaigns,
    campaignsLoading: state.campaignsLoading,
    campaignError: state.campaignError,
    campaignAction: state.campaignAction,
    campaign: state.campaign,
    persistentWarning: state.persistentWarning,
    setShowAllInstances: (value: boolean) => dispatch({ type: 'set-show-all-instances', value }),
    setQrPanelOpen: (value: boolean) => dispatch({ type: 'set-qr-panel-open', value }),
    setQrDialogOpen: (value: boolean) => dispatch({ type: 'set-qr-dialog-open', value }),
    pairingPhoneInput: state.pairingPhoneInput,
    pairingPhoneError: state.pairingPhoneError,
    requestingPairingCode: state.requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    timelineItems,
    realtimeConnected,
    handleInstanceSelect,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
    handleDeleteInstance,
    deletionDialog: {
      open: Boolean(state.instancePendingDelete),
      target: state.instancePendingDelete,
      title: removalDialogTitle,
      actionLabel: removalDialogAction,
      targetLabel: removalTargetLabel,
    },
    setInstancePendingDelete: (value: any) => dispatch({ type: 'set-instance-pending-delete', value }),
    isBusy,
    canContinue,
    qrPanelOpen: state.qrPanelOpen,
    isQrDialogOpen: state.isQrDialogOpen,
    hasCampaign,
    statusCodeMeta,
    defaultInstanceName,
    deletingInstanceId,
    errorState: state.errorState,
    loadInstances,
    reloadCampaigns,
    showAllInstances: state.showAllInstances,
    handleRetry: () => loadInstances({ forceRefresh: true }),
    setCreateInstanceOpen: (value: boolean) => dispatch({ type: 'set-create-instance-open', value }),
    setCreateCampaignOpen: (value: boolean) => dispatch({ type: 'set-create-campaign-open', value }),
    isCreateInstanceOpen: state.isCreateInstanceOpen,
    isCreateCampaignOpen: state.isCreateCampaignOpen,
    setExpandedInstanceId: (value: string | null) => dispatch({ type: 'set-expanded-instance-id', value }),
    expandedInstanceId: state.expandedInstanceId,
    setPendingReassign: (value: any) => dispatch({ type: 'set-pending-reassign', value }),
    pendingReassign: state.pendingReassign,
    setReassignIntent: (value: 'reassign' | 'disconnect') => dispatch({ type: 'set-reassign-intent', value }),
    reassignIntent: state.reassignIntent,
    fetchCampaignImpact,
    agreementName,
    nextStage,
    stepLabel,
    onboardingDescription,
  };
};

export default useWhatsAppConnect;
