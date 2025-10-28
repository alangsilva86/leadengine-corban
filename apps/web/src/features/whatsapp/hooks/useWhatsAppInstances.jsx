import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext } from 'react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';
import sessionStorageAvailable from '@/lib/session-storage.js';
import useInstanceLiveUpdates from './useInstanceLiveUpdates.js';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';

const INSTANCES_CACHE_KEY = 'leadengine:whatsapp:instances';
const INSTANCES_CACHE_VERSION = 2;
const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const FORCE_REFRESH_DEBOUNCE_MS = 5 * 1000;

const noop = () => {};
const skippedResult = Object.freeze({ success: false, skipped: true });
const noopAsync = async () => skippedResult;

const EMPTY_CONTROLLER = Object.freeze({
  instances: [],
  instancesReady: false,
  currentInstance: null,
  status: 'disconnected',
  qrData: null,
  secondsLeft: null,
  loadingInstances: false,
  loadingQr: false,
  isAuthenticated: false,
  sessionActive: false,
  authDeferred: false,
  authTokenState: null,
  deletingInstanceId: null,
  liveEvents: [],
  realtimeConnected: false,
  setQrData: noop,
  setSecondsLeft: noop,
  loadInstances: noopAsync,
  selectInstance: noop,
  generateQr: noopAsync,
  connectInstance: noopAsync,
  createInstance: noopAsync,
  deleteInstance: noopAsync,
  markConnected: noop,
  handleAuthFallback: noop,
  setSessionActive: noop,
  setAuthDeferred: noop,
  setGeneratingQrState: noop,
  setStatus: noop,
});

