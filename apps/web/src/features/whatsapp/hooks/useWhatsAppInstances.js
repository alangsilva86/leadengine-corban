import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';
import useInstanceLiveUpdates from './useInstanceLiveUpdates.js';
import {
  clearInstancesCache,
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';

import useInstanceLiveUpdates from './useInstanceLiveUpdates.js';
import {
  buildTimelineEntries,
  ensureAgreementMeta,
  mapToNormalizedInstances,
  reconcileInstancesState,
  reduceRealtimeEvents,
  resolveFriendlyError,
  resolveInstancePhone,
  selectPreferredInstance,
  filterDisplayableInstances,
} from '../utils/instanceSync.js';

import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import { looksLikeWhatsAppJid, resolveInstancePhone } from '../utils/instanceIdentifiers.js';
import {
  clearInstancesCache,
  persistInstancesCache,
  readInstancesCache,
  parseInstancesPayload,
  shouldDisplayInstance,
  ensureArrayOfObjects,
} from '../utils/instances.js';
import { resolveWhatsAppErrorCopy as defaultResolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';

const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

const ensureObject = (value) => (value && typeof value === 'object' ? value : {});

const extractAgreementIdentifiers = (agreement) => ({
  id: agreement?.id ?? null,
  tenantId: agreement?.tenantId ?? null,
  name: agreement?.name ?? null,
  region: agreement?.region ?? null,
});
} from '../utils/instances.js';
import { getInstanceMetrics } from '../utils/metrics.js';
import {
  formatMetricValue,
  formatPhoneNumber,
  formatTimestampLabel,
  humanizeLabel,
} from '../utils/formatting.js';
import { resolveWhatsAppErrorCopy as defaultResolveCopy } from '../utils/whatsapp-error-codes.js';

const DEFAULT_POLL_INTERVAL_MS = 15_000;
const MAX_LIVE_EVENTS = 30;

const isAuthError = (error) => {
  const status = typeof error?.status === 'number' ? error.status : error?.response?.status;
  return status === 401 || status === 403;
import { extractQrPayload } from '../utils/qr.js';

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
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';
import sessionStorageAvailable from '@/lib/session-storage.js';
import useInstanceLiveUpdates from './useInstanceLiveUpdates.js';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';

const INSTANCES_CACHE_KEY = 'leadengine:whatsapp:instances';
const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

const readInstancesCache = () => {
  if (!sessionStorageAvailable()) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(INSTANCES_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Não foi possível ler o cache de instâncias WhatsApp', error);
    return null;
  }
};

const persistInstancesCache = (list, currentId) => {
  if (!sessionStorageAvailable()) {
    return;
  }
  try {
    sessionStorage.setItem(
      INSTANCES_CACHE_KEY,
      JSON.stringify({
        list,
        currentId,
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn('Não foi possível armazenar o cache de instâncias WhatsApp', error);
  }
};

const clearInstancesCache = () => {
  if (!sessionStorageAvailable()) {
    return;
  }
  sessionStorage.removeItem(INSTANCES_CACHE_KEY);
};

const ensureArrayOfObjects = (value) =>
  Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];

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

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const buildTimelineEntries = (instance, liveEvents = []) => {
  if (!instance) {
    return [];
  }

  const metadata = ensureObject(instance.metadata);
  const historyEntries = ensureArray(metadata.history);

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
};

const resolveFriendlyError = (resolveCopy, error, fallbackMessage) => {
  const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
  const rawMessage =
    error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
  const copy = resolveCopy(codeCandidate, rawMessage ?? fallbackMessage);
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

  const [instances, setInstances] = useState([]);
  const [instance, setInstance] = useState(null);
  const [instancesReady, setInstancesReady] = useState(false);
  const [showAllInstances, setShowAllInstances] = useState(false);
const formatInstanceDisplayId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  if (looksLikeWhatsAppJid(value)) {
    return value.replace(/@s\.whatsapp\.net$/i, '@wa');
  }
  return value;
};

export default function useWhatsAppInstances({
  agreement,
  selectedAgreement,
  status: externalStatus = 'disconnected',
  onStatusChange,
  onError,
  onAuthFallback,
  toast,
  logger = {},
  formatters = {},
  campaignHelpers = {},
  campaignInstanceId = null,
} = {}) {
  const agreementSource = agreement ?? selectedAgreement ?? null;
  const agreementMeta = useMemo(() => ensureAgreementMeta(agreementSource), [agreementSource]);

  const resolveCopy = formatters.resolveWhatsAppErrorCopy ?? defaultResolveCopy;
  const formatMetricValueFn = formatters.formatMetricValue ?? formatMetricValue;
  const formatTimestampLabelFn = formatters.formatTimestampLabel ?? formatTimestampLabel;
  const formatPhoneNumberFn = formatters.formatPhoneNumber ?? formatPhoneNumber;
  const humanizeLabelFn = formatters.humanizeLabel ?? humanizeLabel;
  const getInstanceMetricsFn = formatters.getInstanceMetrics ?? getInstanceMetrics;
  const logFn = typeof logger?.log === 'function' ? logger.log : null;

  const initialStatus = externalStatus ?? 'disconnected';

  const [instances, setInstances] = useState([]);
  const [instance, setInstance] = useState(null);
  const [instancesReady, setInstancesReady] = useState(false);
  const [showAllInstances, setShowAllInstances] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [isQrImageGenerating, setQrImageGenerating] = useState(false);
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

  const preferredInstanceIdRef = useRef(null);
  const pollIdRef = useRef(0);

  const updateStatus = useCallback(
    (value) => {
      const resolved = value ?? 'disconnected';
      setLocalStatus(resolved);
      onStatusChange?.(resolved);
    },
    [onStatusChange]
  );

  useEffect(() => {
    updateStatus(externalStatus ?? 'disconnected');
  }, [externalStatus, updateStatus]);

  useEffect(() => {
    setQrPanelOpen(localStatus !== 'connected');
  }, [localStatus]);

  const normalizeOptions = useMemo(
    () => ({
      allowedTenants: agreementMeta.tenantId ? [agreementMeta.tenantId] : [],
      filterByTenant: Boolean(agreementMeta.tenantId),
    }),
    [agreementMeta.tenantId]
  );

  const applyInstancesState = useCallback(
    (list, current, statusValue) => {
      setInstances(list);
      setInstancesReady(true);
      const resolvedCurrent = current ?? selectPreferredInstance(list, {
        preferredInstanceId: preferredInstanceIdRef.current,
        campaignInstanceId,
      });
      setInstance(resolvedCurrent ?? null);

      if (list.length > 0) {
        const nextPreferred = resolvedCurrent?.id ?? list[0].id ?? null;
        preferredInstanceIdRef.current = nextPreferred;
        persistInstancesCache(list, nextPreferred);
      } else {
        preferredInstanceIdRef.current = null;
        clearInstancesCache();
      }

      updateStatus(statusValue ?? resolvedCurrent?.status ?? 'disconnected');
    },
    [campaignInstanceId, updateStatus]
  );

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const handleAuthFallback = useCallback(
    ({ reset = false, error: authError = null } = {}) => {
      setSessionActive(false);
      setAuthDeferred(true);
      if (reset) {
        setInstances([]);
        setInstance(null);
        setInstancesReady(false);
        setQrData(null);
        setSecondsLeft(null);
        preferredInstanceIdRef.current = null;
        clearInstancesCache();
        updateStatus('disconnected');
      }
      onAuthFallback?.({ reset, error: authError });
    },
    [onAuthFallback, updateStatus]
  );

  const handleApiFailure = useCallback(
    (error, fallbackMessage) => {
      const friendly = resolveFriendlyError(resolveCopy, error, fallbackMessage);
      setErrorState(friendly);
      onError?.(friendly.message, friendly);
      if (isAuthError(error)) {
        handleAuthFallback({ reset: false, error });
      }
      return friendly;
    },
    [handleAuthFallback, onError, resolveCopy]
  );

  useEffect(() => {
    const cached = readInstancesCache();
    if (!cached) {
      setInstancesReady(false);
      preferredInstanceIdRef.current = null;
      return;
    }

    const list = mapToNormalizedInstances(cached.list ?? [], normalizeOptions);
    if (list.length === 0) {
      setInstancesReady(false);
      preferredInstanceIdRef.current = null;
      return;
    }

    const current = selectPreferredInstance(list, {
      preferredInstanceId: cached.currentId ?? null,
      campaignInstanceId,
    });

    setInstances(list);
    setInstance(current ?? list[0]);
    preferredInstanceIdRef.current = current?.id ?? list[0]?.id ?? null;
    setInstancesReady(true);
    updateStatus(current?.status ?? localStatus ?? 'disconnected');
  }, [campaignInstanceId, normalizeOptions, updateStatus, localStatus]);

  const tenantRoomId = agreementMeta.tenantId ?? agreementMeta.id ?? null;

  const handleRealtimeEvent = useCallback(
    (event) => {
      setLiveEvents((previous) => reduceRealtimeEvents(previous, event, MAX_LIVE_EVENTS));
    },
    []
  );

  const { connected: realtimeConnected } = useInstanceLiveUpdates({
    tenantId: tenantRoomId,
    enabled: Boolean(tenantRoomId),
    onEvent: handleRealtimeEvent,
    pollInterval: DEFAULT_POLL_INTERVAL_MS,
  });

  useEffect(() => {
    setLiveEvents([]);
  }, [agreementMeta.id]);

  const timelineItems = useMemo(
    () => buildTimelineEntries(instance, liveEvents),
    [instance, liveEvents]
  );

  const loadInstances = useCallback(
    async ({ forceRefresh = true, connectResult = null } = {}) => {
      const pollId = ++pollIdRef.current;
      setLoadingInstances(true);

      const query = forceRefresh ? '?refresh=1' : '';
      const url = `/api/integrations/whatsapp/instances${query}`;
      logFn?.('whatsapp:loadInstances', { forceRefresh });

      try {
        const response = await apiGet(url);
        if (pollId !== pollIdRef.current) {
          return null;
        }

        const parsed = parseInstancesPayload(response);
        const normalizedList = mapToNormalizedInstances(parsed.instances ?? [], normalizeOptions);
        const normalizedInstance = parsed.instance
          ? mapToNormalizedInstances([parsed.instance], normalizeOptions)[0] ?? null
          : null;

        const updates = connectResult
          ? {
              instances: mapToNormalizedInstances(connectResult.instances ?? [], normalizeOptions),
              instance: connectResult.instance ?? null,
              status: connectResult.status,
              connected: connectResult.connected,
            }
          : {
              instances: normalizedList,
              instance: normalizedInstance,
              status: parsed.status,
              connected: parsed.connected,
            };

        const nextState = reconcileInstancesState(normalizedList, updates, {
          preferredInstanceId:
            connectResult?.instance?.id ??
            parsed.instanceId ??
            preferredInstanceIdRef.current,
          campaignInstanceId,
          normalizeOptions,
        });

        applyInstancesState(nextState.instances, nextState.current, nextState.status);
        setSessionActive(true);
        setAuthDeferred(false);
        setAuthTokenState(getAuthToken());
        return nextState;
      } catch (error) {
        handleApiFailure(error, 'Não foi possível sincronizar as instâncias de WhatsApp.');
        throw error;
      } finally {
        if (pollId === pollIdRef.current) {
          setLoadingInstances(false);
        }
      }
    },
    [applyInstancesState, campaignInstanceId, handleApiFailure, normalizeOptions]
  );

  const connectInstance = useCallback(
    async (instanceId, options = {}) => {
      if (!instanceId) {
        throw new Error('ID da instância é obrigatório para iniciar o pareamento.');
      }

      const encodedId = encodeURIComponent(instanceId);
      const trimmedPhone =
        typeof options.phoneNumber === 'string' && options.phoneNumber.trim().length > 0
          ? options.phoneNumber.trim()
          : null;
      const trimmedCode =
        typeof options.code === 'string' && options.code.trim().length > 0
          ? options.code.trim()
          : null;

      const shouldRequestPairing = Boolean(trimmedPhone || trimmedCode);
      logFn?.('whatsapp:connectInstance', { instanceId, shouldRequestPairing });

      try {
        const response = shouldRequestPairing
          ? await apiPost(`/api/integrations/whatsapp/instances/${encodedId}/pair`, {
              ...(trimmedPhone ? { phoneNumber: trimmedPhone } : {}),
              ...(trimmedCode ? { code: trimmedCode } : {}),
            })
          : await apiGet(`/api/integrations/whatsapp/instances/${encodedId}/status`);

        const parsed = parseInstancesPayload(response);
        const normalizedUpdates = mapToNormalizedInstances(parsed.instances ?? [], normalizeOptions);
        const normalizedInstance = parsed.instance
          ? mapToNormalizedInstances([parsed.instance], normalizeOptions)[0] ?? null
          : null;

        const nextState = reconcileInstancesState(instances, {
          instances: normalizedUpdates,
          instance: normalizedInstance,
          status: parsed.status,
          connected: parsed.connected,
        }, {
          preferredInstanceId: instanceId,
          campaignInstanceId,
          normalizeOptions,
        });

        applyInstancesState(nextState.instances, nextState.current, nextState.status);
        setSessionActive(true);
        setAuthDeferred(false);
        setAuthTokenState(getAuthToken());
        return { ...parsed, ...nextState };
      } catch (error) {
        handleApiFailure(error, 'Não foi possível atualizar a instância selecionada.');
        throw error;
      }
    },
    [applyInstancesState, campaignInstanceId, handleApiFailure, instances, normalizeOptions]
  );

  const generateQr = useCallback(
    async (instanceId) => {
      if (!instanceId) {
        throw new Error('É necessário informar uma instância para gerar o QR Code.');
      }

      setLoadingQr(true);
      try {
        const encodedId = encodeURIComponent(instanceId);
        const response = await apiGet(`/api/integrations/whatsapp/instances/${encodedId}/qr`);
        const parsed = parseInstancesPayload(response);
        setQrData(parsed.qr ?? null);
        setSecondsLeft(
          typeof parsed.qr?.expiresAt === 'number' ? parsed.qr.expiresAt : null
        );
        return parsed.qr ?? null;
      } catch (error) {
        handleApiFailure(error, 'Não foi possível gerar o QR Code para esta instância.');
        throw error;
      } finally {
        setLoadingQr(false);
      }
    },
    [handleApiFailure]
  );

  const createInstance = useCallback(
    async (payload = {}) => {
      try {
        const response = await apiPost('/api/integrations/whatsapp/instances', payload);
        const parsed = parseInstancesPayload(response);
        const normalizedList = mapToNormalizedInstances(parsed.instances ?? [], normalizeOptions);
        const normalizedInstance = parsed.instance
          ? mapToNormalizedInstances([parsed.instance], normalizeOptions)[0] ?? null
          : null;

        const nextState = reconcileInstancesState(instances, {
          instances: normalizedList,
          instance: normalizedInstance,
          status: parsed.status,
          connected: parsed.connected,
        }, {
          preferredInstanceId: normalizedInstance?.id ?? null,
          campaignInstanceId,
          normalizeOptions,
        });

        applyInstancesState(nextState.instances, nextState.current, nextState.status);
        toast?.success?.('Instância criada com sucesso.');
        return nextState.current;
      } catch (error) {
        handleApiFailure(error, 'Não foi possível criar a instância de WhatsApp.');
        throw error;
      }
    },
    [applyInstancesState, campaignInstanceId, handleApiFailure, instances, normalizeOptions, toast]
  );

  const deleteInstance = useCallback(
    async (instanceId) => {
      if (!instanceId) {
        return;
      }

      setDeletingInstanceId(instanceId);
      try {
        const encodedId = encodeURIComponent(instanceId);
        await apiDelete(`/api/integrations/whatsapp/instances/${encodedId}`);
        const filtered = instances.filter((item) => item.id !== instanceId);
        const nextCurrent =
          instanceId === instance?.id
            ? selectPreferredInstance(filtered, {
                preferredInstanceId: preferredInstanceIdRef.current,
                campaignInstanceId,
              })
            : instance;

        applyInstancesState(filtered, nextCurrent, nextCurrent?.status ?? localStatus);
        toast?.success?.('Instância removida com sucesso.');
      } catch (error) {
        handleApiFailure(error, 'Não foi possível remover a instância selecionada.');
        throw error;
      } finally {
        setDeletingInstanceId(null);
      }
    },
    [applyInstancesState, campaignInstanceId, handleApiFailure, instance, instances, localStatus, toast]
  );

  const markConnected = useCallback(
    (instanceId) => {
      if (!instanceId) {
        return;
      }

      const nextList = instances.map((item) =>
        item.id === instanceId
          ? { ...item, status: 'connected', connected: true }
          : item
      );

      const current =
        instanceId === instance?.id
          ? { ...instance, status: 'connected', connected: true }
          : instance;

      applyInstancesState(nextList, current, 'connected');
    },
    [applyInstancesState, instance, instances]
  );

  const handleInstanceSelect = useCallback(
    async (targetId) => {
      if (!targetId) {
        return;
      }
      const selected = instances.find((item) => item.id === targetId) ?? null;
      if (!selected) {
        return;
      }
      applyInstancesState(instances, selected, selected.status ?? localStatus);
      campaignHelpers.clearCampaignSelection?.();
    },
    [applyInstancesState, campaignHelpers, instances, localStatus]
  );

  const handleViewQr = useCallback(
    async (targetId = null) => {
      const resolvedId = targetId ?? instance?.id ?? null;
      if (!resolvedId) {
        return null;
      }
      const qr = await generateQr(resolvedId);
      setQrDialogOpen(true);
      return qr;
    },
    [generateQr, instance]
  );

  const submitCreateInstance = useCallback(
    async (payload) => {
      await createInstance(payload);
      setShowAllInstances(true);
    },
    [createInstance]
  );

  const handleDeleteInstance = useCallback(
    async (targetId) => {
      await deleteInstance(targetId);
      setInstancePendingDelete(null);
    },
    [deleteInstance]
  );

  const handleMarkConnected = useCallback(
    async (targetId) => {
      await connectInstance(targetId ?? instance?.id);
      markConnected(targetId ?? instance?.id);
    },
    [connectInstance, instance, markConnected]
  );

  const handlePairingPhoneChange = useCallback((value) => {
    setPairingPhoneInput(value);
    setPairingPhoneError(null);
  }, []);

  const handleRequestPairingCode = useCallback(
    async () => {
      const currentId = instance?.id;
      if (!currentId) {
        return null;
      }
      const trimmed = pairingPhoneInput.trim();
      if (!trimmed) {
        setPairingPhoneError('Informe um telefone válido para parear por código.');
        return null;
      }

      setPairingPhoneError(null);
      setRequestingPairingCode(true);
      try {
        return await connectInstance(currentId, { phoneNumber: trimmed });
      } finally {
        setRequestingPairingCode(false);
      }
    },
    [connectInstance, instance, pairingPhoneInput]
  );

  const canContinue = useMemo(
    () => Boolean(sessionActive && localStatus === 'connected' && instance),
    [instance, localStatus, sessionActive]
  );

  const state = {
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
    isQrImageGenerating,
    canContinue,
  };

  const actions = {
    setShowAllInstances,
    setQrPanelOpen,
    setQrDialogOpen,
    setInstancePendingDelete,
    setDeletingInstanceId,
    setInstance,
    setQrImageGenerating,
    setSecondsLeft,
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
    handleAuthFallback,
    clearError,
    createInstance,
    deleteInstance,
    markConnected,
  };

  const helpers = {
    shouldDisplayInstance: (target) => filterDisplayableInstances([target]).length > 0,
    resolveInstancePhone,
    formatMetricValue: formatMetricValueFn,
    formatTimestampLabel: formatTimestampLabelFn,
    formatPhoneNumber: formatPhoneNumberFn,
    humanizeLabel: humanizeLabelFn,
    getInstanceMetrics: getInstanceMetricsFn,
  };

  return { state, actions, helpers, ...state, ...actions, ...helpers };
}
