import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPost } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';

import { clearInstancesCache, persistInstancesCache, readInstancesCache } from '../lib/cache';
import { parseInstancesPayload } from '../lib/instances';
import { createInstancesApiService } from '../services/instancesApi';
import { createQrService } from '../services/qrService';
import { useLiveUpdatesService } from '../services/liveUpdatesService';
import {
  InstancesStoreProvider,
  createInstancesStore,
  useInstancesStore,
  useInstancesStoreBundle,
} from '../state/instancesStore';
import { resolveWhatsAppErrorCopy } from '../utils/whatsapp-error-codes.js';
import { useInstancesBootstrap } from './internal/useInstancesBootstrap';
import { useInstancesAutoRefresh } from './internal/useInstancesAutoRefresh';
import { useAutoQr } from './internal/useAutoQr';

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const FORCE_REFRESH_DEBOUNCE_MS = 15_000;

const noop = () => {};

const ServicesContext = createContext(null);

const useServices = () => {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error('WhatsAppInstances services não foram inicializados.');
  }
  return ctx;
};

const ProviderEffects = ({ controller, logger }) => {
  const { store, services, providerConfig } = controller;
  const api = services.api;

  const config = useInstancesStore((state) => state.config);
  const sessionActive = useInstancesStore((state) => state.sessionActive);
  const authDeferred = useInstancesStore((state) => state.authDeferred);
  const currentInstanceId = useInstancesStore(
    (state) => state.currentInstance?.id ?? state.preferredInstanceId ?? null,
  );
  const status = useInstancesStore((state) => state.status);
  const generatingQr = useInstancesStore((state) => state.generatingQr);
  const qrState = useInstancesStore((state) => state.qrState);

  useInstancesBootstrap({
    store,
    api,
    logger,
    providerConfig,
  });

  useInstancesAutoRefresh({
    api,
    autoRefresh: config.autoRefresh,
    pauseWhenHidden: config.pauseWhenHidden,
    sessionActive,
    authDeferred,
  });

  useAutoQr({
    store,
    autoGenerateQr: config.autoGenerateQr,
    currentInstanceId,
    status,
    generatingQr,
    qrState,
  });

  useLiveUpdatesService();

  return null;
};

export const WhatsAppInstancesProvider = ({ children, logger: loggerProp, ...providerConfigProps }) => {
  const { log: providedLog, warn: providedWarn, error: providedError } = loggerProp ?? {};

  const logger = useMemo(
    () => ({
      log: providedLog ?? noop,
      warn: providedWarn ?? noop,
      error: providedError ?? noop,
    }),
    [providedLog, providedWarn, providedError],
  );
  const bundleRef = useRef(null);

  if (!bundleRef.current) {
    bundleRef.current = createInstancesStore({
      readCache: readInstancesCache,
      persistCache: (list, currentId) => {
        persistInstancesCache(list, currentId);
      },
      clearCache: () => {
        clearInstancesCache();
      },
    });
  }

  const bundle = bundleRef.current;

  const apiServiceRef = useRef(null);
  if (!apiServiceRef.current) {
    apiServiceRef.current = createInstancesApiService({
      store: bundle.store,
      events: bundle.events,
      api: {
        get: (path) => apiGet(path),
        post: (path, body) => apiPost(path, body),
        delete: (path) => apiDelete(path),
      },
      logger,
      getAuthToken,
    });
  }

  const qrCleanupRef = useRef(null);
  if (!qrCleanupRef.current) {
    qrCleanupRef.current = createQrService({
      store: bundle.store,
      events: bundle.events,
      api: {
        get: (path) => apiGet(path),
      },
      logger,
    });
  }

  const providerConfig = useMemo(
    () => ({
      tenantId: providerConfigProps.tenantId ?? null,
      campaignInstanceId: providerConfigProps.campaignInstanceId ?? null,
      autoRefresh: providerConfigProps.autoRefresh ?? false,
      pauseWhenHidden: providerConfigProps.pauseWhenHidden ?? true,
      autoGenerateQr: providerConfigProps.autoGenerateQr ?? true,
      initialFetch: providerConfigProps.initialFetch ?? false,
    }),
    [
      providerConfigProps.tenantId,
      providerConfigProps.campaignInstanceId,
      providerConfigProps.autoRefresh,
      providerConfigProps.pauseWhenHidden,
      providerConfigProps.autoGenerateQr,
      providerConfigProps.initialFetch,
    ],
  );

  useEffect(() => {
    return () => {
      apiServiceRef.current?.dispose?.();
      if (qrCleanupRef.current) {
        qrCleanupRef.current();
        qrCleanupRef.current = null;
      }
    };
  }, []);

  const servicesValue = useMemo(
    () => ({
      store: bundle.store,
      events: bundle.events,
      services: {
        api: apiServiceRef.current,
      },
      logger,
      providerConfig,
    }),
    [bundle.events, bundle.store, logger, providerConfig],
  );

  return (
    <InstancesStoreProvider value={bundle}>
      <ServicesContext.Provider value={servicesValue}>
        <ProviderEffects controller={servicesValue} logger={logger} />
        {children}
      </ServicesContext.Provider>
    </InstancesStoreProvider>
  );
};

