import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import useWhatsAppInstances from './hooks/useWhatsAppInstances.js';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import usePlayfulLogger from '../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../onboarding/useOnboardingStepLabel.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import useWhatsAppCampaigns from './hooks/useWhatsAppCampaigns.js';
import useWhatsAppInstances from './hooks/useWhatsAppInstances.js';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import CampaignsPanel from './components/CampaignsPanel.jsx';
import CreateCampaignDialog from './components/CreateCampaignDialog.jsx';
import CreateInstanceDialog from './components/CreateInstanceDialog.jsx';
import ReassignCampaignDialog from './components/ReassignCampaignDialog.jsx';
import QrPreview from './components/QrPreview.jsx';
import InstancesPanel from './components/InstancesPanel.jsx';
import QrSection from './components/QrSection.jsx';
import { toast } from 'sonner';
import { resolveWhatsAppErrorCopy } from './utils/whatsapp-error-codes.js';
import useWhatsAppInstances, { looksLikeWhatsAppJid } from './hooks/useWhatsAppInstances.js';
import CampaignHistoryDialog from './components/CampaignHistoryDialog.jsx';
import {
  clearInstancesCache,
  normalizeInstancesCollection,
  parseInstancesPayload,
  persistInstancesCache,
  readInstancesCache,
  shouldDisplayInstance,
} from './utils/instances.js';
import { getInstanceMetrics } from './utils/metrics.js';
import {
  formatMetricValue,
  formatPhoneNumber,
  formatTimestampLabel,
  humanizeLabel,
} from './utils/formatting.js';
import useQrImageSource from './hooks/useQrImageSource.js';

const STATUS_TONES = {
  disconnected: 'warning',
  connecting: 'info',
  connected: 'success',
  qr_required: 'warning',
  fallback: 'neutral',
};

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
    description: 'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: STATUS_TONES.disconnected,
  },
  connecting: {
    badge: 'Conectando',
    description: 'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
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
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Total de mensagens reportadas com o código 1 pelo broker.' },
  { code: '2', label: '2', description: 'Total de mensagens reportadas com o código 2 pelo broker.' },
  { code: '3', label: '3', description: 'Total de mensagens reportadas com o código 3 pelo broker.' },
  { code: '4', label: '4', description: 'Total de mensagens reportadas com o código 4 pelo broker.' },
  { code: '5', label: '5', description: 'Total de mensagens reportadas com o código 5 pelo broker.' },
];

const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;











const getStatusInfo = (instance) => {
  const rawStatus = instance?.status || (instance?.connected ? 'connected' : 'disconnected');
  const map = {
    connected: { label: 'Conectado', variant: 'success' },
    connecting: { label: 'Conectando', variant: 'info' },
    disconnected: { label: 'Desconectado', variant: 'secondary' },
    qr_required: { label: 'QR necessário', variant: 'warning' },
    error: { label: 'Erro', variant: 'destructive' },
  };
  return map[rawStatus] || { label: rawStatus || 'Indefinido', variant: 'secondary' };
};







const looksLikeWhatsAppJid = (value) =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');


const resolveInstancePhone = (instance) =>
  instance?.phoneNumber ||
  instance?.number ||
  instance?.msisdn ||
  instance?.metadata?.phoneNumber ||
  instance?.metadata?.phone_number ||
  instance?.metadata?.msisdn ||
  instance?.jid ||
  instance?.session ||
  '';

