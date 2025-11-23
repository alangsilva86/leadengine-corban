import type { StoreApi } from 'zustand/vanilla';
import type {
  InstancesStoreState,
  StoreEvents,
  InstancesLoadOptions,
  CreateInstancePayload,
  DeleteInstancePayload,
  ConnectInstancePayload,
  MarkConnectedPayload,
} from '../state/instancesStore';
import { parseInstancesPayload } from '../lib/instances';
import type { NormalizedInstance } from '../lib/instances';

export interface InstancesApiClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
}

export interface InstancesApiServiceOptions {
  store: StoreApi<InstancesStoreState>;
  events: StoreEvents;
  api: InstancesApiClient;
  logger?: {
    log?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  getAuthToken?: () => string | null;
}

const readStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const candidate =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode ??
    (error as { response?: { status?: number } }).response?.status ??
    null;
  return typeof candidate === 'number' ? candidate : null;
};

const readErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'Falha ao comunicar com o servidor.';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error) {
    const payloadMessage =
      (error as { payload?: { error?: { message?: string } } }).payload?.error?.message;
    if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
      return payloadMessage.trim();
    }
    const detailMessage = (error as { payload?: { error?: { details?: { message?: string } } } }).payload?.error?.details
      ?.message;
    if (typeof detailMessage === 'string' && detailMessage.trim()) {
      return detailMessage.trim();
    }
  }
  return 'Falha inesperada ao comunicar com o servidor.';
};

const readErrorPayload = (
  error: unknown,
):
  | {
      code?: string;
      message?: string;
      details?: { responseTimeMs?: number } | null;
    }
  | null => {
  const payloadError = (error as { payload?: { error?: Record<string, unknown> } })?.payload?.error;
  if (payloadError) {
    return payloadError as { code?: string; message?: string; details?: { responseTimeMs?: number } | null };
  }

  const responsePayload = (error as { response?: { data?: { error?: Record<string, unknown> } } })?.response?.data?.error;
  return (responsePayload as { code?: string; message?: string; details?: { responseTimeMs?: number } | null }) ?? null;
};

const isRetryableCreateError = (error: unknown): boolean => {
  const status = readStatusCode(error);
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const payload = readErrorPayload(error);
  const code = payload?.code?.toUpperCase() ?? null;
  return code ? ['RATE_LIMITED', 'BROKER_TIMEOUT', 'BROKER_ERROR'].includes(code) : false;
};

const BASE_PATH = '/api/integrations/whatsapp/instances';

const normalizeCreateBody = (payload: CreateInstancePayload) => {
  const body: Record<string, unknown> = { name: payload.name };
  if (payload.id) {
    body.id = payload.id;
  }
  if (payload.tenantId) {
    body.tenantId = payload.tenantId;
  }
  if (payload.idempotencyKey) {
    body.idempotencyKey = payload.idempotencyKey;
  }
  return body;
};

const extractInstanceId = (parsed: ReturnType<typeof parseInstancesPayload>): string | null => {
  if (parsed.instance?.id) {
    return parsed.instance.id;
  }
  const first = parsed.instances.find((item) => item && item.id);
  return first?.id ?? parsed.instanceId ?? null;
};

const withPreferredLoad = (
  options: InstancesLoadOptions = {},
  preferredInstanceId: string | null,
): InstancesLoadOptions => ({
  ...options,
  preferredInstanceId: preferredInstanceId ?? options.preferredInstanceId ?? null,
});

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const withExponentialBackoff = async <T>(
  task: () => Promise<T>,
  {
    attempts = 3,
    baseDelayMs = 500,
    onRetry,
  }: { attempts?: number; baseDelayMs?: number; onRetry?: (meta: { attempt: number; delay: number; error: unknown }) => void } = {},
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === attempts - 1) {
        break;
      }

      const delayMs = baseDelayMs * 2 ** attempt;
      onRetry?.({ attempt: attempt + 1, delay: delayMs, error });
      await delay(delayMs);
    }
  }

  throw lastError ?? new Error('Unknown error during backoff retry');
};

export interface InstancesApiService {
  loadInstances(options?: InstancesLoadOptions): Promise<{
    success: boolean;
    status?: string | null;
    error?: unknown;
    skipped?: boolean;
  }>;
  createInstance(payload: CreateInstancePayload): Promise<NormalizedInstance | null>;
  deleteInstance(payload: DeleteInstancePayload): Promise<void>;
  connectInstance(payload: ConnectInstancePayload): Promise<{
    instanceId: string;
    status: string | null;
    connected: boolean | null;
    qr: unknown;
    instance: NormalizedInstance | null;
    instances: NormalizedInstance[];
  } | null>;
  markConnected(payload: MarkConnectedPayload): Promise<boolean>;
  dispose(): void;
}