const ensureTenantMeta = (selectedAgreement, payload) => {
  if (!selectedAgreement?.tenantId) {
    return payload;
  }
  if (payload.tenantId) {
    return payload;
  }
  return { ...payload, tenantId: selectedAgreement.tenantId };
};

const resolveFriendlyError = (error, fallback) => {
  if (!error) {
    return { title: null, message: fallback, code: null };
  }
  if (typeof error === 'string') {
    return { title: null, message: error, code: null };
  }
  if (error instanceof Error) {
    return { title: error.name || null, message: error.message, code: null };
  }
  const friendly = resolveWhatsAppErrorCopy(error);
  if (friendly?.message) {
    return friendly;
  }
  const payloadMessage =
    error?.payload?.error?.message ??
    error?.response?.data?.error?.message ??
    (typeof error?.message === 'string' ? error.message : null);
  return {
    title: friendly?.title ?? null,
    message: payloadMessage ?? fallback,
    code: friendly?.code ?? error?.payload?.error?.code ?? null,
  };
};

const computeAuthToken = () => getAuthToken() ?? null;

export default function useWhatsAppInstances(options = {}) {
  const {
    selectedAgreement = null,
    onStatusChange,
    onError,
    autoGenerateQr: autoGenerateQrOption,
    autoRefresh: autoRefreshOption,
    pauseWhenHidden: pauseWhenHiddenOption,
    initialFetch: initialFetchOption,
  } = options;

  const controller = useServices();
  const { store, services, logger } = controller;

  const instances = useInstancesStore((state) => state.instances);
  const instancesReady = useInstancesStore((state) => state.instancesReady);
  const loadStatus = useInstancesStore((state) => state.loadStatus);
  const currentInstance = useInstancesStore((state) => state.currentInstance);
  const status = useInstancesStore((state) => state.status);
  const qrData = useInstancesStore((state) => state.qrData);
  const secondsLeft = useInstancesStore((state) => state.secondsLeft);
  const loadingInstances = useInstancesStore((state) => state.loadingInstances);
  const loadingQr = useInstancesStore((state) => state.loadingQr);
  const authToken = useInstancesStore((state) => state.authToken);
  const sessionActive = useInstancesStore((state) => state.sessionActive);
  const authDeferred = useInstancesStore((state) => state.authDeferred);
  const deletingInstanceId = useInstancesStore((state) => state.deletingInstanceId);
  const liveEvents = useInstancesStore((state) => state.liveEvents);
  const realtimeConnected = useInstancesStore((state) => state.realtimeConnected);
  const preferredInstanceId = useInstancesStore((state) => state.preferredInstanceId);
  const rateLimitUntil = useInstancesStore((state) => state.rateLimitUntil);
  const lastForcedAt = useInstancesStore((state) => state.lastForcedAt);
  const hasFetchedOnce = useInstancesStore((state) => state.hasFetchedOnce);

  useEffect(() => {
    const desiredConfig = {
      tenantId: selectedAgreement?.tenantId ?? null,
      campaignInstanceId: options.campaignInstanceId ?? null,
      autoGenerateQr:
        typeof autoGenerateQrOption === 'boolean'
          ? autoGenerateQrOption
          : controller.providerConfig?.autoGenerateQr ?? true,
      autoRefresh:
        typeof autoRefreshOption === 'boolean'
          ? autoRefreshOption
          : controller.providerConfig?.autoRefresh ?? false,
      pauseWhenHidden:
        typeof pauseWhenHiddenOption === 'boolean'
          ? pauseWhenHiddenOption
          : controller.providerConfig?.pauseWhenHidden ?? true,
      initialFetch:
        typeof initialFetchOption === 'boolean'
          ? initialFetchOption
          : controller.providerConfig?.initialFetch ?? false,
    };
    store.getState().setConfig(desiredConfig);
  }, [
    store,
    selectedAgreement?.tenantId,
    options.campaignInstanceId,
    controller.providerConfig?.autoGenerateQr,
    controller.providerConfig?.autoRefresh,
    controller.providerConfig?.pauseWhenHidden,
    controller.providerConfig?.initialFetch,
    autoGenerateQrOption,
    autoRefreshOption,
    pauseWhenHiddenOption,
    initialFetchOption,
  ]);

  const setStatus = useCallback(
    (nextStatus) => {
      store.getState().setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    },
    [onStatusChange, store],
  );

  const setSeconds = useCallback(
    (value) => {
      store.getState().setSecondsLeft(value);
    },
    [store],
  );

  const setQr = useCallback(
    (value) => {
      store.getState().setQrData(value);
    },
    [store],
  );

  const markRateLimit = useCallback(
    (timestamp) => {
      store.getState().markRateLimitUntil(timestamp);
    },
    [store],
  );

  const markForcedAt = useCallback(
    (timestamp) => {
      store.getState().markForcedAt(timestamp);
    },
    [store],
  );

  const applyErrorMessage = useCallback(
    (error, fallback) => {
      const resolved = resolveFriendlyError(error, fallback);
      if (resolved.message) {
        onError?.(resolved.message, { code: resolved.code, title: resolved.title });
      }
      return resolved;
    },
    [onError],
  );

  const loadInstances = useCallback(
    async (loadOptions = {}) => {
      const now = Date.now();
      const requestedForce = loadOptions.forceRefresh === true;
      const rateLimited = now < rateLimitUntil;
      const recentlyForced = now - lastForcedAt < FORCE_REFRESH_DEBOUNCE_MS;
      const shouldForce = requestedForce && !rateLimited && !recentlyForced;
      const requestOptions = {
        ...loadOptions,
        preferredInstanceId:
          loadOptions.preferredInstanceId ?? preferredInstanceId ?? currentInstance?.id ?? null,
        forceRefresh: shouldForce,
      };

      const token = computeAuthToken();
      if (token) {
        store.getState().setAuthToken(token);
      }

      if (!hasFetchedOnce) {
        store.getState().setInstancesReady(false);
      }

      const result = await services.api.loadInstances(requestOptions);
      if (result.success) {
        if (shouldForce) {
          markForcedAt(Date.now());
          markRateLimit(0);
        }
        if (result.status) {
          setStatus(result.status);
        }
      } else if (result.error) {
        const friendly = applyErrorMessage(
          result.error,
          'Não foi possível carregar status do WhatsApp',
        );
        const retryAfter = parseRetryAfterMs(result.error?.response?.headers?.['retry-after']);
        if (typeof retryAfter === 'number' && retryAfter > 0) {
          markRateLimit(Date.now() + retryAfter);
        }
        if (result.error?.response?.status === 429 && !retryAfter) {
          markRateLimit(Date.now() + RATE_LIMIT_COOLDOWN_MS);
        }
        store.getState().setError({
          message: friendly.message,
          code: friendly.code ?? null,
        });
      }

      store.getState().setInstancesReady(true);
      return result;
    },
    [
      services.api,
      preferredInstanceId,
      currentInstance?.id,
      markForcedAt,
      markRateLimit,
      setStatus,
      applyErrorMessage,
      store,
      rateLimitUntil,
      lastForcedAt,
      hasFetchedOnce,
    ],
  );

  const selectInstance = useCallback(
    (id, options = {}) => {
      store.getState().selectInstance(id, options);
      if (id) {
        persistInstancesCache(store.getState().instances, id);
      }
    },
    [store],
  );

  const connectInstance = useCallback(
    async (instanceId, pairingOptions = {}) => {
      if (!instanceId) {
        throw new Error('ID da instância é obrigatório para iniciar pareamento.');
      }
      try {
        const result = await services.api.connectInstance({
          instanceId,
          pairing: pairingOptions,
        });
        if (result?.qr?.qrCode) {
          store.getState().setQrData(result.qr);
        }
        if (result?.status) {
          setStatus(result.status);
        }
        return result;
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Não foi possível conectar a instância. Tente novamente em instantes.',
        );
        toast.error(friendly.title ?? 'Falha ao conectar instância', {
          description: friendly.message,
        });
        throw err instanceof Error ? err : new Error(friendly.message);
      }
    },
    [applyErrorMessage, services.api, setStatus, store],
  );

  const generateQr = useCallback(
    async (instanceId, options = {}) => {
      if (!instanceId) {
        throw new Error('ID da instância é obrigatório para gerar o QR Code.');
      }
      store.getState().generateQr({
        instanceId,
        refresh: options.refresh ?? false,
        fetchSnapshots: options.fetchSnapshots ?? true,
        pairing: options.pairing ?? null,
      });
    },
    [store],
  );

  const handleAuthFallback = useCallback(
    (fallbackOptions = {}) => {
      store.getState().handleAuthFallback(fallbackOptions);
    },
    [store],
  );

  const setSessionActive = useCallback(
    (value) => {
      store.getState().setSessionActive(Boolean(value));
    },
    [store],
  );

  const setAuthDeferred = useCallback(
    (value) => {
      store.getState().setAuthDeferred(Boolean(value));
    },
    [store],
  );

  const setGeneratingQrState = useCallback(
    (value) => {
      store.getState().setGeneratingQr(Boolean(value));
    },
    [store],
  );

  const createInstance = useCallback(
    async ({ name, id }) => {
      if (!name || !name.trim()) {
        const message = 'Informe um nome válido para a nova instância.';
        onError?.(message, { code: 'INVALID_NAME' });
        throw new Error(message);
      }
      const payload = ensureTenantMeta(selectedAgreement, {
        name: name.trim(),
        id: id ?? undefined,
      });
      try {
        await services.api.createInstance(payload);
        toast.success('Canal criado! Gerencie e gere o QR no painel de instâncias.');
        return true;
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Instância não foi provisionada. Tente novamente em instantes.',
        );
        toast.error(friendly.title ?? 'Falha ao criar instância', {
          description: friendly.message,
        });
        throw err instanceof Error ? err : new Error(friendly.message);
      }
    },
    [applyErrorMessage, onError, selectedAgreement, services.api],
  );

  const deleteInstance = useCallback(
    async (instance) => {
      if (!instance?.id) {
        return;
      }
      store.getState().setDeletingInstance(instance.id);
      try {
        await services.api.deleteInstance({
          instanceId: instance.id,
          hard: !instance.id.endsWith('@s.whatsapp.net'),
        });
        toast.success(
          instance.id.endsWith('@s.whatsapp.net')
            ? 'Sessão desconectada com sucesso'
            : 'Instância removida com sucesso',
        );
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Não foi possível remover a instância. Tente novamente em instantes.',
        );
        toast.error(friendly.title ?? 'Falha ao remover instância', {
          description: friendly.message,
        });
        throw err instanceof Error ? err : new Error(friendly.message);
      } finally {
        store.getState().setDeletingInstance(null);
      }
    },
    [applyErrorMessage, services.api, store],
  );

  const markConnected = useCallback(async () => {
    const target = currentInstance ?? null;
    if (!target?.id) {
      return false;
    }
    try {
      const response = await services.api.markConnected({
        instanceId: target.id,
        status: 'connected',
      });
      if (response) {
        setStatus('connected');
        store.getState().setQrData(null);
        setSeconds(null);
        toast.success('Instância conectada com sucesso.');
      } else {
        store.getState().setError({
          message: 'A instância ainda não está conectada. Escaneie o QR e tente novamente.',
          code: null,
        });
      }
      return response;
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        handleAuthFallback({ error: err });
        return false;
      }
      applyErrorMessage(err, 'Não foi possível verificar o status da instância.');
      return false;
    }
  }, [
    applyErrorMessage,
    currentInstance,
    handleAuthFallback,
    services.api,
    setSeconds,
    setStatus,
    store,
  ]);

  const isAuthenticated = sessionActive && !authDeferred && Boolean(authToken);

  return {
    instances,
    instancesReady,
    loadStatus,
    currentInstance,
    status,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    isAuthenticated,
    sessionActive,
    authDeferred,
    authTokenState: authToken,
    deletingInstanceId,
    liveEvents,
    realtimeConnected,
    setQrData: setQr,
    setSecondsLeft: setSeconds,
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
    setStatus,
  };
}

export {
  RATE_LIMIT_COOLDOWN_MS,
  readInstancesCache,
  persistInstancesCache,
  clearInstancesCache,
  parseInstancesPayload,
};
