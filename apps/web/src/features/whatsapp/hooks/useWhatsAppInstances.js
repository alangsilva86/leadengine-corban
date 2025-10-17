import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toDataURL as generateQrDataUrl } from 'qrcode';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';

import usePlayfulLogger from '../shared/usePlayfulLogger.js';
import useOnboardingStepLabel from '../onboarding/useOnboardingStepLabel.js';
import useInstanceLiveUpdates from './useInstanceLiveUpdates.js';

import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import {
  clearInstancesCache,
  ensureArrayOfObjects,
  normalizeInstancesCollection,
  parseInstancesPayload,
  persistInstancesCache,
  readInstancesCache,
  shouldDisplayInstance,
} from '../utils/instances.js';
import { getInstanceMetrics } from '../utils/metrics.js';
import {
  formatMetricValue,
  formatPhoneNumber,
  formatTimestampLabel,
  humanizeLabel,
} from '../utils/formatting.js';
import { extractQrPayload, getQrImageSrc } from '../utils/qr.js';

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

const DEFAULT_POLL_INTERVAL_MS = 15_000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

const looksLikeWhatsAppJid = (value) =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

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

const useQrImageSource = (qrPayload) => {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const [src, setSrc] = useState(immediate ?? null);
  const [isGenerating, setIsGenerating] = useState(Boolean(needsGeneration && !immediate));

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
    generateQrDataUrl(code, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 })
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