const readInstancesCache = () => {
  if (!sessionStorageAvailable()) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(INSTANCES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const version =
      typeof parsed.schemaVersion === 'number'
        ? parsed.schemaVersion
        : typeof parsed.version === 'number'
          ? parsed.version
          : null;
    if (version !== INSTANCES_CACHE_VERSION) {
      // versão divergente, invalida
      sessionStorage.removeItem(INSTANCES_CACHE_KEY);
      return null;
    }
    return parsed;
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
        schemaVersion: INSTANCES_CACHE_VERSION,
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

const looksLikeWhatsAppJid = (value) =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

const formatInstanceDisplayId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  if (looksLikeWhatsAppJid(value)) {
    return value.replace(/@s\.whatsapp\.net$/i, '@wa');
  }
  return value;
};

const pickStringValue = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const mergeInstanceEntries = (previous, next) => {
  if (!previous) {
    return next;
  }
  const previousMetadata = isPlainRecord(previous.metadata) ? previous.metadata : {};
  const nextMetadata = isPlainRecord(next.metadata) ? next.metadata : {};
  const mergedMetadata = { ...previousMetadata, ...nextMetadata };
  return {
    ...previous,
    ...next,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    connected: Boolean(previous.connected || next.connected),
    status:
      next.status ||
      previous.status ||
      (previous.connected || next.connected ? 'connected' : 'disconnected'),
    tenantId: next.tenantId ?? previous.tenantId ?? null,
    name: next.name ?? previous.name ?? null,
    phoneNumber: next.phoneNumber ?? previous.phoneNumber ?? null,
    displayId: next.displayId || previous.displayId || next.id || previous.id,
    source: next.source || previous.source || null,
  };
};

const normalizeInstanceRecord = (entry) => {
  if (!isPlainRecord(entry)) {
    return null;
  }

  const base = entry;
  const metadata = isPlainRecord(base.metadata) ? base.metadata : {};
  const profile = isPlainRecord(base.profile) ? base.profile : {};
  const details = isPlainRecord(base.details) ? base.details : {};
  const info = isPlainRecord(base.info) ? base.info : {};
  const mergedMetadata = { ...metadata, ...profile, ...details, ...info };

  const id =
    pickStringValue(
      base.id,
      base.instanceId,
      base.instance_id,
      base.sessionId,
      base.session_id,
      mergedMetadata.id,
      mergedMetadata.instanceId,
      mergedMetadata.instance_id,
      mergedMetadata.sessionId,
      mergedMetadata.session_id
    ) ?? null;

  if (!id) {
    return null;
  }

  const rawStatus =
    pickStringValue(
      base.status,
      base.connectionStatus,
      base.state,
      mergedMetadata.status,
      mergedMetadata.state
    ) ?? null;
  const normalizedStatus = rawStatus ? rawStatus.toLowerCase() : null;

  const connectedValue =
    typeof base.connected === 'boolean'
      ? base.connected
      : typeof mergedMetadata.connected === 'boolean'
        ? mergedMetadata.connected
        : normalizedStatus === 'connected';

  const tenantId =
    pickStringValue(
      base.tenantId,
      base.tenant_id,
      mergedMetadata.tenantId,
      mergedMetadata.tenant_id,
      base.agreementId,
      mergedMetadata.agreementId,
      base.accountId,
      mergedMetadata.accountId
    ) ?? null;

  const name =
    pickStringValue(
      base.name,
      base.displayName,
      base.label,
      mergedMetadata.name,
      mergedMetadata.displayName,
      mergedMetadata.label,
      mergedMetadata.instanceName,
      mergedMetadata.sessionName,
      mergedMetadata.profileName
    ) ?? null;

  const phoneNumber =
    pickStringValue(
      base.phoneNumber,
      base.phone,
      base.number,
      mergedMetadata.phoneNumber,
      mergedMetadata.phone,
      mergedMetadata.number
    ) ?? null;

  const source =
    pickStringValue(base.source, mergedMetadata.source, mergedMetadata.origin, base.origin) ??
    (looksLikeWhatsAppJid(id) ? 'broker' : 'db');

  const normalizedStatusValue = normalizedStatus || (connectedValue ? 'connected' : 'disconnected');

  return {
    ...base,
    metadata: mergedMetadata,
    id,
    tenantId,
    name,
    phoneNumber,
    status: normalizedStatusValue,
    connected: Boolean(connectedValue),
    displayId: formatInstanceDisplayId(id),
    source,
  };
};

const normalizeInstancesCollection = (rawList, options = {}) => {
  const allowedTenants = Array.isArray(options.allowedTenants)
    ? options.allowedTenants
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  const shouldFilterByTenant =
    (options.filterByTenant === true || options.enforceTenantScope === true) &&
    allowedTenants.length > 0;

  const order = [];
  const map = new Map();

  if (!Array.isArray(rawList)) {
    return [];
  }

  for (const entry of rawList) {
    const normalized = normalizeInstanceRecord(entry);
    if (!normalized) {
      continue;
    }

    if (
      shouldFilterByTenant &&
      normalized.tenantId &&
      !allowedTenants.includes(normalized.tenantId)
    ) {
      continue;
    }

    const existing = map.get(normalized.id);
    const merged = mergeInstanceEntries(existing, normalized);

    if (!existing) {
      order.push(normalized.id);
    }

    map.set(normalized.id, merged);
  }

  return order.map((id) => map.get(id)).filter(Boolean);
};

const unwrapWhatsAppResponse = (payload) => {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (payload.data && typeof payload.data === 'object') {
      return payload.data;
    }
    if (payload.result && typeof payload.result === 'object') {
      return payload.result;
    }
  }

  return payload;
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

const parseInstancesPayload = (payload) => {
  const data = unwrapWhatsAppResponse(payload);
  const rootIsObject = data && typeof data === 'object' && !Array.isArray(data);

  let instances = [];
  if (rootIsObject && Array.isArray(data.instances)) {
    instances = ensureArrayOfObjects(data.instances);
  } else if (rootIsObject && Array.isArray(data.items)) {
    instances = ensureArrayOfObjects(data.items);
  } else if (rootIsObject && Array.isArray(data.data)) {
    instances = ensureArrayOfObjects(data.data);
  } else if (Array.isArray(data)) {
    instances = ensureArrayOfObjects(data);
  }

  const instance = extractInstanceFromPayload(rootIsObject ? data : null) || null;

  if (instance && !instances.some((item) => item && item.id === instance.id)) {
    instances = [...instances, instance];
  }

  const statusPayload = rootIsObject
    ? typeof data.status === 'object' && data.status !== null
      ? data.status
      : typeof data.instanceStatus === 'object' && data.instanceStatus !== null
        ? data.instanceStatus
        : null
    : null;

  const status =
    typeof statusPayload?.status === 'string'
      ? statusPayload.status
      : typeof data?.status === 'string'
        ? data.status
        : typeof instance?.status === 'string'
          ? instance.status
          : null;

  const connected =
    typeof statusPayload?.connected === 'boolean'
      ? statusPayload.connected
      : typeof data?.connected === 'boolean'
        ? data.connected
        : typeof instance?.connected === 'boolean'
          ? instance.connected
          : null;

  const qr = (() => {
    const candidate = rootIsObject ? data.qr || data.qrCode || data.qr_code || null : null;
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return { qr: candidate, qrCode: candidate, qrExpiresAt: null, expiresAt: null };
    }
    if (candidate && typeof candidate === 'object') {
      const qrCode = pickStringValue(candidate.qr, candidate.qrCode, candidate.code);
      const expiresAt = pickStringValue(candidate.expiresAt, candidate.qrExpiresAt);
      if (!qrCode) {
        return null;
      }
      return {
        ...candidate,
        qr: qrCode,
        qrCode,
        qrExpiresAt: expiresAt ?? candidate.expiresAt ?? null,
        expiresAt: expiresAt ?? candidate.expiresAt ?? null,
      };
    }
    return null;
  })();

  return {
    data,
    instance,
    instances,
    qr,
    status,
    connected,
    instanceId:
      typeof data?.instanceId === 'string'
        ? data.instanceId
        : typeof data?.id === 'string'
          ? data.id
          : instance?.id ?? null,
  };
};

