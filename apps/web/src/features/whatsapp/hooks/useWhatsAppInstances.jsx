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
  const realtimeConnected = useInstancesStore((state) => state.realtimeConnected);

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
    realtimeConnected,
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


  const providerConfig = useMemo(
    () => ({
      tenantId: providerConfigProps.tenantId ?? null,
      campaignInstanceId: providerConfigProps.campaignInstanceId ?? null,
      autoRefresh: providerConfigProps.autoRefresh ?? false,
      pauseWhenHidden: providerConfigProps.pauseWhenHidden ?? true,
      // QR só é gerado quando alguém abre "Conectar número"; nada de QR em segundo plano em outras telas.
      autoGenerateQr: providerConfigProps.autoGenerateQr ?? false,
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

  // O serviço de QR vive no ciclo de efeitos: no StrictMode os efeitos montam/desmontam/montam de novo,
  // e criar no render + descartar no cleanup deixava o QR sem ouvinte (o QR nunca era pedido).
  // O serviço de API escuta só o emissor deste provider, que é descartado junto com ele.
  useEffect(() => {
    const disposeQrService = createQrService({
      store: bundle.store,
      events: bundle.events,
      api: {
        get: (path) => apiGet(path),
      },
      logger,
    });
    return () => {
      disposeQrService();
    };
  }, [bundle.events, bundle.store, logger]);

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

// A API resolve a empresa pela sessão; só enviamos tenantId quando um acordo explícito o define.
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
  const { selectRealtimeConnected, selectSelectedInstanceStatus } = useInstancesStoreBundle();
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
  const realtimeConnected = useInstancesStore(selectRealtimeConnected);
  const selectedInstanceStatus = useInstancesStore(selectSelectedInstanceStatus);
  const preferredInstanceId = useInstancesStore((state) => state.preferredInstanceId);
  const rateLimitUntil = useInstancesStore((state) => state.rateLimitUntil);
  const lastForcedAt = useInstancesStore((state) => state.lastForcedAt);
  const hasFetchedOnce = useInstancesStore((state) => state.hasFetchedOnce);
  const storeError = useInstancesStore((state) => state.error);
  // Empresa efetiva: a do acordo selecionado (quando houver) ou a da sessão, vinda do provider.
  const effectiveTenantId = selectedAgreement?.tenantId ?? controller.providerConfig?.tenantId ?? null;
  const lastTenantIdRef = useRef(effectiveTenantId);

  useEffect(() => {
    const desiredConfig = {
      tenantId: effectiveTenantId,
      campaignInstanceId: options.campaignInstanceId ?? null,
      autoGenerateQr:
        typeof autoGenerateQrOption === 'boolean'
          ? autoGenerateQrOption
          : controller.providerConfig?.autoGenerateQr ?? false,
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
    effectiveTenantId,
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

  useEffect(() => {
    const nextTenantId = effectiveTenantId;
    if (lastTenantIdRef.current === nextTenantId) {
      return;
    }
    lastTenantIdRef.current = nextTenantId;
    store.getState().resetForTenantChange?.();
    if (nextTenantId) {
      void loadInstances({ forceRefresh: true });
    }
  }, [effectiveTenantId, loadInstances, store]);

  const connectInstance = useCallback(
    async (instanceId, pairingOptions = {}, { notify = true } = {}) => {
      if (!instanceId) {
        throw new Error('Escolha um número para conectar.');
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
          'Não foi possível conectar o número. Tente novamente em instantes.',
        );
        if (notify) {
          toast.error('Não foi possível conectar o número', {
            description: friendly.message,
          });
        }
        throw err;
      }
    },
    [applyErrorMessage, services.api, setStatus, store],
  );

  const generateQr = useCallback(
    async (instanceId, options = {}) => {
      if (!instanceId) {
        throw new Error('Escolha um número para gerar o QR Code.');
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

  /**
   * Cria um número. A empresa vem da sessão (a API resolve pelo token); só enviamos `tenantId`
   * quando um acordo explícito foi informado. Retorna o número criado (ou `{ id, name }`).
   */
  const createInstance = useCallback(
    async ({ name, id, notify = true }) => {
      if (!name || !name.trim()) {
        const message = 'Informe um nome para o número.';
        onError?.(message, { code: 'INVALID_NAME' });
        throw new Error(message);
      }
      const normalizedName = name.trim();
      const normalizedId = typeof id === 'string' && id.trim() ? id.trim() : null;
      const idempotencyKeyParts = [effectiveTenantId, normalizedId ?? normalizedName]
        .filter((value) => typeof value === 'string' && value)
        .map((value) => value?.toString?.().trim())
        .filter(Boolean);

      const payload = ensureTenantMeta(selectedAgreement, {
        name: normalizedName,
        id: normalizedId ?? undefined,
        idempotencyKey: idempotencyKeyParts.length ? idempotencyKeyParts.join('|') : undefined,
      });
      try {
        const created = await services.api.createInstance(payload);
        if (notify) {
          toast.success('Número criado. Agora é só parear com o celular.');
        }
        return created ?? { id: normalizedId, name: normalizedName };
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Não foi possível criar o número. Tente novamente em instantes.',
        );
        if (notify) {
          toast.error('Não foi possível criar o número', {
            description: friendly.message,
          });
        }
        throw err;
      }
    },
    [applyErrorMessage, effectiveTenantId, onError, selectedAgreement, services.api],
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
          instance.id.endsWith('@s.whatsapp.net') ? 'Número desconectado.' : 'Número excluído.',
        );
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Não foi possível excluir o número. Tente novamente em instantes.',
        );
        toast.error('Não foi possível excluir o número', {
          description: friendly.message,
        });
        throw err;
      } finally {
        store.getState().setDeletingInstance(null);
      }
    },
    [applyErrorMessage, services.api, store],
  );

  /** Desconecta o celular (logout) e mantém o número cadastrado para reconectar depois. */
  const disconnectInstance = useCallback(
    async (instanceId) => {
      if (!instanceId) {
        return;
      }
      store.getState().setDeletingInstance(instanceId);
      try {
        await services.api.disconnectInstance({ instanceId });
        toast.success('Número desconectado.');
      } catch (err) {
        const friendly = applyErrorMessage(
          err,
          'Não foi possível desconectar o número. Tente novamente em instantes.',
        );
        toast.error('Não foi possível desconectar o número', {
          description: friendly.message,
        });
        throw err;
      } finally {
        store.getState().setDeletingInstance(null);
      }
    },
    [applyErrorMessage, services.api, store],
  );

  /** Consulta o status de um número específico sem avisos na tela. Retorna `true` se conectado. */
  const checkInstanceStatus = useCallback(
    async (instanceId) => {
      if (!instanceId) {
        return false;
      }
      try {
        return await services.api.markConnected({ instanceId, status: 'connected' });
      } catch {
        return false;
      }
    },
    [services.api],
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
        toast.success('Número conectado.');
      } else {
        store.getState().setError({
          message: 'O número ainda não está conectado. Leia o QR Code e tente novamente.',
          code: null,
        });
      }
      return response;
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        handleAuthFallback({ error: err });
        return false;
      }
      applyErrorMessage(err, 'Não foi possível verificar o status do número.');
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
    error: storeError,
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
    selectedInstanceStatus,
    setQrData: setQr,
    setSecondsLeft: setSeconds,
    loadInstances,
    selectInstance,
    generateQr,
    connectInstance,
    createInstance,
    deleteInstance,
    disconnectInstance,
    checkInstanceStatus,
    markConnected,
    handleAuthFallback,
    setSessionActive,
    setAuthDeferred,
    setGeneratingQrState,
    setStatus,
  };
}

export { readInstancesCache, persistInstancesCache, clearInstancesCache, parseInstancesPayload };