export const createInstancesApiService = ({
  store,
  events,
  api,
  logger,
  getAuthToken,
}: InstancesApiServiceOptions): InstancesApiService => {
  const log = logger?.log ?? (() => {});
  const warn = logger?.warn ?? (() => {});
  const errorLog = logger?.error ?? (() => {});

  const runLoadRequest = async ({
    requestId,
    options = {},
    emitOnly = false,
  }: {
    requestId?: number;
    options?: InstancesLoadOptions;
    emitOnly?: boolean;
  }) => {
    const resolvedRequestId =
      typeof requestId === 'number'
        ? requestId
        : store.getState().requestLoad(options, { silent: true });

    const state = store.getState();
    const now = Date.now();

    const requestedForce = options.forceRefresh === true;
    const recentlyForced = now - state.lastForcedAt < 15_000;
    const rateLimited = now < state.rateLimitUntil;

    let shouldForce = requestedForce && !recentlyForced && !rateLimited;

    const token = getAuthToken ? getAuthToken() : null;
    if (token) {
      store.getState().setAuthToken(token);
    }

    if (shouldForce) {
      store.getState().markForcedAt(now);
      store.getState().markRateLimitUntil(0);
    }

    try {
      const listUrl = shouldForce ? `${BASE_PATH}?refresh=1` : BASE_PATH;
      const refreshRequest = () =>
        withExponentialBackoff(
          () => api.get(`${BASE_PATH}?refresh=1`),
          {
            attempts: 3,
            baseDelayMs: 500,
            onRetry: ({ attempt, delay, error: retryError }) =>
              warn('Repetindo refresh de instâncias com backoff', {
                attempt,
                delay,
                error: retryError,
              }),
          },
        );

      let response = shouldForce ? await refreshRequest() : await api.get(listUrl);
      let parsed = parseInstancesPayload(response);

      if (!parsed.instances.length && !shouldForce) {
        warn('Instâncias vazias, tentando refresh imediato.');
        try {
          response = await refreshRequest();
          parsed = parseInstancesPayload(response);
          shouldForce = true;
          store.getState().markForcedAt(Date.now());
        } catch (refreshError) {
          warn('Refresh imediato falhou', refreshError);
        }
      }

      store
        .getState()
        .applyLoadResult(parsed, {
          requestId: resolvedRequestId,
          preferredInstanceId: options.preferredInstanceId ?? null,
          campaignInstanceId: options.campaignInstanceId ?? null,
          forced: shouldForce,
        });

      if (!emitOnly) {
        return {
          success: true,
          status:
            parsed.status ??
            (typeof parsed.connected === 'boolean'
              ? parsed.connected
                ? 'connected'
                : 'disconnected'
              : null),
        };
      }
      return { success: true };
    } catch (err) {
      const status = readStatusCode(err);
      errorLog('Falha ao carregar instâncias WhatsApp', err);

      if (status === 401 || status === 403) {
        store.getState().handleAuthFallback({ reset: true, error: err });
        store.getState().failLoad({ requestId: resolvedRequestId });
        return { success: false, error: err, skipped: true };
      }

      const cachedState = store.getState();
      const cachedInstances = cachedState.instances ?? [];
      if (cachedInstances.length > 0) {
        warn('Falha no refresh; retornando instâncias em cache.', err);
        store.getState().applyLoadResult(
          {
            instances: cachedInstances,
            instance: cachedState.currentInstance ?? undefined,
            status: cachedState.status ?? null,
            connected:
              cachedState.status === 'connected'
                ? true
                : cachedState.status === 'disconnected'
                  ? false
                  : null,
          },
          {
            requestId: resolvedRequestId,
            preferredInstanceId: options.preferredInstanceId ?? null,
            campaignInstanceId: options.campaignInstanceId ?? null,
            forced: shouldForce,
          },
        );

        return {
          success: true,
          status: cachedState.status ?? null,
          error: err,
          skipped: false,
        };
      }

      const delayMs = (err as { rateLimitDelayMs?: number })?.rateLimitDelayMs;
      if (typeof delayMs === 'number' && delayMs > 0) {
        store.getState().markRateLimitUntil(Date.now() + delayMs);
      }

      store.getState().failLoad(
        { requestId: resolvedRequestId },
        {
          message: readErrorMessage(err),
          code: status ? String(status) : null,
        },
      );
      return {
        success: false,
        error: err,
        skipped: status === 401 || status === 403,
      };
    } finally {
      if (!emitOnly) {
        store.getState().setLoadingInstances(false);
        store.getState().setInstancesReady(true);
      }
    }
  };

  const loadInstances = (options: InstancesLoadOptions = {}) => {
    return runLoadRequest({ options });
  };

  const handleLoad = (payload: { requestId: number; options: InstancesLoadOptions }) => {
    void runLoadRequest({ ...payload, emitOnly: true });
  };

  const handleCreate = async (payload: CreateInstancePayload) => {
    try {
      log('Criando instância WhatsApp', payload);
      const response = await api.post(BASE_PATH, normalizeCreateBody(payload));
      const parsed = parseInstancesPayload(response);
      const createdId = extractInstanceId(parsed) ?? payload.id ?? null;
      await loadInstances(withPreferredLoad({}, createdId));
      return parsed.instance ?? null;
    } catch (err) {
      errorLog('Falha ao criar instância WhatsApp', err);
      const errorPayload = readErrorPayload(err);
      const responseTimeMs = errorPayload?.details?.responseTimeMs ?? null;
      const retryable = isRetryableCreateError(err);
      const extraMessage = [
        retryable
          ? 'A criação é idempotente e pode ser reexecutada com o mesmo identificador se o canal não aparecer.'
          : null,
        typeof responseTimeMs === 'number' ? `Tempo de resposta do broker: ${Math.round(responseTimeMs)}ms.` : null,
      ]
        .filter(Boolean)
        .join(' ');
      const message = `${readErrorMessage(err)}${extraMessage ? ` ${extraMessage}` : ''}`;

      store.getState().setLoadingInstances(false);
      store.getState().setError({
        message,
        code: readStatusCode(err)?.toString() ?? null,
      });
      throw err;
    }
  };

  const handleDelete = async (payload: DeleteInstancePayload) => {
    try {
      log('Removendo instância WhatsApp', payload);
      const encodedId = encodeURIComponent(payload.instanceId);
      const wipeQuery = payload.hard ? '?wipe=1' : '';
      await api.delete(`${BASE_PATH}/${encodedId}${wipeQuery}`);
      store.getState().removeInstance(payload.instanceId);
      store.getState().setDeletingInstance(null);
      await loadInstances({ forceRefresh: true });
    } catch (err) {
      errorLog('Falha ao remover instância WhatsApp', err);
      store.getState().setDeletingInstance(null);
      store.getState().setError({
        message: readErrorMessage(err),
        code: readStatusCode(err)?.toString() ?? null,
      });
      throw err;
    }
  };

  const handleConnect = async (payload: ConnectInstancePayload) => {
    const { instanceId, pairing } = payload;
    const encodedId = encodeURIComponent(instanceId);

    try {
      const endpoint = pairing
        ? `${BASE_PATH}/${encodedId}/pair`
        : `${BASE_PATH}/${encodedId}/status`;

      const body = pairing
        ? {
            ...(pairing.phoneNumber ? { phoneNumber: pairing.phoneNumber } : {}),
            ...(pairing.code ? { code: pairing.code } : {}),
          }
        : undefined;

      const response = pairing ? await api.post(endpoint, body) : await api.get(endpoint);
      const parsed = parseInstancesPayload(response);
      store.getState().applyLoadResult(parsed, {
        requestId: store.getState().loadRequestId,
        preferredInstanceId: instanceId,
        campaignInstanceId: store.getState().config.campaignInstanceId,
      });
      return {
        instanceId: parsed.instanceId ?? instanceId,
        status: parsed.status ?? null,
        connected: parsed.connected ?? null,
        qr: parsed.qr ?? null,
        instance: parsed.instance ?? null,
        instances: parsed.instances ?? [],
      };
    } catch (err) {
      errorLog('Falha ao conectar instância WhatsApp', err);
      store.getState().setError({
        message: readErrorMessage(err),
        code: readStatusCode(err)?.toString() ?? null,
      });
      throw err;
    }
  };

  const markConnected = async ({ instanceId }: MarkConnectedPayload) => {
    try {
      const encodedId = encodeURIComponent(instanceId);
      const response = await api.get(`${BASE_PATH}/${encodedId}/status`);
      const parsed = parseInstancesPayload(response);
      const connected =
        typeof parsed.connected === 'boolean'
          ? parsed.connected
          : (parsed.status ?? '').toLowerCase() === 'connected';

      if (parsed.instance) {
        store.getState().updateInstance(parsed.instance.id, parsed.instance);
      }

      if (connected) {
        store.getState().setStatus('connected');
        store.getState().setError(null);
      } else {
        store.getState().setError({
          message: 'A instância ainda não está conectada. Escaneie o QR e tente novamente.',
          code: null,
        });
      }

      return connected;
    } catch (err) {
      errorLog('Falha ao verificar status de conexão da instância WhatsApp', err);
      store.getState().setError({
        message: readErrorMessage(err),
        code: readStatusCode(err)?.toString() ?? null,
      });
      return false;
    }
  };

  const unsubscribes = [
    events.on('instances:load', handleLoad),
    events.on('instances:create', handleCreate),
    events.on('instances:delete', handleDelete),
    events.on('instances:connect', handleConnect),
  ];

  return {
    loadInstances,
    createInstance: handleCreate,
    deleteInstance: handleDelete,
    connectInstance: handleConnect,
    markConnected,
    dispose() {
      unsubscribes.forEach((dispose) => dispose());
    },
  };
};