const extractQrPayload = (payload) => {
  if (!payload) return null;

  const mergeQr = (primary, secondary) => {
    if (!primary) return secondary;
    if (!secondary) return primary;
    return {
      qr: primary.qr ?? secondary.qr ?? null,
      qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
      qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
      expiresAt:
        primary.expiresAt ??
        secondary.expiresAt ??
        primary.qrExpiresAt ??
        secondary.qrExpiresAt ??
        null,
    };
  };

  const parseCandidate = (candidate) => {
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

  const finalPayload = { ...normalized };
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

const extractInstanceFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  if (payload.instance && typeof payload.instance === 'object') {
    return payload.instance;
  }

  if (payload.data && typeof payload.data === 'object') {
    const nested = extractInstanceFromPayload(payload.data);
    if (nested) {
      return nested;
    }
  }

  if (payload.id || payload.name || payload.status || payload.connected) {
    return payload;
  }

  return null;
};

;









const WhatsAppConnect = ({
  selectedAgreement,
  status = 'disconnected',
  activeCampaign,
  onboarding,
  onStatusChange,
  onCampaignReady,
  onContinue,
  onBack,
}) => {
  const {
    warn,
    logError,
    surfaceStyles,
    statusCodeMeta,
    getStatusInfo,
    getInstanceMetrics,
    formatMetricValue,
    formatPhoneNumber,
    formatTimestampLabel,
    humanizeLabel,
    resolveInstancePhone,
    statusTone,
    copy,
    stepLabel,
    nextStage,
    onboardingDescription,
    hasAgreement,
    agreementDisplayName,
    agreementRegion,
    agreementId,
    countdownMessage,
    confirmLabel,
    confirmDisabled,
    qrStatusMessage,
    qrPanelOpen,
    setQrPanelOpen,
    qrImageSrc,
    isGeneratingQrImage,
    hasQr,
    isAuthenticated,
    isBusy,
    instance,
    instances,
    instancesReady,
    hasHiddenInstances,
    hasRenderableInstances,
    renderInstances,
    showFilterNotice,
    showAllInstances,
    setShowAllInstances,
    instancesCountLabel,
    errorState,
    loadingInstances,
    localStatus,
    handleMarkConnected,
    handleRefreshInstances,
    handleCreateInstance,
    loadInstances,
    handleInstanceSelect,
    setInstancePendingDelete,
    instancePendingDelete,
    deletingInstanceId,
    handleDeleteInstance,
    submitCreateInstance,
    isCreateInstanceOpen,
    setCreateInstanceOpen,
    defaultInstanceName,
    isCreateCampaignOpen,
    setCreateCampaignOpen,
    pendingReassign,
    setPendingReassign,
    reassignIntent,
    setReassignIntent,
    removalTargetLabel,
    removalTargetIsJid,
    removalDialogTitle,
    removalDialogAction,
    qrImageModalOpen,
    setQrDialogOpen,
    timelineItems,
    realtimeConnected,
    pairingPhoneInput,
    handlePairingPhoneChange,
    pairingPhoneError,
    requestingPairingCode,
    handleRequestPairingCode,
    handleAuthFallback,
    isAuthError,
    syncCampaignSelection,
    generateQr,
    generateQrForInstance,
    resetQrState,
    canContinue,
  } = useWhatsAppInstances({
    agreement: selectedAgreement,
    status,
    onboarding,
    activeCampaign,
    onStatusChange,
  });
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const clearCampaignSelectionRef = useRef(() => {});
  const authFallbackBridgeRef = useRef(() => {});

  const forwardClearCampaignSelection = useCallback(() => {
    clearCampaignSelectionRef.current?.();
  }, []);
  const [showAllInstances, setShowAllInstances] = useState(false);
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [pairingPhoneError, setPairingPhoneError] = useState(null);
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [qrPanelOpen, setQrPanelOpen] = useState(status !== 'connected');
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);
  const [instancePendingDelete, setInstancePendingDelete] = useState(null);
  const [isCreateInstanceOpen, setCreateInstanceOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(null);
  const [reassignIntent, setReassignIntent] = useState('reassign');
  const [persistentWarning, setPersistentWarning] = useState(null);
  const loadCampaignsRef = useRef(() => {});
  const loadInstancesRef = useRef(() => {});
  const hasFetchedOnceRef = useRef(false);
  const loadingInstancesRef = useRef(loadingInstances);
  const loadingQrRef = useRef(loadingQr);

  const forwardAuthFallback = useCallback((payload) => {
    authFallbackBridgeRef.current?.(payload);
  }, []);

  const isAuthError = useCallback((error) => {
    const responseStatus = typeof error?.status === 'number' ? error.status : null;
    return responseStatus === 401 || responseStatus === 403;
  }, []);

  const [campaignForInstances, setCampaignForInstances] = useState(activeCampaign ?? null);

  const {
    state: instanceState,
    actions: instanceActions,
    helpers: instanceHelpers,
  } = useWhatsAppInstances({
    agreement: selectedAgreement,
    activeCampaign: campaignForInstances,
    onStatusChange,
    onAuthFallback: forwardAuthFallback,
    toast,
    logger: { log, warn, error: logError },
    formatters: {
      resolveWhatsAppErrorCopy,
      formatMetricValue,
      formatTimestampLabel,
      formatPhoneNumber,
      humanizeLabel,
      getInstanceMetrics,
    },
    campaignHelpers: {
      clearCampaignSelection: forwardClearCampaignSelection,
    },
    status,
  });

  authFallbackBridgeRef.current = instanceActions.handleAuthFallback;

  const {
    instances,
    instance,
    instancesReady,
    showAllInstances,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    pairingPhoneInput,
    pairingPhoneError,
    requestingPairingCode,
    sessionActive,
    authDeferred,
    authTokenState,
    errorState,
    localStatus,
    qrPanelOpen,
    isQrDialogOpen,
    deletingInstanceId,
    instancePendingDelete,
    timelineItems,
    realtimeConnected,
  } = instanceState;

  const {
    setShowAllInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    setInstancePendingDelete,
    setDeletingInstanceId,
    setInstance,
    loadInstances,
    connectInstance,
    generateQr,
    handleInstanceSelect,
    handleViewQr,
    submitCreateInstance,
    handleDeleteInstance,
    handleMarkConnected,
    handlePairingPhoneChange,
    handleRequestPairingCode,
    setQrImageGenerating,
    handleAuthFallback,
    clearError,
  } = instanceActions;

  const {
    shouldDisplayInstance,
    resolveInstancePhone,
    formatMetricValue: formatMetricValueHelper,
    formatTimestampLabel: formatTimestampLabelHelper,
    formatPhoneNumber: formatPhoneNumberHelper,
    humanizeLabel: humanizeLabelHelper,
    getInstanceMetrics: getInstanceMetricsHelper,
  } = instanceHelpers;

  const {
    campaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    persistentWarning,
    loadCampaigns,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    fetchCampaignImpact,
    clearCampaignSelection,
  } = useWhatsAppCampaigns({
    agreement: selectedAgreement,
    instance: instanceState.instance,
    instances: instanceState.instances,
    activeCampaign,
    onCampaignReady,
    isAuthError,
    onAuthError: forwardAuthFallback,
    onSuccess: (message, options) => toast.success(message, options),
    onError: (message, options) => toast.error(message, options),
    warn,
    logError,
  });

  clearCampaignSelectionRef.current = clearCampaignSelection;

  useEffect(() => {
    setCampaignForInstances(campaign ?? activeCampaign ?? null);
  }, [campaign, activeCampaign]);

  const [isCreateInstanceOpen, setCreateInstanceOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(null);
  const [reassignIntent, setReassignIntent] = useState('reassign');

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'whatsapp',
    fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Inbox de Leads' },
  });
  const hasAgreement = Boolean(selectedAgreement?.id);
  const agreementName = selectedAgreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhum convênio selecionado';
  useEffect(() => {
    if (campaign) {
      syncCampaignSelection(campaign);
    }
  }, [campaign, syncCampaignSelection]);
  const enforceAuthPrompt = () => {
    handleAuthFallback({ reset: true });
  };

  const setErrorMessage = (message, meta = {}) => {
    if (message) {
      const copy = resolveWhatsAppErrorCopy(meta.code, message);
      const resolvedState = {
        ...meta,
        code: copy.code ?? meta.code ?? null,
        title: meta.title ?? copy.title ?? 'Algo deu errado',
        message: copy.description ?? message,
      };
      setErrorState(resolvedState);
    } else {
      setErrorState(null);
    }
  };

  const resolveFriendlyError = (error, fallbackMessage) => {
    const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
    const rawMessage =
      error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
    const copy = resolveWhatsAppErrorCopy(codeCandidate, rawMessage ?? fallbackMessage);
    return {
      code: copy.code,
      title: copy.title,
      message: copy.description ?? rawMessage ?? fallbackMessage,
    };
  };

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
    setStatus,
    realtimeConnected,
  } = useWhatsAppInstances({
    selectedAgreement,
    status,
    onStatusChange,
    onError: setErrorMessage,
    logger: { log, warn, error: logError },
    campaignInstanceId: campaign?.instanceId ?? null,
  });

  const enforceAuthPrompt = () => {
    handleAuthFallback({ reset: true });
  };

  const isAuthError = (error) => {
    const statusCode = typeof error?.status === 'number' ? error.status : null;
    return statusCode === 401 || statusCode === 403;
  };

  const applyErrorMessageFromError = (error, fallbackMessage, meta = {}) => {
    const friendly = resolveFriendlyError(error, fallbackMessage);
    setErrorMessage(friendly.message, {
      ...meta,
      code: friendly.code ?? meta.code,
      title: friendly.title ?? meta.title,
    });
    return friendly;
  };



  useEffect(() => {
    setPairingPhoneInput('');
    setPairingPhoneError(null);
  }, [instance?.id, selectedAgreement?.id]);

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const hasCampaign = Boolean(campaign);
  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const pairingDisabled = isBusy || !instance || !isAuthenticated;

  const handleConfirm = useCallback(() => {
    if (!canContinue) {
  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);
  useEffect(() => {
    setGeneratingQrState(isGeneratingQrImage);
  }, [isGeneratingQrImage, setGeneratingQrState]);

  const hasQr = Boolean(qrImageSrc);
  const canSynchronize = sessionActive && !authDeferred;
  const isAuthenticated = hookIsAuthenticated;
  const canContinue = localStatus === 'connected' && Boolean(instance);
  const statusTone = copy.tone || STATUS_TONES.fallback;
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || requestingPairingCode;
  const confirmLabel = 'Ir para a inbox de leads';
  const confirmDisabled = !canContinue || isBusy;
  const qrStatusMessage = localStatus === 'connected'
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
  const renderInstances = showAllInstances ? instances : visibleInstances;
  const instancesCountLabel = instancesReady
    ? showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const hasRenderableInstances = renderInstances.length > 0;
  const showFilterNotice = instancesReady && hasHiddenInstances && !showAllInstances;

  useEffect(() => {
    setQrImageGenerating(isGeneratingQrImage);
  }, [isGeneratingQrImage, setQrImageGenerating]);

  const handleRefreshInstances = useCallback(() => {
    void loadInstances({ forceRefresh: true });
  }, [loadInstances]);
  const handleGenerateQrClick = useCallback(async () => {
  const timelineItems = useMemo(() => {
    if (!instance) {
      return [];
    }

    const metadata =
      instance.metadata && typeof instance.metadata === 'object' ? instance.metadata : {};
    const historyEntries = Array.isArray(metadata.history) ? metadata.history : [];

    const normalizedHistory = historyEntries
      .map((entry, index) => {
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
      .filter(Boolean);

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

  useEffect(() => {
    if (!canSynchronize) {
      return;
    }
    void loadInstances({ forceRefresh: true });
  }, [canSynchronize, selectedAgreement?.id]);

  useEffect(() => {
    setQrPanelOpen(localStatus !== 'connected');
  }, [localStatus]);

  useEffect(() => {
    setCampaign(activeCampaign || null);
  }, [activeCampaign]);


  useEffect(() => {
    if (!selectedAgreement) {
      setCampaign(null);
    }
  }, [selectedAgreement?.id]);

  useEffect(() => {
    loadingInstancesRef.current = loadingInstances;
  }, [loadingInstances]);

  useEffect(() => {
    loadingQrRef.current = loadingQr;
  }, [loadingQr]);

  useEffect(() => {
    generatingQrRef.current = isGeneratingQrImage;
  }, [isGeneratingQrImage]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId;

    const resolveNextDelay = (result) => {
      if (!result || result.success || result.skipped) {
        return DEFAULT_POLL_INTERVAL_MS;
      }

      const retryAfterMs = parseRetryAfterMs(result.error?.retryAfter);
      if (retryAfterMs !== null) {
        return retryAfterMs > 0 ? retryAfterMs : DEFAULT_POLL_INTERVAL_MS;
      }

      if (result.error?.status === 429) {
        return RATE_LIMIT_COOLDOWN_MS;
      }

      return DEFAULT_POLL_INTERVAL_MS;
    };

    const scheduleNext = (delay = DEFAULT_POLL_INTERVAL_MS) => {
      if (cancelled) {
        return;
      }

      const normalizedDelay =
        typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
          ? delay
          : DEFAULT_POLL_INTERVAL_MS;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(runPoll, normalizedDelay);
    };

    const runPoll = async () => {
      if (cancelled) {
        return;
      }

      if (loadingInstancesRef.current || loadingQrRef.current || generatingQrRef.current) {
        scheduleNext(DEFAULT_POLL_INTERVAL_MS);
        return;
      }

      const result = await Promise.resolve()
        .then(() => loadInstancesRef.current?.())
        .catch((error) => ({ success: false, error }));

      if (cancelled) {
        return;
      }

      const delay = resolveNextDelay(result);
      scheduleNext(delay);
    };

    runPoll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedAgreement?.id, isAuthenticated]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setStatus('qr_required');
        onStatusChange?.('disconnected');
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange]);

  const handleCreateInstance = () => {
    setErrorMessage(null);
    setCreateInstanceOpen(true);
  };

  const submitCreateInstance = async ({ name, id }) => {
    const normalizedName = `${name ?? ''}`.trim();
    if (!normalizedName) {
      const error = new Error('Informe um nome válido para a nova instância.');
      setErrorMessage(error.message);
      throw error;
    }

    const normalizedId =
      typeof id === 'string'
        ? id
        : id === null || typeof id === 'undefined'
          ? ''
          : `${id}`;

    try {
      await createInstanceAction({ name: normalizedName, id: normalizedId });
      setCreateInstanceOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível criar uma nova instância';
      setErrorMessage(message);
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const createCampaign = async ({ name, instanceId, status = 'active' }) => {
    if (!selectedAgreement?.id) {
      throw new Error('Vincule um convênio antes de criar campanhas.');
    }

    const normalizedName = `${name ?? ''}`.trim();
    if (!instanceId) {
      const error = new Error('Escolha a instância que será vinculada à campanha.');
      setCampaignError(error.message);
      throw error;
    }

    const targetInstance =
      instances.find((entry) => entry && entry.id === instanceId) ?? null;
    const brokerId =
      targetInstance && targetInstance.metadata && typeof targetInstance.metadata === 'object'
        ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
        : null;

    setCampaignError(null);
    setCampaignAction({ id: null, type: 'create' });

    try {
      const payload = await apiPost('/api/campaigns', {
        agreementId: selectedAgreement.id,
        agreementName: selectedAgreement.name,
        instanceId,
        ...(brokerId ? { brokerId } : {}),
        name: normalizedName || `${selectedAgreement.name} • ${instanceId}`,
        status,
      });

      const createdCampaign = payload?.data ?? null;

      await loadCampaignsRef.current?.({
        preferredAgreementId: selectedAgreement.id,
        preferredCampaignId: createdCampaign?.id ?? null,
        preferredInstanceId: createdCampaign?.instanceId ?? instance?.id ?? null,
      });
      toast.success('Campanha criada com sucesso.');
      return createdCampaign;
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível criar a campanha');
      setCampaignError(message);
      logError('Falha ao criar campanha WhatsApp', err);
      toast.error('Falha ao criar campanha', { description: message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const updateCampaignStatus = async (target, nextStatus) => {
    if (!target?.id) {
      return;
    }

    setCampaignError(null);
    setCampaignAction({ id: target.id, type: nextStatus });

    try {
      await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
        status: nextStatus,
      });

      await loadCampaignsRef.current?.({
        preferredAgreementId: selectedAgreement?.id ?? null,
        preferredCampaignId: target?.id ?? null,
        preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
      });
      toast.success(
        nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.'
      );
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível atualizar a campanha');
      setCampaignError(message);
      toast.error('Falha ao atualizar campanha', { description: message });
      logError('Falha ao atualizar status da campanha', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const deleteCampaign = async (target) => {
    if (!target?.id) {
      return;
    }

    setCampaignError(null);
    setCampaignAction({ id: target.id, type: 'delete' });
    const currentCampaignId = campaign?.id ?? null;

    try {
      await apiDelete(`/api/campaigns/${encodeURIComponent(target.id)}`);
      await loadCampaignsRef.current?.({
        preferredAgreementId: selectedAgreement?.id ?? null,
        preferredCampaignId: currentCampaignId === target.id ? null : currentCampaignId,
        preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
      });
      toast.success('Campanha removida com sucesso.');
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível remover a campanha');
      setCampaignError(message);
      toast.error('Falha ao remover campanha', { description: message });
      logError('Falha ao remover campanha WhatsApp', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const reassignCampaign = async (target, requestedInstanceId) => {
  const pickCurrentInstance = (
    list,
    { preferredInstanceId, campaignInstanceId } = {}
  ) => {
    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const findMatch = (targetId) => {
      if (!targetId) {
        return null;
      }
      return (
        list.find((item) => item.id === targetId || item.name === targetId) || null
      );
    };

    const preferredMatch = findMatch(preferredInstanceId);
    if (preferredMatch) {
      return preferredMatch;
    }

    const campaignMatch = findMatch(campaignInstanceId);
    if (campaignMatch) {
      return campaignMatch;
    }

    const connected = list.find((item) => item.connected === true);
    return connected || list[0];
  };

  const connectInstance = async (instanceId = null, options = {}) => {
    if (!instanceId) {
      throw new Error('ID da instância é obrigatório para iniciar o pareamento.');
    }

    const encodedId = encodeURIComponent(instanceId);
    const { phoneNumber: rawPhoneNumber = null, code: rawCode = null } = options ?? {};
    const trimmedPhone =
      typeof rawPhoneNumber === 'string' && rawPhoneNumber.trim().length > 0
        ? rawPhoneNumber.trim()
        : null;
    const trimmedCode =
      typeof rawCode === 'string' && rawCode.trim().length > 0 ? rawCode.trim() : null;

    if (rawPhoneNumber !== null && !trimmedPhone) {
      throw new Error('Informe um telefone válido para parear por código.');
    }

    const shouldRequestPairing = Boolean(trimmedPhone || trimmedCode);

    const response = shouldRequestPairing
      ? await apiPost(
          `/api/integrations/whatsapp/instances/${encodedId}/pair`,
          {
            ...(trimmedPhone ? { phoneNumber: trimmedPhone } : {}),
            ...(trimmedCode ? { code: trimmedCode } : {}),
          }
        )
      : await apiGet(`/api/integrations/whatsapp/instances/${encodedId}/status`);
    setSessionActive(true);
    setAuthDeferred(false);

    const parsed = parseInstancesPayload(response);

    const resolvedInstanceId = parsed.instanceId || instanceId || null;
    const resolvedStatus = parsed.status || (parsed.connected === false ? 'disconnected' : null);
    const resolvedConnected =
      typeof parsed.connected === 'boolean'
        ? parsed.connected
        : resolvedStatus
        ? resolvedStatus === 'connected'
        : null;

    let instance = parsed.instance;
    if (instance && resolvedInstanceId && instance.id !== resolvedInstanceId) {
      instance = { ...instance, id: resolvedInstanceId };
    } else if (!instance && resolvedInstanceId) {
      instance = {
        id: resolvedInstanceId,
        status: resolvedStatus ?? undefined,
        connected: resolvedConnected ?? undefined,
      };
    }

    const instances = ensureArrayOfObjects(parsed.instances);

    return {
      instanceId: resolvedInstanceId,
      status: resolvedStatus,
      connected: resolvedConnected,
      qr: parsed.qr,
      instance: instance
        ? {
            ...instance,
            status: resolvedStatus ?? instance.status,
            connected:
              typeof resolvedConnected === 'boolean'
                ? resolvedConnected
                : typeof instance.connected === 'boolean'
                ? instance.connected
                : undefined,
          }
        : null,
      instances,
    };
  };

  const loadInstances = async (options = {}) => {
    const {
      connectResult: providedConnect,
      preferredInstanceId: explicitPreferredInstanceId,
      forceRefresh,
    } = options;
    const hasExplicitPreference = Object.prototype.hasOwnProperty.call(
      options,
      'preferredInstanceId'
    );
    const resolvedPreferredInstanceId = hasExplicitPreference
      ? explicitPreferredInstanceId
      : preferredInstanceIdRef.current ?? null;
    const agreementId = selectedAgreement?.id ?? null;
    const token = getAuthToken();
    setAuthTokenState(token);
    if (!hasFetchedOnceRef.current) {
      setInstancesReady(false);
    }
    setLoadingInstances(true);
    setErrorMessage(null);
    try {
      log('🚀 Iniciando sincronização de instâncias WhatsApp', {
        tenantAgreement: selectedAgreement?.id ?? null,
        preferredInstanceId: resolvedPreferredInstanceId ?? null,
      });
      const shouldForceBrokerSync =
        typeof forceRefresh === 'boolean' ? forceRefresh : true;

      log('🛰️ Solicitando lista de instâncias', {
        agreementId,
        forceRefresh: shouldForceBrokerSync,
        hasFetchedOnce: hasFetchedOnceRef.current,
      });
      const instancesUrl = '/api/integrations/whatsapp/instances?refresh=1';
      const response = await apiGet(instancesUrl);
      const parsedResponse = parseInstancesPayload(response);
      setSessionActive(true);
      setAuthDeferred(false);
      let list = ensureArrayOfObjects(parsedResponse.instances);
      let hasServerList = true;
      let connectResult = providedConnect || null;

      if (list.length === 0 && !shouldForceBrokerSync) {
        const refreshed = await apiGet(instancesUrl).catch(
          () => null
        );
        if (refreshed) {
          const parsedRefreshed = parseInstancesPayload(refreshed);
          const refreshedList = ensureArrayOfObjects(parsedRefreshed.instances);
          if (refreshedList.length > 0) {
            list = refreshedList;
          }
        }
      }

      if (list.length === 0) {
        const fallbackInstanceId =
          resolvedPreferredInstanceId || campaign?.instanceId || null;
        if (fallbackInstanceId) {
          connectResult = connectResult || (await connectInstance(fallbackInstanceId));
        } else {
          warn('Nenhuma instância padrão disponível para conexão automática', {
            agreementId,
            preferredInstanceId: resolvedPreferredInstanceId ?? null,
            campaignInstanceId: campaign?.instanceId ?? null,
          });
        }

        if (connectResult?.instances?.length) {
          list = ensureArrayOfObjects(connectResult.instances);
        } else if (connectResult?.instance) {
          list = ensureArrayOfObjects([connectResult.instance]);
        }
      }

      const preferenceOptions = {
        preferredInstanceId: resolvedPreferredInstanceId,
        campaignInstanceId: campaign?.instanceId ?? null,
      };

      let current = pickCurrentInstance(list, preferenceOptions);

      if (!current && connectResult?.instance) {
        current = connectResult.instance;
      }

      if (current && (connectResult?.status || connectResult?.instance)) {
        const merged = {
          ...current,
          ...(connectResult?.instance ? connectResult.instance : {}),
          status: connectResult.status ?? current.status,
          connected:
            typeof connectResult?.connected === 'boolean'
              ? connectResult.connected
              : typeof current.connected === 'boolean'
              ? current.connected
              : false,
        };
        current = merged;
        list = list.map((item) => (item.id === merged.id ? { ...item, ...merged } : item));
      } else if (connectResult?.instance) {
        const candidate = connectResult.instance;
        list = list.map((item) => (item.id === candidate.id ? { ...item, ...candidate } : item));
      }

      const normalizedList = normalizeInstancesCollection(list);
      list = normalizedList;

      if (current) {
        const normalizedCurrent = normalizedList.find((item) => item.id === current.id);
        if (normalizedCurrent) {
          current = { ...normalizedCurrent, ...current };
          list = normalizedList.map((item) => (item.id === current.id ? { ...item, ...current } : item));
        } else {
          current = pickCurrentInstance(normalizedList, preferenceOptions);
        }
      } else {
        current = pickCurrentInstance(normalizedList, preferenceOptions);
      }

      if (!current && connectResult?.instance) {
        const normalizedConnect = normalizedList.find(
          (item) => item.id === connectResult.instance.id
        );
        current = normalizedConnect || connectResult.instance;
      }

      const resolvedTotal = Array.isArray(list) ? list.length : instances.length;

      hasFetchedOnceRef.current = true;

      if (Array.isArray(list) && list.length > 0) {
        setInstances(list);
        setInstance(current);
        preferredInstanceIdRef.current = current?.id ?? null;
        persistInstancesCache(list, current?.id ?? null);
      } else if (hasServerList) {
        setInstances([]);
        setInstance(null);
        preferredInstanceIdRef.current = null;
        clearInstancesCache();
      } else {
        warn('Servidor não retornou instâncias; reutilizando cache local', {
          agreementId,
          preferredInstanceId: resolvedPreferredInstanceId ?? null,
        });
      }

      const statusFromInstance =
        connectResult?.status ||
        (typeof connectResult?.connected === 'boolean'
          ? connectResult.connected
            ? 'connected'
            : 'disconnected'
          : null) ||
        current?.status ||
        'disconnected';
      setAuthDeferred(false);
      setLocalStatus(statusFromInstance);
      onStatusChange?.(statusFromInstance);

      const connectQr = connectResult?.qr;
      const shouldShowQrFromConnect =
        connectResult && connectResult.connected === false && Boolean(connectQr?.qrCode);

      if (shouldShowQrFromConnect) {
        setQrData(connectQr);
      } else if (current && statusFromInstance !== 'connected') {
        await generateQr(current.id, { skipStatus: Boolean(connectResult) });
      } else {
        setQrData(null);
        setSecondsLeft(null);
      }
      log('✅ Instâncias sincronizadas', {
        total: resolvedTotal,
        status: statusFromInstance,
        instanceId: current?.id ?? null,
        forceRefresh: shouldForceBrokerSync,
      });
      return { success: true, status: statusFromInstance };
    } catch (err) {
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.code ?? err?.code;
      const isMissingInstanceError = status === 404 || errorCode === 'INSTANCE_NOT_FOUND';

      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
      } else if (!isMissingInstanceError) {
        applyErrorMessageFromError(
          err,
          'Não foi possível carregar status do WhatsApp'
        );
        if (!isMissingInstanceError) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Não foi possível carregar status do WhatsApp'
          );
        } else {
          setErrorMessage(null);
        }
      }
      warn('Instâncias não puderam ser carregadas', err);
      return { success: false, error: err, skipped: isAuthError(err) };
    } finally {
      setLoadingInstances(false);
      setInstancesReady(true);
    }
  };
  loadInstancesRef.current = loadInstances;

  const handleDeleteInstance = async (target) => {
    if (!target?.id) {
      return;
    }
    onContinue?.();
  }, [canContinue, onContinue]);

  const handleSelectInstance = useCallback(
    async (item, { skipAutoQr = false } = {}) => {
      if (!item) {
    setCampaignError(null);
    setCampaignAction({ id: target.id, type: 'reassign' });

    try {
      if (requestedInstanceId === target.instanceId) {
        const error = new Error('Selecione uma opção diferente para concluir ou escolha desvincular a campanha.');
        setCampaignError(error.message);
        throw error;
      }

      await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
        instanceId: requestedInstanceId ?? null,
      });

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
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha');
      setCampaignError(message);
      toast.error('Falha ao reatribuir campanha', { description: message });
      logError('Falha ao reatribuir campanha WhatsApp', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const fetchCampaignImpact = async (campaignId) => {
    if (!campaignId) {
      return { summary: null };
    }

    try {
      const response = await apiGet(
        `/api/lead-engine/allocations?campaignId=${encodeURIComponent(campaignId)}`
      );
      const summary = response?.meta?.summary ?? null;
      return { summary, items: Array.isArray(response?.data) ? response.data : [] };
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
      }
      throw err instanceof Error ? err : new Error('Falha ao carregar impacto da campanha');
    const agreementId = selectedAgreement?.id;
    setDeletingInstanceId(target.id);
    try {
      const encodedId = encodeURIComponent(target.id);
      const isJid = looksLikeWhatsAppJid(target.id);
      const url = isJid
        ? `/api/integrations/whatsapp/instances/${encodedId}/disconnect`
        : `/api/integrations/whatsapp/instances/${encodedId}`;
      const method = isJid ? 'POST' : 'DELETE';

      log(isJid ? '🔌 Desconectando instância WhatsApp' : '🗑️ Removendo instância WhatsApp', {
        instanceId: target.id,
        agreementId,
        method,
        url,
      });

      if (isJid) {
        await apiPost(url, {});
      } else {
        await apiDelete(url);
      }
      clearInstancesCache();
      if (instance?.id === target.id) {
        setInstance(null);
        preferredInstanceIdRef.current = null;
        setLocalStatus('disconnected');
      }
      await loadInstances({ preferredInstanceId: null, forceRefresh: true });
      log(isJid ? '✅ Sessão desconectada' : '✅ Instância removida', {
        instanceId: target.id,
        agreementId,
        method,
        url,
      });
      toast.success(isJid ? 'Sessão desconectada com sucesso' : 'Instância removida com sucesso');
    } catch (err) {
      const friendly = applyErrorMessageFromError(
        err,
        'Não foi possível remover a instância'
      );
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
      }
      const encodedId = encodeURIComponent(target.id);
      const isJid = looksLikeWhatsAppJid(target.id);
      const url = isJid
        ? `/api/integrations/whatsapp/instances/${encodedId}/disconnect`
        : `/api/integrations/whatsapp/instances/${encodedId}`;
      const method = isJid ? 'POST' : 'DELETE';

      const statusCode =
        typeof err?.response?.status === 'number'
          ? err.response.status
          : typeof err?.status === 'number'
            ? err.status
            : null;
      const responseData = err?.response?.data ?? err?.payload ?? null;
      const errorCode =
        (responseData && typeof responseData === 'object' && responseData !== null
          ? responseData.error?.code || responseData.code
          : null) || err?.code || null;
      const isInstanceMissing =
        statusCode === 404 ||
        errorCode === 'INSTANCE_NOT_FOUND' ||
        errorCode === 'BROKER_INSTANCE_NOT_FOUND';

      if (isInstanceMissing) {
        const nextCurrentId = instance?.id === target.id ? null : instance?.id ?? null;
        warn('Instância não encontrada no servidor; removendo localmente', {
          agreementId,
          instanceId: target.id,
          method,
          url,
          statusCode,
          errorCode,
        });
        clearInstancesCache();
        setInstances((prev) => {
          const nextList = Array.isArray(prev)
            ? prev.filter((item) => item && item.id !== target.id)
            : [];
          preferredInstanceIdRef.current = nextCurrentId;
          persistInstancesCache(nextList, nextCurrentId);
          return nextList;
        });
        if (instance?.id === target.id) {
          setInstance(null);
          preferredInstanceIdRef.current = null;
          setLocalStatus('disconnected');
        }
        await loadInstances({ preferredInstanceId: nextCurrentId, forceRefresh: true });
        toast.success('Instância removida com sucesso.');
        return;
      }

      handleInstanceSelect(item);

      if (campaign && campaign.instanceId && campaign.instanceId !== item.id) {
        clearCampaignSelection();
      }

      if (skipAutoQr) {
        return;
      }

      if (item.status !== 'connected') {
        await generateQrForInstance(item.id, { skipStatus: false });
      } else {
        resetQrState();
      }
    },
    [campaign, clearCampaignSelection, generateQrForInstance, handleInstanceSelect, resetQrState]
  );

  const handleViewQrInstance = useCallback(
    async (item) => {
      if (!item) {
        return;
      }
        applyErrorMessageFromError(err, 'Não foi possível gerar o QR Code');
      }
    } finally {
      setLoadingQr(false);
    }
  };

  const handlePairingPhoneChange = (event) => {
    const value = typeof event?.target?.value === 'string' ? event.target.value : '';
    setPairingPhoneInput(value);
    if (pairingPhoneError) {
      setPairingPhoneError(null);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!instance?.id) {
      setPairingPhoneError('Selecione uma instância para solicitar o pareamento por código.');
      return;
    }

    const trimmed = pairingPhoneInput.trim();
    if (!trimmed) {
      setPairingPhoneError('Informe o telefone que receberá o código.');
      return;
    }

    setPairingPhoneError(null);
    setRequestingPairingCode(true);
    try {
      const result = await connectInstance(instance.id, { phoneNumber: trimmed });
      await loadInstances({
        connectResult: result || undefined,
        preferredInstanceId: instance.id,
        forceRefresh: true,
      });
      toast.success(
        'Solicitamos o código de pareamento. Abra o WhatsApp oficial e informe o código recebido para concluir a conexão.'
      );
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        return;
      }

      const isValidationError =
        err?.payload?.error?.code === 'VALIDATION_ERROR' || err?.code === 'VALIDATION_ERROR';
      const friendly = resolveFriendlyError(
        err,
        'Não foi possível solicitar o pareamento por código. Verifique o telefone informado e tente novamente.'
      );
      setPairingPhoneError(friendly.message);
      if (!isValidationError) {
        setErrorMessage(friendly.message, {
          code: friendly.code,
          title: friendly.title ?? 'Falha ao solicitar pareamento por código',
        });
      }
    } finally {
      setRequestingPairingCode(false);
    }
  };

  const handleInstanceSelect = async (inst, { skipAutoQr = false } = {}) => {
    if (!inst) return;

    if (campaign && campaign.instanceId !== inst.id) {
      clearCampaignSelection();
    }

    await selectInstance(inst, { skipAutoQr });
  };

  const handleViewQr = async (inst) => {
    if (!inst) return;
    await selectInstance(inst, { skipAutoQr: true });
    await generateQr(inst.id);
    setQrDialogOpen(true);
  };

  const handleGenerateQr = async () => {
    if (!instance?.id) return;
    await generateQr(instance.id);
  }, [generateQr, instance?.id]);

  const handleViewQrDialog = useCallback(
    async (inst) => {
      await handleViewQr(inst);
    },
    [handleViewQr]
  );

  const handleCreateInstanceOpen = useCallback(() => {
    clearError();
    setCreateInstanceOpen(true);
  }, [clearError]);

  const handleMarkConnected = async () => {
    const success = await markConnected();
    if (success) {
      setQrDialogOpen(false);
    }
  };

  const handleDeleteInstance = async (target) => {
    if (!target?.id) {
      return;
    }

    await deleteInstanceAction(target);
    setInstancePendingDelete(null);
  };

  const handleConfirm = () => {
    if (!canContinue) {
      return;
    }
    onContinue?.();
  };

      await handleSelectInstance(item, { skipAutoQr: true });
      await generateQrForInstance(item.id, { skipStatus: true });
      setQrDialogOpen(true);
    },
    [generateQrForInstance, handleSelectInstance, setQrDialogOpen]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span>Próximo: {nextStage}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{onboardingDescription}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <Badge variant="status" tone={statusTone} className="gap-2 text-xs font-medium">
              {copy.badge}
            </Badge>
            <div className="flex flex-col items-end gap-1">
              <span>
                Convênio:{' '}
                <span className="font-medium text-foreground">{agreementDisplayName}</span>
              </span>
              {!hasAgreement ? (
                <span className="text-[0.7rem] text-muted-foreground/80">
                  Convênios e campanhas podem ser definidos depois — avance quando estiver pronto.
                </span>
              ) : null}
            </div>
            {countdownMessage ? (
              <span className="flex items-center gap-1 text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {countdownMessage}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos convênios
          </Button>
          <Separator className="section-divider flex-1" />
          <span>{copy.description}</span>
        </div>
      </header>

      {persistentWarning ? (
        <NoticeBanner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <p>{persistentWarning}</p>
          <p className="text-xs text-amber-200/80">
            Os leads continuam chegando normalmente; campanhas ajudam apenas no roteamento avançado e podem ser criadas quando achar necessário.
          </p>
        </NoticeBanner>
      ) : null}

      <div className="space-y-6">
        <InstancesPanel
          surfaceStyles={surfaceStyles}
          hasAgreement={hasAgreement}
          nextStage={nextStage}
          agreementDisplayName={agreementDisplayName}
          selectedAgreementRegion={agreementRegion}
          selectedAgreementId={agreementId}
          selectedInstance={instance}
          selectedInstanceStatusInfo={selectedInstanceStatusInfo}
          selectedInstancePhone={selectedInstancePhone}
          hasCampaign={hasCampaign}
          campaign={campaign}
          instancesReady={instancesReady}
          hasHiddenInstances={hasHiddenInstances}
          hasRenderableInstances={hasRenderableInstances}
          renderInstances={renderInstances}
          showFilterNotice={showFilterNotice}
          showAllInstances={showAllInstances}
          instancesCountLabel={instancesCountLabel}
          errorState={errorState}
          isBusy={isBusy}
          isAuthenticated={isAuthenticated}
          loadingInstances={loadingInstances}
          copy={copy}
          localStatus={localStatus}
          confirmLabel={confirmLabel}
          confirmDisabled={confirmDisabled}
          onConfirm={() => void handleConfirm()}
          onMarkConnected={() => void handleMarkConnected()}
          onRefresh={() => void handleRefreshInstances()}
          onCreateInstance={() => void handleCreateInstanceOpen()}
          onToggleShowAll={() => setShowAllInstances((current) => !current)}
          onShowAll={() => setShowAllInstances(true)}
          onRetry={() => void loadInstances({ forceRefresh: true })}
          onSelectInstance={(item) => void handleInstanceSelect(item)}
          onViewQr={(item) => void handleViewQrDialog(item)}
          onSelectInstance={(item) => void handleSelectInstance(item)}
          onViewQr={(item) => void handleViewQrInstance(item)}
          onRequestDelete={(item) => setInstancePendingDelete(item)}
          deletingInstanceId={deletingInstanceId}
          statusCodeMeta={statusCodeMeta}
          getStatusInfo={getStatusInfo}
          getInstanceMetrics={getInstanceMetricsHelper}
          formatMetricValue={formatMetricValueHelper}
          resolveInstancePhone={resolveInstancePhone}
          formatPhoneNumber={formatPhoneNumberHelper}
        />
        <CampaignsPanel
          agreementName={selectedAgreement?.name ?? null}
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignError}
          onRefresh={() =>
            void loadCampaigns({
              preferredAgreementId: selectedAgreement?.id ?? null,
              preferredCampaignId: campaign?.id ?? null,
              preferredInstanceId: instance?.id ?? null,
            })
          }
          onCreateClick={() => setCreateCampaignOpen(true)}
          onPause={(entry) => void updateCampaignStatus(entry, 'paused')}
          onActivate={(entry) => void updateCampaignStatus(entry, 'active')}
          onDelete={(entry) => void deleteCampaign(entry)}
          onReassign={(entry) => {
            setReassignIntent('reassign');
            setPendingReassign(entry);
          }}
          onDisconnect={(entry) => {
            setReassignIntent('disconnect');
            setPendingReassign(entry);
          }}
          actionState={campaignAction}
          selectedInstanceId={instance?.id ?? null}
          canCreateCampaigns={hasAgreement}
          selectedAgreementId={selectedAgreement?.id ?? null}
        />
        <QrSection
          surfaceStyles={surfaceStyles}
          open={qrPanelOpen}
          onOpenChange={setQrPanelOpen}
          qrImageSrc={qrImageSrc}
          isGeneratingQrImage={isGeneratingQrImage}
          qrStatusMessage={qrStatusMessage}
          onGenerate={handleGenerateQrClick}
          onGenerate={generateQr}
          onOpenQrDialog={() => setQrDialogOpen(true)}
          generateDisabled={isBusy || !instance || !isAuthenticated}
          openDisabled={!hasQr}
          pairingPhoneInput={pairingPhoneInput}
          onPairingPhoneChange={handlePairingPhoneChange}
          pairingDisabled={pairingDisabled}
          requestingPairingCode={requestingPairingCode}
          onRequestPairingCode={() => void handleRequestPairingCode()}
          pairingPhoneError={pairingPhoneError}
          timelineItems={timelineItems}
          realtimeConnected={realtimeConnected}
          humanizeLabel={humanizeLabelHelper}
          formatPhoneNumber={formatPhoneNumberHelper}
          formatTimestampLabel={formatTimestampLabelHelper}
        />
      </div>

      <CreateInstanceDialog
        open={isCreateInstanceOpen}
        onOpenChange={setCreateInstanceOpen}
        defaultName={defaultInstanceName}
        onSubmit={async (payload) => {
          await submitCreateInstance(payload);
        }}
      />

      <CreateCampaignDialog
        open={isCreateCampaignOpen}
        onOpenChange={setCreateCampaignOpen}
        agreement={selectedAgreement}
        instances={instances}
        defaultInstanceId={instance?.id ?? null}
        onSubmit={async (payload) => {
          await createCampaign(payload);
        }}
      />

      <ReassignCampaignDialog
        open={Boolean(pendingReassign)}
        campaign={pendingReassign}
        instances={instances}
        intent={reassignIntent}
        onClose={(open) => {
          if (!open) {
            setPendingReassign(null);
            setReassignIntent('reassign');
          }
        }}
        onSubmit={async ({ instanceId }) => {
          if (!pendingReassign) {
            return;
          }
          await reassignCampaign(pendingReassign, instanceId);
          setPendingReassign(null);
          setReassignIntent('reassign');
        }}
        fetchImpact={fetchCampaignImpact}
      />

      <AlertDialog
        open={Boolean(instancePendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setInstancePendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removalDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {removalTargetIsJid ? (
                <>
                  Esta ação desconecta a sessão <strong>{removalTargetLabel}</strong>. Utilize quando precisar encerrar um dispositivo sincronizado com o broker.
                </>
              ) : (
                <>
                  Esta ação remove permanentemente a instância <strong>{removalTargetLabel}</strong>. Verifique se não há campanhas ativas utilizando este número.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInstancePendingDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!instancePendingDelete) return;
                await handleDeleteInstance(instancePendingDelete);
                setInstancePendingDelete(null);
              }}
            >
              {removalDialogAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={qrImageModalOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Use o aplicativo do WhatsApp para escanear o código abaixo e vincular esta instância com o LeadEngine.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <QrPreview
              illustrationClassName={surfaceStyles.qrIllustration}
              src={qrImageSrc}
              isGenerating={isGeneratingQrImage}
              size={64}
            />
            <p className="text-center text-sm text-muted-foreground">
              Abra o WhatsApp &gt; Configurações &gt; Dispositivos Conectados &gt; Conectar dispositivo e escaneie o QR Code exibido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnect;