const pickCurrentInstance = (list, { preferredInstanceId, campaignInstanceId } = {}) => {
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
};

const defaultLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function useWhatsAppInstancesController({
  selectedAgreement,
  status: initialStatus,
  onStatusChange,
  onError,
  logger,
  campaignInstanceId = null,
  autoGenerateQr = true,
  autoRefresh = false,
  pauseWhenHidden = true,
  initialFetch = false,
  __internalSkip = false,
} = {}) {
  const skipController = Boolean(__internalSkip);

  const { log, warn, error: logError } = { ...defaultLogger, ...logger };

  const [instances, setInstances] = useState([]);
  const [currentInstance, setCurrentInstance] = useState(null);
  const [instancesReady, setInstancesReady] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [authDeferred, setAuthDeferred] = useState(false);
  const [authTokenState, setAuthTokenState] = useState(() => getAuthToken());
  const [liveEvents, setLiveEvents] = useState([]);
  const [deletingInstanceId, setDeletingInstanceId] = useState(null);
  const [localStatus, setLocalStatus] = useState(initialStatus ?? 'disconnected');

  const pollIdRef = useRef(0);
  const preferredInstanceIdRef = useRef(null);
  const loadInstancesRef = useRef();
  const hasFetchedOnceRef = useRef(false);
  const loadingInstancesRef = useRef(false);
  const loadingQrRef = useRef(false);
  const generatingQrRef = useRef(false);
  const qrAbortRef = useRef(null);
  const lastForceRefreshAtRef = useRef(0);
  const rateLimitUntilRef = useRef(0);

  const isBusy = () =>
    Boolean(loadingInstancesRef.current || loadingQrRef.current || generatingQrRef.current);

  const setErrorMessage = useCallback(
    (message, meta = {}) => {
      onError?.(message, meta);
    },
    [onError]
  );

  const requireAuthMessage =
    'Não foi possível sincronizar as instâncias de WhatsApp no momento. Tente novamente em instantes.';

  const resolveFriendlyError = useCallback((error, fallbackMessage) => {
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
    [resolveFriendlyError, setErrorMessage]
  );

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
        setErrorMessage(requireAuthMessage, {
          title: 'Sincronização necessária',
        });
      } else if (!authTokenState) {
        setErrorMessage(null);
      }

      if (reset) {
        setInstances([]);
        setCurrentInstance(null);
        clearInstancesCache();
        preferredInstanceIdRef.current = null;
        setLocalStatus('disconnected');
        setQrData(null);
        setSecondsLeft(null);
        setInstancesReady(true);
        setAuthTokenState(null);
      }
    },
    [authTokenState, setErrorMessage]
  );

  useEffect(() => {
    if (skipController) {
      return undefined;
    }

    const cached = readInstancesCache();
    if (!cached) {
      setInstancesReady(false);
      preferredInstanceIdRef.current = null;
      return undefined;
    }

    const list = Array.isArray(cached.list) ? cached.list : [];
    if (list.length > 0) {
      const current = cached.currentId
        ? list.find((item) => item.id === cached.currentId) || list[0]
        : list[0];
      setInstances(list);
      setCurrentInstance(current ?? null);
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
    return undefined;
  }, [skipController, selectedAgreement?.id]);

  const setGeneratingQrState = useCallback((value) => {
    generatingQrRef.current = Boolean(value);
  }, []);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    setLocalStatus(initialStatus ?? 'disconnected');
    return undefined;
  }, [initialStatus, skipController]);

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
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
  }, [expiresAt, localStatus, onStatusChange, skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    loadingInstancesRef.current = loadingInstances;
    return undefined;
  }, [loadingInstances, skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    loadingQrRef.current = loadingQr;
    return undefined;
  }, [loadingQr, skipController]);

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

      let instance = parsed.instance;
      if (instance && resolvedInstanceId && instance.id !== resolvedInstanceId) {
        instance = { ...instance, id: resolvedInstanceId };
      } else if (!instance && resolvedInstanceId) {
        instance = {
          id: resolvedInstanceId,
          status: resolvedStatus ?? undefined,
          connected:
            typeof resolvedConnected === 'boolean'
              ? resolvedConnected
              : resolvedStatus === 'connected'
                ? true
                : undefined,
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
    },
    []
  );

  const generateQr = useCallback(
    async (id, { skipStatus = false } = {}) => {
      if (!id) return;

      generatingQrRef.current = true;
      const myPollId = ++pollIdRef.current;
      const abortController = new AbortController();
      if (qrAbortRef.current) {
        qrAbortRef.current.abort();
      }
      qrAbortRef.current = abortController;
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
            setCurrentInstance((current) => {
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
            if (qrAbortRef.current === abortController) {
              try {
                qrAbortRef.current.abort();
              } catch {}
              qrAbortRef.current = null;
            }
            setQrData(null);
            setSecondsLeft(null);
            return;
          }
        }

        setLocalStatus('qr_required');
        onStatusChange?.('disconnected');

        const deadline = Date.now() + 60_000;
        let received = null;
        let delayMs = 500;
        while (Date.now() < deadline) {
          if (pollIdRef.current !== myPollId) {
            // outro ciclo iniciou; encerra silenciosamente
            return;
          }
          let qrResponse = null;
          try {
            qrResponse = await apiGet(`/api/integrations/whatsapp/instances/${encodedId}/qr`, {
              signal: abortController.signal,
            });
            setSessionActive(true);
            setAuthDeferred(false);
          } catch (error) {
            if (error?.name === 'AbortError') {
              return;
            }
            if (isAuthError(error)) {
              handleAuthFallback({ error });
              return;
            }
          }
          const parsed = parseInstancesPayload(qrResponse);
          const qrPayload = parsed.qr;
          if (qrPayload?.qrCode) {
            received = {
              ...qrPayload,
              image: `/api/integrations/whatsapp/instances/${encodedId}/qr.png?ts=${Date.now()}`,
            };
            // se o backend forneceu expiresAt/qrExpiresAt, define secondsLeft de forma determinística
            const exp =
              (typeof qrPayload.expiresAt === 'string' && qrPayload.expiresAt) ||
              (typeof qrPayload.qrExpiresAt === 'string' && qrPayload.qrExpiresAt) ||
              null;
            if (exp) {
              const ms = new Date(exp).getTime() - Date.now();
              setSecondsLeft(ms > 0 ? Math.floor(ms / 1000) : 0);
            }
            break;
          }
          await sleep(delayMs);
          // backoff exponencial com teto de 2000 ms
          delayMs = Math.min(delayMs * 2, 2000);
        }

        if (!received) {
          throw new Error('QR não disponível no momento. Tente novamente.');
        }

        setQrData(received);
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
        if (isAuthError(err)) {
          handleAuthFallback({ error: err });
        } else {
          applyErrorMessageFromError(err, 'Não foi possível gerar o QR Code');
        }
      } finally {
        generatingQrRef.current = false;
        if (qrAbortRef.current === abortController) {
          qrAbortRef.current = null;
        }
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

  const selectInstance = useCallback(
    async (instance, { skipAutoQr = false } = {}) => {
      if (!instance) return;
      setCurrentInstance(instance);
      const nextInstanceId = instance?.id ?? null;
      preferredInstanceIdRef.current = nextInstanceId;
      persistInstancesCache(instances, nextInstanceId);
      let statusFromInstance = instance.status || 'disconnected';
      // se status desconhecido, tenta resolver rapidamente antes do QR
      if (!instance.status || instance.status === 'unknown') {
        try {
          const quick = await connectInstance(instance.id);
          if (quick?.status) {
            statusFromInstance = quick.status;
          }
        } catch {
          // ignora: cairemos no caminho de QR abaixo
        }
      }
      setLocalStatus(statusFromInstance);
      onStatusChange?.(statusFromInstance);

      if (!skipAutoQr && statusFromInstance !== 'connected') {
        ++pollIdRef.current; // invalida qualquer polling anterior
        await Promise.resolve(generateQr(instance.id));
      } else {
        setQrData(null);
        setSecondsLeft(null);
      }
    },
    [generateQr, instances, onStatusChange, connectInstance]
  );

  const loadInstances = useCallback(
    async (options = {}) => {
      const {
        connectResult: providedConnect,
        preferredInstanceId: explicitPreferredInstanceId,
        forceRefresh,
        campaignInstanceId: campaignInstanceIdOverride,
      } = options;
      const now = Date.now();
      const rateLimitActive = now < rateLimitUntilRef.current;
      const recentlyForced = now - lastForceRefreshAtRef.current < FORCE_REFRESH_DEBOUNCE_MS;
      const hasExplicitPreference = Object.prototype.hasOwnProperty.call(
        options,
        'preferredInstanceId'
      );
      const resolvedPreferredInstanceId = hasExplicitPreference
        ? explicitPreferredInstanceId
        : preferredInstanceIdRef.current ?? null;
      const resolvedCampaignInstanceId =
        campaignInstanceIdOverride ?? campaignInstanceId ?? null;
      const agreementId = selectedAgreement?.id ?? null;
      const token = getAuthToken();
      setAuthTokenState(token);
      if (!hasFetchedOnceRef.current) {
        setInstancesReady(false);
      }
      const wasLoading = Boolean(loadingInstancesRef.current);
      loadingInstancesRef.current = true;
      setLoadingInstances(true);
      setErrorMessage(null);
      try {
        log('🚀 Iniciando sincronização de instâncias WhatsApp', {
          tenantAgreement: selectedAgreement?.id ?? null,
          preferredInstanceId: resolvedPreferredInstanceId ?? null,
        });
        let shouldForceBrokerSync = forceRefresh === true;
        if (shouldForceBrokerSync && wasLoading) {
          shouldForceBrokerSync = false;
        }
        if (shouldForceBrokerSync && (rateLimitActive || recentlyForced)) {
          log('⏳ Forçando sincronização adiado por cooldown', {
            agreementId,
            preferredInstanceId: resolvedPreferredInstanceId ?? null,
            rateLimited: rateLimitActive,
            recentlyForced,
            cooldownMs: rateLimitActive ? rateLimitUntilRef.current - now : FORCE_REFRESH_DEBOUNCE_MS,
          });
          shouldForceBrokerSync = false;
        }

        log('🛰️ Solicitando lista de instâncias', {
          agreementId,
          forceRefresh: shouldForceBrokerSync,
          hasFetchedOnce: hasFetchedOnceRef.current,
        });
        const baseInstancesUrl = '/api/integrations/whatsapp/instances';
        const instancesUrl = shouldForceBrokerSync ? `${baseInstancesUrl}?refresh=1` : baseInstancesUrl;
        const response = await apiGet(instancesUrl);
        const parsedResponse = parseInstancesPayload(response);
        if (shouldForceBrokerSync) {
          lastForceRefreshAtRef.current = Date.now();
          rateLimitUntilRef.current = 0;
        }
        setSessionActive(true);
        setAuthDeferred(false);
        let list = ensureArrayOfObjects(parsedResponse.instances);
        let hasServerList = Boolean(response);
        let connectResult = providedConnect || null;
    let triedFallbackConnect = false;

    if (list.length === 0 && !shouldForceBrokerSync) {
      const canForceFallback = Date.now() >= rateLimitUntilRef.current;
      if (canForceFallback) {
        const refreshed = await apiGet(`${baseInstancesUrl}?refresh=1`).catch(() => null);
        if (refreshed) {
          const parsedRefreshed = parseInstancesPayload(refreshed);
          const refreshedList = ensureArrayOfObjects(parsedRefreshed.instances);
          if (refreshedList.length > 0) {
            list = refreshedList;
            hasServerList = true;
            lastForceRefreshAtRef.current = Date.now();
            rateLimitUntilRef.current = 0;
          }
        }
      } else {
        log('⏳ Ignorando fallback de refresh devido a cooldown ativo', {
          agreementId,
          preferredInstanceId: resolvedPreferredInstanceId ?? null,
        });
      }
    }

    if (list.length === 0) {
      const fallbackInstanceId = resolvedPreferredInstanceId || resolvedCampaignInstanceId || null;
      if (fallbackInstanceId && !triedFallbackConnect) {
        triedFallbackConnect = true;
        try {
          connectResult = connectResult || (await connectInstance(fallbackInstanceId));
        } catch (e) {
          // evita loop de fallback
          triedFallbackConnect = true;
        }
      } else if (!fallbackInstanceId) {
        warn('Nenhuma instância padrão disponível para conexão automática', {
          agreementId,
          preferredInstanceId: resolvedPreferredInstanceId ?? null,
          campaignInstanceId: resolvedCampaignInstanceId ?? null,
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
          campaignInstanceId: resolvedCampaignInstanceId,
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
            list = normalizedList.map((item) =>
              item.id === current.id ? { ...item, ...current } : item
            );
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
          setCurrentInstance(current);
          preferredInstanceIdRef.current = current?.id ?? null;
          persistInstancesCache(list, current?.id ?? null);
    } else if (hasServerList) {
      setInstances([]);
      setCurrentInstance(null);
      preferredInstanceIdRef.current = null;
      clearInstancesCache();
    } else {
      warn('Servidor não retornou instâncias válidas; reutilizando cache local', {
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

        if (autoGenerateQr && shouldShowQrFromConnect) {
          setQrData(connectQr);
        } else if (autoGenerateQr && current && statusFromInstance !== 'connected') {
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

        if (status === 429) {
          const retryAfterMs = parseRetryAfterMs(err?.response?.headers?.['retry-after']);
          rateLimitUntilRef.current = Date.now() + (retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS);
        }
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
        loadingInstancesRef.current = false;
      }
    },
    [
      applyErrorMessageFromError,
      autoGenerateQr,
      campaignInstanceId,
      connectInstance,
      generateQr,
      handleAuthFallback,
      isAuthError,
      instances,
      log,
      onStatusChange,
      selectedAgreement?.id,
      setErrorMessage,
      warn,
    ]
  );

  loadInstancesRef.current = loadInstances;

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    if (!campaignInstanceId || instances.length === 0) {
      return undefined;
    }

    const matched = instances.find(
      (item) => item.id === campaignInstanceId || item.name === campaignInstanceId
    );

    if (!matched) {
      warn('campaignInstanceId informado não corresponde a nenhuma instância carregada', {
        campaignInstanceId,
      });
      return undefined;
    }
    if (currentInstance?.id === matched.id) {
      return undefined;
    }

    setCurrentInstance(matched);
    preferredInstanceIdRef.current = matched.id ?? null;
    persistInstancesCache(instances, matched.id ?? null);
    const statusFromInstance = matched.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);
    return undefined;
  }, [
    campaignInstanceId,
    currentInstance?.id,
    instances,
    onStatusChange,
    selectedAgreement?.id,
    skipController,
  ]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    loadInstancesRef.current = loadInstances;
    return undefined;
  }, [loadInstances, skipController]);

  const markConnected = useCallback(async () => {
    if (!currentInstance?.id) return false;
    try {
      const status = await apiGet(
        `/api/integrations/whatsapp/instances/${currentInstance.id}/status`
      );
      setSessionActive(true);
      setAuthDeferred(false);
      const parsed = parseInstancesPayload(status);
      const connected =
        typeof parsed.connected === 'boolean'
          ? parsed.connected
          : parsed.status === 'connected';

      const phoneFromStatus =
        (parsed.instance && parsed.instance.phoneNumber) ||
        (parsed.instance && parsed.instance.metadata && parsed.instance.metadata.phoneNumber) ||
        null;

      if (parsed.instance) {
        setCurrentInstance((current) =>
          current && current.id === parsed.instance?.id
            ? { ...current, ...parsed.instance, ...(phoneFromStatus ? { phoneNumber: phoneFromStatus } : {}) }
            : current
        );
        setInstances((prev) =>
          prev.map((item) =>
            item.id === parsed.instance?.id
              ? { ...item, ...parsed.instance, ...(phoneFromStatus ? { phoneNumber: phoneFromStatus } : {}) }
              : item
          )
        );
      }

      if (!connected) {
        setErrorMessage('A instância ainda não está conectada. Escaneie o QR e tente novamente.');
        return false;
      }
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback({ error: err });
        return false;
      }
    }
    setLocalStatus('connected');
    setQrData(null);
    setSecondsLeft(null);
    onStatusChange?.('connected');
    return true;
  }, [
    currentInstance?.id,
    handleAuthFallback,
    isAuthError,
    onStatusChange,
    setErrorMessage,
  ]);

  const deleteInstance = useCallback(
    async (target) => {
      if (!target?.id) {
        return;
      }

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
        if (currentInstance?.id === target.id) {
          setCurrentInstance(null);
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
          statusCode === 409 ||
          errorCode === 'INSTANCE_NOT_FOUND' ||
          errorCode === 'BROKER_INSTANCE_NOT_FOUND' ||
          errorCode === 'SESSION_NOT_CONNECTED';

        if (isInstanceMissing) {
          const nextCurrentId = currentInstance?.id === target.id ? null : currentInstance?.id ?? null;
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
          if (currentInstance?.id === target.id) {
            setCurrentInstance(null);
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
            console.warn('Não foi possível serializar payload de erro da instância WhatsApp', serializationError);
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
      applyErrorMessageFromError,
      currentInstance?.id,
      handleAuthFallback,
      isAuthError,
      loadInstances,
      log,
      logError,
      selectedAgreement?.id,
      warn,
    ]
  );

  const createInstance = useCallback(
    async ({ name, id }) => {
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
      const payloadBody = {
        name: normalizedName,
        ...(normalizedId ? { id: normalizedId } : {}),
        ...(selectedAgreement?.id ? { agreementId: selectedAgreement.id } : {}),
        ...(selectedAgreement?.name ? { agreementName: selectedAgreement.name } : {}),
        ...(selectedAgreement?.tenantId ? { tenantId: selectedAgreement.tenantId } : {}),
      };

      setLoadingInstances(true);
      setErrorMessage(null);

      try {
        log('🧪 Criando nova instância WhatsApp', {
          agreementId: selectedAgreement?.id ?? null,
          name: normalizedName,
        });

        const response = await apiPost('/api/integrations/whatsapp/instances', payloadBody);
        setSessionActive(true);
        const payload = response?.data ?? {};
        const createdInstance = extractInstanceFromPayload(payload);
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
            connectResult = {
              status: createdInstance?.status,
              connected:
                typeof createdInstance?.connected === 'boolean'
                  ? createdInstance.connected
                  : createdInstance?.status === 'connected'
                    ? true
                    : undefined,
              qr: null,
              instance: resolvedCreatedInstance || null,
            };
          }
        }

        if (!connectResult && resolvedCreatedInstance) {
          connectResult = {
            status: resolvedCreatedInstance.status,
            connected:
              typeof resolvedCreatedInstance.connected === 'boolean'
                ? resolvedCreatedInstance.connected
                : resolvedCreatedInstance?.status === 'connected'
                  ? true
                  : undefined,
            qr: null,
            instance: resolvedCreatedInstance,
          };
        }

        await loadInstances({
          connectResult: connectResult || undefined,
          preferredInstanceId: connectResult?.instance?.id ?? createdInstanceId ?? null,
          forceRefresh: true,
        });
        toast.success('Instância criada com sucesso. Gere o QR para conectar.');
        return connectResult?.instance ?? resolvedCreatedInstance ?? null;
      } catch (err) {
        const friendly = applyErrorMessageFromError(
          err,
          'Não foi possível criar uma nova instância'
        );
        logError('Falha ao criar instância WhatsApp', err);
        const errorToThrow = err instanceof Error ? err : new Error(friendly.message);
        throw errorToThrow;
      } finally {
        setLoadingInstances(false);
      }
    },
    [
      applyErrorMessageFromError,
      connectInstance,
      loadInstances,
      log,
      logError,
      selectedAgreement?.id,
      selectedAgreement?.name,
      selectedAgreement?.tenantId,
      setErrorMessage,
    ]
  );

  const canSynchronize = sessionActive && !authDeferred;
  const isAuthenticated = canSynchronize && Boolean(authTokenState);

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
      let bodyHash = '';
      try {
        bodyHash = JSON.stringify(payload).slice(0, 64);
      } catch {
        bodyHash = '';
      }

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
        const key = `${entry.instanceId}-${entry.timestamp}-${entry.type}-${bodyHash}`;
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

    // aplica atualização incremental na lista
    setInstances((prev) =>
      prev.map((item) =>
        item.id === eventInstanceId
          ? {
              ...item,
              ...(typeof statusCandidate === 'string' ? { status: statusCandidate } : {}),
              ...(typeof connectedCandidate === 'boolean' ? { connected: connectedCandidate } : {}),
              ...(phoneCandidate ? { phoneNumber: phoneCandidate } : {}),
            }
          : item
      )
    );
    setCurrentInstance((cur) =>
      cur && cur.id === eventInstanceId
        ? {
            ...cur,
            ...(typeof statusCandidate === 'string' ? { status: statusCandidate } : {}),
            ...(typeof connectedCandidate === 'boolean' ? { connected: connectedCandidate } : {}),
            ...(phoneCandidate ? { phoneNumber: phoneCandidate } : {}),
          }
        : cur
    );
  }, []);

  const tenantRoomId = selectedAgreement?.tenantId ?? selectedAgreement?.id ?? null;

  const { connected: realtimeConnected } = useInstanceLiveUpdates({
    tenantId: tenantRoomId,
    enabled: !skipController && Boolean(tenantRoomId),
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    setLiveEvents([]);
    return undefined;
  }, [selectedAgreement?.id, skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    if (!autoRefresh) {
      setInstancesReady(true);
      return undefined;
    }
    if (!canSynchronize) {
      setInstancesReady(true);
      return undefined;
    }
    if (!initialFetch) {
      setInstancesReady(true);
      return undefined;
    }
    void loadInstances({ forceRefresh: false });
    return undefined;
  }, [
    autoRefresh,
    canSynchronize,
    initialFetch,
    loadInstances,
    selectedAgreement?.id,
    skipController,
  ]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    if (!canSynchronize) {
      setInstancesReady(true);
    }
    return undefined;
  }, [canSynchronize, skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    if (!autoRefresh || !isAuthenticated) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId;
    let backoffMs = DEFAULT_POLL_INTERVAL_MS;

    const resolveNextDelay = (result) => {
      // sucesso ou skip: reseta backoff
      if (!result || result.success || result.skipped) {
        backoffMs = DEFAULT_POLL_INTERVAL_MS;
        return DEFAULT_POLL_INTERVAL_MS;
      }

      const status = result.error?.status;
      const retryAfterMs = parseRetryAfterMs(result.error?.retryAfter);

      if (retryAfterMs !== null) {
        backoffMs = DEFAULT_POLL_INTERVAL_MS;
        return retryAfterMs > 0 ? retryAfterMs : DEFAULT_POLL_INTERVAL_MS;
      }

      if (status === 429) {
        backoffMs = RATE_LIMIT_COOLDOWN_MS;
        return RATE_LIMIT_COOLDOWN_MS;
      }

      if (typeof status === 'number' && status >= 500) {
        backoffMs = Math.min(backoffMs * 2, 120000);
        const jitter = 1 + Math.random() * 0.2; // 10–20% jitter
        return Math.floor(backoffMs * jitter);
      }

      backoffMs = DEFAULT_POLL_INTERVAL_MS;
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

      if (
        (pauseWhenHidden &&
          typeof document !== 'undefined' &&
          document.hidden) ||
        isBusy()
      ) {
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
  }, [autoRefresh, isAuthenticated, pauseWhenHidden, selectedAgreement?.id, skipController, isBusy]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    setLiveEvents([]);
    return undefined;
  }, [currentInstance?.id, skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    return () => {
      if (qrAbortRef.current) {
        try {
          qrAbortRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [skipController]);

  useEffect(() => {
    if (skipController) {
      return undefined;
    }
    if (!autoRefresh || !pauseWhenHidden) {
      return undefined;
    }
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && canSynchronize) {
        const jitter = 200 + Math.floor(Math.random() * 400); // 200–600 ms
        setTimeout(() => {
          void loadInstances({ forceRefresh: true });
        }, jitter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefresh, canSynchronize, loadInstances, pauseWhenHidden, skipController]);

  const controllerValue = useMemo(
    () => ({
      instances,
      instancesReady,
      currentInstance,
      status: localStatus,
      qrData,
      secondsLeft,
      loadingInstances,
      loadingQr,
      isAuthenticated,
      sessionActive,
      authDeferred,
      authTokenState,
      deletingInstanceId,
      liveEvents,
      realtimeConnected,
      setQrData,
      setSecondsLeft,
      loadInstances,
      selectInstance,
      generateQr,
      connectInstance,
      createInstance,
      deleteInstance,
      markConnected,
      handleAuthFallback,
      setSessionActive,
      setAuthDeferred,
      setGeneratingQrState,
      setStatus: setLocalStatus,
    }),
    [
      instances,
      instancesReady,
      currentInstance,
      localStatus,
      qrData,
      secondsLeft,
      loadingInstances,
      loadingQr,
      isAuthenticated,
      sessionActive,
      authDeferred,
      authTokenState,
      deletingInstanceId,
      liveEvents,
      realtimeConnected,
      setQrData,
      setSecondsLeft,
      loadInstances,
      selectInstance,
      generateQr,
      connectInstance,
      createInstance,
      deleteInstance,
      markConnected,
      handleAuthFallback,
      setSessionActive,
      setAuthDeferred,
      setGeneratingQrState,
      setLocalStatus,
    ]
  );

  return skipController ? EMPTY_CONTROLLER : controllerValue;
}

const WhatsAppInstancesContext = createContext(null);

export const WhatsAppInstancesProvider = ({ children, ...config }) => {
  const value = useWhatsAppInstancesController(config);
  return (
    <WhatsAppInstancesContext.Provider value={value}>
      {children}
    </WhatsAppInstancesContext.Provider>
  );
};

export default function useWhatsAppInstances(options = {}) {
  const context = useContext(WhatsAppInstancesContext);
  const controller = useWhatsAppInstancesController({
    ...options,
    __internalSkip: Boolean(context),
  });

  if (!context && typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    console.warn('[WhatsAppInstances] Hook utilizado fora do Provider em produção; criando controlador standalone.');
  }

  return context ?? controller;
}

export {
  DEFAULT_POLL_INTERVAL_MS,
  RATE_LIMIT_COOLDOWN_MS,
  clearInstancesCache,
  persistInstancesCache,
  readInstancesCache,
  looksLikeWhatsAppJid,
  parseInstancesPayload,
};