const useWhatsAppInstances = ({
  agreement,
  status: initialStatus = 'disconnected',
  onboarding,
  activeCampaign,
  onStatusChange,
}) => {
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const pollIdRef = useRef(0);
  const loadInstancesRef = useRef(() => {});
  const hasFetchedOnceRef = useRef(false);
  const loadingInstancesRef = useRef(false);
  const loadingQrRef = useRef(false);
  const generatingQrRef = useRef(false);
  const preferredInstanceIdRef = useRef(null);

  const [instances, setInstances] = useState([]);
  const [instance, setInstance] = useState(null);
  const [instancesReady, setInstancesReady] = useState(false);
  const [showAllInstances, setShowAllInstances] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [pairingPhoneError, setPairingPhoneError] = useState(null);
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [authDeferred, setAuthDeferred] = useState(false);
  const [authTokenState, setAuthTokenState] = useState(() => getAuthToken());
  const [errorState, setErrorState] = useState(null);
  const [localStatus, setLocalStatus] = useState(initialStatus);
  const [qrPanelOpen, setQrPanelOpen] = useState(initialStatus !== 'connected');
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);
  const [deletingInstanceId, setDeletingInstanceId] = useState(null);
  const [instancePendingDelete, setInstancePendingDelete] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [isCreateInstanceOpen, setCreateInstanceOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(null);
  const [reassignIntent, setReassignIntent] = useState('reassign');

  const enforceAuthMessage =
    'Não foi possível sincronizar as instâncias de WhatsApp no momento. Tente novamente em instantes.';

  const setErrorMessage = useCallback((message, meta = {}) => {
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
  }, []);

  const isAuthError = useCallback((error) => {
    const status = typeof error?.status === 'number' ? error.status : null;
    return status === 401 || status === 403;
  }, []);

  const handleAuthFallback = useCallback(
    ({ reset = false, error: errorCandidate = null } = {}) => {
      setLoadingInstances(false);
      setLoadingQr(false);
      const status =
        typeof errorCandidate?.status === 'number'
          ? errorCandidate.status
          : typeof errorCandidate?.response?.status === 'number'
            ? errorCandidate.response.status
            : null;
      const shouldDisplayWarning = status === 401 || status === 403;

      if (shouldDisplayWarning || reset) {
        setErrorMessage(enforceAuthMessage, {
          title: 'Sincronização necessária',
        });
      } else if (!authTokenState) {
        setErrorMessage(null);
      }
      if (reset) {
        setInstances([]);
        setInstance(null);
        clearInstancesCache();
        preferredInstanceIdRef.current = null;
        setLocalStatus('disconnected');
        setQrData(null);
        setSecondsLeft(null);
        setInstancesReady(true);
        setAuthTokenState(null);
      }
    },
    [authTokenState, enforceAuthMessage, setErrorMessage]
  );

  const enforceAuthPrompt = useCallback(() => {
    handleAuthFallback({ reset: true });
  }, [handleAuthFallback]);

  const applyErrorMessageFromError = useCallback(
    (error, fallbackMessage, meta = {}) => {
      const friendly = resolveFriendlyError(error, fallbackMessage);
      setErrorMessage(friendly.message, {
        ...meta,
        code: friendly.code ?? meta.code,
        title: friendly.title ?? meta.title,
      });
      return friendly;
    },
    [setErrorMessage]
  );

  useEffect(() => {
    const cached = readInstancesCache();
    if (!cached) {
      setInstancesReady(false);
      preferredInstanceIdRef.current = null;
      return;
    }

    const list = Array.isArray(cached.list) ? cached.list : [];
    if (list.length > 0) {
      const current = cached.currentId
        ? list.find((item) => item.id === cached.currentId) || list[0]
        : list[0];
      setInstances(list);
      setInstance(current ?? null);
      preferredInstanceIdRef.current = current?.id ?? null;
      if (current?.status) {
        setLocalStatus(current.status);
      }
      setInstancesReady(true);
    } else {
      setInstancesReady(false);
      preferredInstanceIdRef.current = null;
    }
    hasFetchedOnceRef.current = false;
  }, [agreement?.id]);

  useEffect(() => {
    setPairingPhoneInput('');
    setPairingPhoneError(null);
  }, [instance?.id, agreement?.id]);

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'whatsapp',
    fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Inbox de Leads' },
  });

  const hasAgreement = Boolean(agreement?.id);
  const agreementName = agreement?.name ?? null;
  const agreementDisplayName = agreementName ?? 'Nenhum convênio selecionado';

  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);
  generatingQrRef.current = isGeneratingQrImage;
  const hasQr = Boolean(qrImageSrc);
  const canSynchronize = sessionActive && !authDeferred;
  const isAuthenticated = canSynchronize && Boolean(authTokenState);
  const canContinue = localStatus === 'connected' && Boolean(instance);
  const statusTone = copy.tone || STATUS_TONES.fallback;
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || requestingPairingCode;
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
  const renderInstances = showAllInstances ? instances : visibleInstances;
  const instancesCountLabel = instancesReady
    ? showAllInstances
      ? `${totalInstanceCount} instância(s)`
      : `${visibleInstanceCount} ativa(s)`
    : 'Sincronizando…';
  const hasRenderableInstances = renderInstances.length > 0;
  const showFilterNotice = instancesReady && hasHiddenInstances && !showAllInstances;

  const handleRealtimeEvent = useCallback((event) => {
    if (!event || typeof event !== 'object' || !event.payload) {
      return;
    }

    const payload = event.payload;
    const eventInstanceId =
      payload.id || payload.instanceId || payload.brokerId || payload.sessionId || null;

    if (!eventInstanceId) {
      return;
    }

    const timestampCandidate =
      (typeof payload.syncedAt === 'string' && payload.syncedAt) ||
      (typeof payload.timestamp === 'string' && payload.timestamp) ||
      new Date().toISOString();

    const statusCandidate = (() => {
      if (typeof payload.status === 'string') {
        return payload.status;
      }
      if (payload.status && typeof payload.status === 'object') {
        if (typeof payload.status.current === 'string') {
          return payload.status.current;
        }
        if (typeof payload.status.status === 'string') {
          return payload.status.status;
        }
      }
      return null;
    })();

    const connectedCandidate = (() => {
      if (typeof payload.connected === 'boolean') {
        return payload.connected;
      }
      if (payload.status && typeof payload.status === 'object') {
        if (typeof payload.status.connected === 'boolean') {
          return payload.status.connected;
        }
      }
      return null;
    })();

    const phoneCandidate = (() => {
      if (typeof payload.phoneNumber === 'string') {
        return payload.phoneNumber;
      }
      if (payload.metadata && typeof payload.metadata === 'object') {
        const metadata = payload.metadata;
        if (typeof metadata.phoneNumber === 'string') {
          return metadata.phoneNumber;
        }
        if (typeof metadata.phone_number === 'string') {
          return metadata.phone_number;
        }
        if (typeof metadata.msisdn === 'string') {
          return metadata.msisdn;
        }
      }
      return null;
    })();

    setLiveEvents((previous) => {
      const next = [
        {
          id: `${event.type}-${eventInstanceId}-${timestampCandidate}`,
          instanceId: eventInstanceId,
          type: typeof event.type === 'string' && event.type ? event.type : 'updated',
          status: statusCandidate,
          connected: connectedCandidate,
          phoneNumber: phoneCandidate,
          timestamp: timestampCandidate,
        },
        ...previous,
      ];

      const seen = new Set();
      const deduped = [];
      for (const entry of next) {
        const key = `${entry.instanceId}-${entry.timestamp}-${entry.type}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(entry);
        if (deduped.length >= 30) {
          break;
        }
      }

      return deduped;
    });
  }, []);

  const tenantRoomId = agreement?.tenantId ?? agreement?.id ?? null;

  const { connected: realtimeConnected } = useInstanceLiveUpdates({
    tenantId: tenantRoomId,
    enabled: Boolean(tenantRoomId),
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    setLiveEvents([]);
  }, [agreement?.id]);

  const timelineItems = useMemo(() => {
    if (!instance) {
      return [];
    }

    const metadata = instance.metadata && typeof instance.metadata === 'object' ? instance.metadata : {};
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
    void loadInstancesRef.current?.({ forceRefresh: true });
  }, []);

  useEffect(() => {
    if (!canSynchronize) {
      setInstancesReady(true);
      return;
    }
    void loadInstancesRef.current?.({ forceRefresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreement?.id, canSynchronize]);

  useEffect(() => {
    loadingInstancesRef.current = loadingInstances;
  }, [loadingInstances]);

  useEffect(() => {
    loadingQrRef.current = loadingQr;
  }, [loadingQr]);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId = null;
    let cancelled = false;

    const scheduleNext = (delay) => {
      if (cancelled) {
        return;
      }

      if (typeof delay !== 'number' || Number.isNaN(delay)) {
        delay = DEFAULT_POLL_INTERVAL_MS;
      }

      if (delay <= 0) {
        delay = DEFAULT_POLL_INTERVAL_MS;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(runPoll, delay);
    };

    const resolveNextDelay = (result) => {
      if (!result || typeof result !== 'object') {
        return DEFAULT_POLL_INTERVAL_MS;
      }
      if (result.skipped) {
        return DEFAULT_POLL_INTERVAL_MS;
      }
      if (result.success) {
        return DEFAULT_POLL_INTERVAL_MS;
      }
      if (result.error?.status === 429) {
        const retryAfter = parseRetryAfterMs(result.error?.response?.headers?.['retry-after']);
        if (retryAfter !== null) {
          return Math.max(RATE_LIMIT_COOLDOWN_MS, retryAfter);
        }
      }
      return DEFAULT_POLL_INTERVAL_MS;
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
      controller.abort();
    };
  }, [agreement?.id, isAuthenticated]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setLocalStatus('qr_required');
        onStatusChange?.('disconnected');
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange]);

  const pickCurrentInstance = useCallback(
    (
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
        return list.find((item) => item.id === targetId || item.name === targetId) || null;
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
    },
    []
  );

  const connectInstance = useCallback(
    async (instanceId = null, options = {}) => {
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
        ? await apiPost(`/api/integrations/whatsapp/instances/${encodedId}/pair`, {
            ...(trimmedPhone ? { phoneNumber: trimmedPhone } : {}),
            ...(trimmedCode ? { code: trimmedCode } : {}),
          })
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

      let resolvedInstance = parsed.instance;
      if (resolvedInstance && resolvedInstanceId && resolvedInstance.id !== resolvedInstanceId) {
        resolvedInstance = { ...resolvedInstance, id: resolvedInstanceId };
      } else if (!resolvedInstance && resolvedInstanceId) {
        resolvedInstance = {
          id: resolvedInstanceId,
          status: resolvedStatus ?? undefined,
          connected: resolvedConnected ?? undefined,
        };
      }

      const normalizedInstances = ensureArrayOfObjects(parsed.instances);

      return {
        instanceId: resolvedInstanceId,
        status: resolvedStatus,
        connected: resolvedConnected,
        qr: parsed.qr,
        instance: resolvedInstance
          ? {
              ...resolvedInstance,
              status: resolvedStatus ?? resolvedInstance.status,
              connected:
                typeof resolvedConnected === 'boolean'
                  ? resolvedConnected
                  : typeof resolvedInstance.connected === 'boolean'
                    ? resolvedInstance.connected
                    : undefined,
            }
          : null,
        instances: normalizedInstances,
      };
    },
    []
  );

  const loadInstances = useCallback(
    async (options = {}) => {
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
      const agreementId = agreement?.id ?? null;
      const token = getAuthToken();
      setAuthTokenState(token);
      if (!hasFetchedOnceRef.current) {
        setInstancesReady(false);
      }
      setLoadingInstances(true);
      setErrorMessage(null);
      try {
        log('🚀 Iniciando sincronização de instâncias WhatsApp', {
          tenantAgreement: agreement?.id ?? null,
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
          const refreshed = await apiGet(instancesUrl).catch(() => null);
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
            resolvedPreferredInstanceId || activeCampaign?.instanceId || null;
          if (fallbackInstanceId) {
            connectResult = connectResult || (await connectInstance(fallbackInstanceId));
          } else {
            warn('Nenhuma instância padrão disponível para conexão automática', {
              agreementId,
              preferredInstanceId: resolvedPreferredInstanceId ?? null,
              campaignInstanceId: activeCampaign?.instanceId ?? null,
            });
          }

          if (connectResult?.instances?.length) {
            list = ensureArrayOfObjects(connectResult.instances);
          } else if (connectResult?.instance) {
            list = ensureArrayOfObjects([connectResult.instance]);
          }

          hasServerList = Boolean(list.length);
        }

        if (!hasServerList && !connectResult) {
          const fallbackId = resolvedPreferredInstanceId || activeCampaign?.instanceId || null;
          if (fallbackId) {
            connectResult = await connectInstance(fallbackId).catch(() => null);
            if (connectResult?.instances?.length) {
              list = ensureArrayOfObjects(connectResult.instances);
              hasServerList = true;
            }
          }
        }

        const normalizedList = normalizeInstancesCollection(list);

        const currentInstance = pickCurrentInstance(normalizedList, {
          preferredInstanceId: resolvedPreferredInstanceId,
          campaignInstanceId: activeCampaign?.instanceId ?? null,
        });

        setInstances(normalizedList);
        setInstance(currentInstance);
        preferredInstanceIdRef.current = currentInstance?.id ?? null;
        persistInstancesCache(normalizedList, currentInstance?.id ?? null);
        if (currentInstance?.status) {
          setLocalStatus(currentInstance.status);
          onStatusChange?.(currentInstance.status);
        }

        hasFetchedOnceRef.current = true;
        return { success: true };
      } catch (err) {
        if (isAuthError(err)) {
          handleAuthFallback({ error: err });
          return { success: false, error: err, skipped: true };
        }

        const friendly = applyErrorMessageFromError(
          err,
          'Não foi possível carregar as instâncias do WhatsApp'
        );
        setErrorMessage(friendly.message);
        warn('Instâncias não puderam ser carregadas', err);
        return { success: false, error: err };
      } finally {
        setLoadingInstances(false);
        setInstancesReady(true);
      }
    },
    [
      activeCampaign?.instanceId,
      agreement?.id,
      connectInstance,
      handleAuthFallback,
      isAuthError,
      log,
      onStatusChange,
      pickCurrentInstance,
      applyErrorMessageFromError,
      warn,
    ]
  );
  loadInstancesRef.current = loadInstances;

  const handleDeleteInstance = useCallback(
    async (target) => {
      if (!target?.id) {
        return;
      }

      const agreementId = agreement?.id;
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

        logError('Falha ao remover instância WhatsApp', {
          error: err,
          method,
          url,
          instanceId: target.id,
        });

        let bodyPreview = null;
        if (responseData && typeof responseData === 'object') {
          try {
            const serialized = JSON.stringify(responseData);
            bodyPreview = serialized.length > 200 ? `${serialized.slice(0, 197)}…` : serialized;
          } catch (serializationError) {
            console.warn(
              'Não foi possível serializar payload de erro da instância WhatsApp',
              serializationError
            );
          }
        }

        const detailParts = [
          `method=${method}`,
          `url=${url}`,
          `id=${target.id}`,
        ];

        if (statusCode !== null) {
          detailParts.push(`status=${statusCode}`);
        }
        if (errorCode) {
          detailParts.push(`code=${errorCode}`);
        }
        if (bodyPreview) {
          detailParts.push(`body=${bodyPreview}`);
        }

        const description = detailParts.join(' • ');
        toast.error('Falha ao remover instância', {
          description: friendly.message ? `${friendly.message} • ${description}` : description,
        });
      } finally {
        setDeletingInstanceId(null);
      }
    },
    [
      agreement?.id,
      applyErrorMessageFromError,
      handleAuthFallback,
      instance,
      isAuthError,
      loadInstances,
      log,
      logError,
      warn,
    ]
  );

  useEffect(() => {
    if (!activeCampaign?.instanceId || instances.length === 0) {
      return;
    }

    const matched = instances.find(
      (item) => item.id === activeCampaign.instanceId || item.name === activeCampaign.instanceId
    );

    if (!matched || instance?.id === matched.id) {
      return;
    }

    setInstance(matched);
    preferredInstanceIdRef.current = matched.id ?? null;
    persistInstancesCache(instances, matched.id ?? null);
    const statusFromInstance = matched.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);
  }, [
    activeCampaign?.instanceId,
    instance?.id,
    instances,
    onStatusChange,
    agreement?.id,
  ]);

  const generateQrInternal = useCallback(
    async (id, { skipStatus = false } = {}) => {
      if (!id) return;

      const myPollId = ++pollIdRef.current;
      setLoadingQr(true);
      setErrorMessage(null);
      try {
        const encodedId = encodeURIComponent(id);
        if (!skipStatus) {
          const connectResult = await connectInstance(id);
          const nextStatus =
            connectResult?.status ||
            (typeof connectResult?.connected === 'boolean'
              ? connectResult.connected
                ? 'connected'
                : 'disconnected'
              : null);

          if (nextStatus) {
            setLocalStatus(nextStatus);
            onStatusChange?.(nextStatus);
            setInstance((current) => {
              if (!current || current.id !== id) {
                return current;
              }
              return {
                ...current,
                status: nextStatus,
                connected:
                  typeof connectResult?.connected === 'boolean'
                    ? connectResult.connected
                    : nextStatus === 'connected'
                      ? true
                      : typeof current.connected === 'boolean'
                        ? current.connected
                        : false,
              };
            });
            setInstances((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: nextStatus,
                      connected:
                        typeof connectResult?.connected === 'boolean'
                          ? connectResult.connected
                          : nextStatus === 'connected'
                            ? true
                            : typeof item.connected === 'boolean'
                              ? item.connected
                              : false,
                    }
                  : item
              )
            );
          }

          const connectQr = connectResult?.qr;
          if (connectResult?.connected === false && connectQr?.qrCode) {
            setQrData({
              ...connectQr,
              image: `/api/integrations/whatsapp/instances/${encodedId}/qr.png?ts=${Date.now()}`,
            });
            return;
          }

          if (connectResult?.connected) {
            setQrData(null);
            setSecondsLeft(null);
            return;
          }
        }

        setLocalStatus('qr_required');
        onStatusChange?.('disconnected');

        const deadline = Date.now() + 60_000;
        let received = null;
        while (Date.now() < deadline) {
          if (pollIdRef.current !== myPollId) {
            return;
          }
          let qrResponse = null;
          try {
            qrResponse = await apiGet(
              `/api/integrations/whatsapp/instances/${encodedId}/qr`
            );
          } catch (qrError) {
            if (isAuthError(qrError)) {
              handleAuthFallback({ error: qrError });
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            continue;
          }

          const parsedQr = extractQrPayload(qrResponse);
          if (parsedQr?.qrCode) {
            received = parsedQr;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }

        if (!received) {
          setErrorMessage(
            'Não foi possível gerar o QR Code. Tente novamente em instantes.',
            {
              title: 'QR Code indisponível',
            }
          );
          return;
        }

        setQrData({
          ...received,
          image: `/api/integrations/whatsapp/instances/${encodedId}/qr.png?ts=${Date.now()}`,
        });
      } catch (err) {
        if (isAuthError(err)) {
          handleAuthFallback({ error: err });
          return;
        }
        const friendly = applyErrorMessageFromError(
          err,
          'Não foi possível gerar o QR Code. Tente novamente em instantes.',
          {
            title: 'QR Code indisponível',
          }
        );
        toast.error(friendly.message, {
          description: friendly.title,
        });
      } finally {
        setLoadingQr(false);
      }
    },
    [
      applyErrorMessageFromError,
      connectInstance,
      handleAuthFallback,
      isAuthError,
      onStatusChange,
    ]
  );

  const generateQrForInstance = useCallback(
    (id, options) => generateQrInternal(id, options),
    [generateQrInternal]
  );

  const handleGenerateQr = useCallback(() => {
    if (!instance?.id) {
      setErrorMessage('Selecione uma instância antes de gerar o QR Code.');
      return;
    }

    void generateQrInternal(instance.id, { skipStatus: false });
  }, [generateQrInternal, instance?.id, setErrorMessage]);

  const handleViewQr = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      setInstance(item);
      preferredInstanceIdRef.current = item.id;
      persistInstancesCache(instances, item.id);
      setQrPanelOpen(true);
      setQrDialogOpen(true);
      void generateQrInternal(item.id, { skipStatus: true });
    },
    [generateQrInternal, instances]
  );

  const resetQrState = useCallback(() => {
    setQrData(null);
    setSecondsLeft(null);
  }, []);

  const handleInstanceSelect = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      setInstance(item);
      preferredInstanceIdRef.current = item.id;
      persistInstancesCache(instances, item.id);
      if (item.status) {
        setLocalStatus(item.status);
        onStatusChange?.(item.status);
      }
    },
    [instances, onStatusChange]
  );

  const handleCreateInstance = useCallback(() => {
    setCreateInstanceOpen(true);
  }, []);

  const submitCreateInstance = useCallback(
    async (payload) => {
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      const normalizedName = name.length > 0 ? name : defaultInstanceName;

      const agreementId = agreement?.id ?? null;
      const payloadBody = {
        ...payload,
        name: normalizedName,
        agreementId,
      };

      setLoadingInstances(true);
      setErrorMessage(null);

      try {
        log('🧪 Criando nova instância WhatsApp', {
          agreementId: agreement?.id ?? null,
          name: normalizedName,
        });

        const response = await apiPost('/api/integrations/whatsapp/instances', payloadBody);
        setSessionActive(true);
        const parsedCreate = parseInstancesPayload(response);
        const createdInstance = parsedCreate?.instance ?? null;
        const createdInstanceId = createdInstance?.id ?? createdInstance?.instanceId ?? null;
        const resolvedCreatedInstance = createdInstance
          ? {
              ...createdInstance,
              name: createdInstance.name ?? normalizedName,
              displayName:
                createdInstance.displayName ||
                createdInstance.label ||
                createdInstance.metadata?.displayName ||
                normalizedName,
              label: createdInstance.label ?? createdInstance.displayName ?? undefined,
            }
          : null;

        let connectResult = null;

        if (createdInstanceId) {
          try {
            const startResult = await connectInstance(createdInstanceId);
            if (startResult) {
              connectResult = {
                ...startResult,
                instance: {
                  ...(resolvedCreatedInstance || {}),
                  ...(startResult.instance || {}),
                },
              };
            }
          } catch (startError) {
            console.warn('Não foi possível iniciar a instância recém-criada', startError);
          }
        }

        await loadInstances({
          preferredInstanceId: createdInstanceId,
          connectResult: connectResult || undefined,
          forceRefresh: true,
        });

        if (resolvedCreatedInstance) {
          setInstance(resolvedCreatedInstance);
          preferredInstanceIdRef.current = resolvedCreatedInstance.id ?? null;
          persistInstancesCache(instances, resolvedCreatedInstance.id ?? null);
        }

        toast.success('Instância criada com sucesso. Escaneie o QR Code para concluir a conexão.');
        setCreateInstanceOpen(false);
      } catch (err) {
        if (isAuthError(err)) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const friendly = resolveFriendlyError(
          err,
          'Não foi possível criar a instância. Tente novamente em instantes.'
        );
        setErrorMessage(friendly.message);
        logError('Falha ao criar instância WhatsApp', err);
        const errorToThrow = err instanceof Error ? err : new Error(friendly.message);
        throw errorToThrow;
      } finally {
        setLoadingInstances(false);
      }
    },
    [
      agreement?.id,
      connectInstance,
      defaultInstanceName,
      handleAuthFallback,
      instances,
      isAuthError,
      loadInstances,
      log,
      logError,
      setErrorMessage,
    ]
  );

  const handleMarkConnected = useCallback(async () => {
    if (!instance?.id) return;
    try {
      const status = await apiGet(`/api/integrations/whatsapp/instances/${instance.id}/status`);
      setSessionActive(true);
      setAuthDeferred(false);
      const parsed = parseInstancesPayload(status);
      const connected =
        typeof parsed.connected === 'boolean'
          ? parsed.connected
          : parsed.status === 'connected';

      if (parsed.instance) {
        setInstance((current) =>
          current && current.id === parsed.instance.id ? { ...current, ...parsed.instance } : current
        );
        setInstances((prev) =>
          prev.map((item) =>
            item.id === parsed.instance.id ? { ...item, ...parsed.instance } : item
          )
        );
      }

      if (!connected) {
        setErrorMessage(
          'A instância ainda não está conectada. Escaneie o QR e tente novamente.'
        );
        return;
      }
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        return;
      }
    }
    setLocalStatus('connected');
    setQrData(null);
    setSecondsLeft(null);
    setQrDialogOpen(false);
    onStatusChange?.('connected');
  }, [handleAuthFallback, instance?.id, isAuthError, onStatusChange, setErrorMessage]);

  const removalTargetLabel =
    instancePendingDelete?.name ||
    instancePendingDelete?.displayId ||
    instancePendingDelete?.id ||
    'selecionada';
  const removalTargetIsJid = instancePendingDelete?.id
    ? looksLikeWhatsAppJid(instancePendingDelete.id)
    : false;
  const removalDialogTitle = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';
  const removalDialogAction = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';

  const handlePairingPhoneChange = useCallback((event) => {
    const value = event?.target?.value ?? '';
    setPairingPhoneInput(value);
    setPairingPhoneError(null);
  }, []);

  const handleRequestPairingCode = useCallback(async () => {
    if (!instance?.id) {
      setPairingPhoneError('Selecione uma instância para solicitar o código.');
      return;
    }

    const input = pairingPhoneInput.trim();
    if (!input) {
      setPairingPhoneError('Informe o telefone que receberá o código.');
      return;
    }

    const normalized = input.replace(/\D/g, '');
    if (normalized.length < 10) {
      setPairingPhoneError('Informe um telefone válido com DDD.');
      return;
    }

    setRequestingPairingCode(true);
    setPairingPhoneError(null);

    try {
      await apiPatch(`/api/integrations/whatsapp/instances/${instance.id}/pairing`, {
        phoneNumber: normalized,
      });
      toast.success('Código solicitado com sucesso. Confira o WhatsApp para confirmar.');
    } catch (err) {
      const friendly = resolveFriendlyError(
        err,
        'Não foi possível solicitar o código. Tente novamente em instantes.'
      );
      setPairingPhoneError(friendly.message);
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
      }
    } finally {
      setRequestingPairingCode(false);
    }
  }, [
    handleAuthFallback,
    instance?.id,
    isAuthError,
    pairingPhoneInput,
  ]);

  const syncCampaignSelection = useCallback(
    (campaign) => {
      if (!campaign?.instanceId || instances.length === 0) {
        return;
      }

      const matched = instances.find(
        (item) => item.id === campaign.instanceId || item.name === campaign.instanceId
      );

      if (!matched || instance?.id === matched.id) {
        return;
      }

      setInstance(matched);
      preferredInstanceIdRef.current = matched.id ?? null;
      persistInstancesCache(instances, matched.id ?? null);
      const statusFromInstance = matched.status || 'disconnected';
      setLocalStatus(statusFromInstance);
      onStatusChange?.(statusFromInstance);
    },
    [instance?.id, instances, onStatusChange]
  );

  return {
    log,
    warn,
    logError,
    surfaceStyles: SURFACE_COLOR_UTILS,
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
    agreementRegion: agreement?.region ?? null,
    agreementId: agreement?.id ?? null,
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
    setInstance,
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
    handleViewQr,
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
    qrImageModalOpen: isQrDialogOpen,
    setQrDialogOpen,
    timelineItems,
    realtimeConnected,
    pairingPhoneInput,
    handlePairingPhoneChange,
    pairingPhoneError,
    requestingPairingCode,
    handleRequestPairingCode,
    enforceAuthPrompt,
    handleAuthFallback,
    isAuthError,
    syncCampaignSelection,
    generateQr: handleGenerateQr,
    generateQrForInstance,
    resetQrState,
    canContinue,
  };
};

export default useWhatsAppInstances;
