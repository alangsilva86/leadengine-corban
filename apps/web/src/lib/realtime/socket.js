/**
 * Conexão única de tempo real (socket.io) compartilhada por todo o app.
 *
 * - Ref-count: cada consumidor chama `acquireRealtime()` e devolve com o `release` retornado.
 *   A conexão abre no primeiro consumidor e fecha um pouco depois do último sair (a folga
 *   evita derrubar e reabrir o socket numa troca de página).
 * - Eventos: `subscribeRealtimeEvent` registra um único listener por evento no socket e
 *   distribui para todos os handlers, descartando cópias repetidas do mesmo evento.
 * - Salas: `joinRealtimeRoom('ticket', id)` com ref-count e reentrada automática ao reconectar.
 * - Reconexão com backoff (do Manager do socket.io e, quando ele desiste ou o servidor nos
 *   desconecta, a nossa); o token é lido a cada handshake e a troca de sessão/tenant
 *   refaz o handshake.
 */
import { API_BASE_URL } from '@/lib/api.js';
import { getAuthPayload, getAuthToken, getTenantId, onAuthTokenChange, onTenantIdChange } from '@/lib/auth.js';

const RELEASE_GRACE_MS = 2_000;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const MAX_RETRIES = 6;
const DEDUPE_WINDOW_MS = 10_000;
const DEDUPE_MAX_ENTRIES = 500;

const SOCKET_OPTIONS = {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: MAX_RETRIES,
  reconnectionDelay: RETRY_BASE_MS,
  reconnectionDelayMax: 15_000,
  randomizationFactor: 0.5,
  timeout: 10_000,
};

const IDLE_STATE = Object.freeze({ status: 'idle', connected: false, error: null });

let socket = null;
let connecting = null;
let consumers = 0;
let releaseTimer = null;
let retryTimer = null;
let retryAttempt = 0;
let handshakeIdentity = null;
let detachEnvironment = null;
let state = IDLE_STATE;

const handlersByEvent = new Map();
const dispatchers = new Map();
const rooms = new Map();
const recentEvents = new Map();
const stateListeners = new Set();

const resolveSocketUrl = () => {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window !== 'undefined' && window.location) return window.location.origin;
  return '';
};

const errorMessage = (error, fallback) =>
  error instanceof Error && error.message ? error.message : fallback;

const resolveIdentity = () => {
  const payload = getAuthPayload();
  const subject = payload?.sub ?? payload?.userId ?? payload?.id ?? '';
  return `${getTenantId() ?? ''}:${subject}`;
};

const setState = (patch) => {
  const next = { ...state, ...patch };
  if (next.status === state.status && next.connected === state.connected && next.error === state.error) {
    return;
  }
  state = next;
  stateListeners.forEach((listener) => listener());
};

/* ---------------------------------------------------------------- dedupe ---- */

/**
 * Impressão digital de um evento: id explícito (`eventId`) ou identidade + versão do recurso
 * (ticket/mensagem + `updatedAt`). Sem versão não há como saber se é cópia — entrega sempre.
 */
export const resolveEventFingerprint = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.eventId === 'string' && payload.eventId) return payload.eventId;

  const message = payload.message && typeof payload.message === 'object' ? payload.message : null;
  const resourceId = payload.ticketId ?? payload.messageId ?? message?.id ?? payload.id ?? null;
  const version = payload.ticketUpdatedAt ?? message?.updatedAt ?? payload.updatedAt ?? null;
  if (!resourceId || !version) return null;

  return [
    resourceId,
    payload.messageId ?? message?.id ?? '',
    version,
    message?.status ?? payload.status ?? payload.ticketStatus ?? '',
    payload.ticketStage ?? '',
  ].join('|');
};

const isDuplicateEvent = (event, payload) => {
  const fingerprint = resolveEventFingerprint(payload);
  if (!fingerprint) return false;

  const key = `${event}|${fingerprint}`;
  const now = Date.now();
  const seenAt = recentEvents.get(key);
  if (seenAt !== undefined && now - seenAt < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentEvents.set(key, now);
  if (recentEvents.size > DEDUPE_MAX_ENTRIES) {
    for (const [entryKey, timestamp] of recentEvents) {
      if (now - timestamp >= DEDUPE_WINDOW_MS || recentEvents.size > DEDUPE_MAX_ENTRIES) {
        recentEvents.delete(entryKey);
      } else {
        break;
      }
    }
  }
  return false;
};

/* ---------------------------------------------------------------- eventos ---- */

const createDispatcher = (event) => (payload) => {
  if (isDuplicateEvent(event, payload)) return;
  const handlers = handlersByEvent.get(event);
  if (!handlers) return;
  [...handlers].forEach((handler) => {
    try {
      handler(payload, event);
    } catch (error) {
      console.error(`[realtime] Falha ao tratar "${event}"`, error);
    }
  });
};

const bindEvent = (event) => {
  if (!socket || dispatchers.has(event)) return;
  const dispatcher = createDispatcher(event);
  dispatchers.set(event, dispatcher);
  socket.on(event, dispatcher);
};

const unbindEvent = (event) => {
  const dispatcher = dispatchers.get(event);
  if (!dispatcher) return;
  dispatchers.delete(event);
  socket?.off?.(event, dispatcher);
};

/* -------------------------------------------------------------- conexão ---- */

const clearRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

/** Nossa reconexão — usada quando o Manager do socket.io não tenta mais sozinho. */
const scheduleRetry = () => {
  clearRetry();
  if (!socket || consumers === 0 || !getAuthToken()) return;
  if (retryAttempt >= MAX_RETRIES) {
    setState({
      status: 'offline',
      connected: false,
      error: 'Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.',
    });
    return;
  }
  retryAttempt += 1;
  const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (retryAttempt - 1));
  const delay = Math.round(base * (0.75 + Math.random() * 0.5));
  setState({ status: 'reconnecting', connected: false });
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (socket && !socket.connected) socket.connect();
  }, delay);
};

const rehandshake = () => {
  if (!socket) return;
  clearRetry();
  recentEvents.clear();
  socket.disconnect();
  if (consumers > 0 && getAuthToken()) {
    setState({ status: 'connecting', connected: false });
    socket.connect();
  } else {
    setState(IDLE_STATE);
  }
};

const handleConnect = () => {
  clearRetry();
  retryAttempt = 0;
  handshakeIdentity = resolveIdentity();
  setState({ status: 'connected', connected: true, error: null });
  rooms.forEach(({ kind, id }) => socket?.emit(`join-${kind}`, id));
};

const handleDisconnect = (reason) => {
  if (reason === 'io client disconnect') {
    // Desconexão nossa (teardown/re-handshake): o estado já foi ajustado por quem desconectou.
    setState({ connected: false });
    return;
  }
  setState({ status: 'reconnecting', connected: false });
  if (reason === 'io server disconnect') {
    // O servidor encerrou (ex.: sessão expirou). O socket.io não reconecta sozinho nesse caso;
    // reconectamos lendo o token atual.
    scheduleRetry();
  }
};

const handleConnectError = (error) => {
  setState({
    status: state.status === 'offline' ? 'offline' : 'reconnecting',
    connected: false,
    error: errorMessage(error, 'Falha ao conectar no tempo real'),
  });
  // Recusa do middleware (ex.: token inválido): o Manager não tenta de novo — nós tentamos.
  if (socket && !socket.active) scheduleRetry();
};

const handleReconnectFailed = () => {
  setState({
    status: 'offline',
    connected: false,
    error: 'Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.',
  });
  console.warn('[realtime] Reconexão falhou; seguimos atualizando sem tempo real.');
};

const handleReconnectAttempt = () => setState({ status: 'reconnecting', connected: false });

const handleOnline = () => {
  if (consumers > 0 && socket && !socket.connected) reconnectRealtime();
};

const handleVisibility = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && state.status === 'offline') {
    handleOnline();
  }
};

const attachEnvironment = () => {
  if (detachEnvironment) return;
  let skipInitialToken = true;
  const stopToken = onAuthTokenChange((token) => {
    if (skipInitialToken) return;
    if (!socket) return;
    if (!token) {
      clearRetry();
      socket.disconnect();
      setState(IDLE_STATE);
      return;
    }
    if (!socket.connected) {
      retryAttempt = 0;
      clearRetry();
      setState({ status: 'connecting' });
      socket.connect();
      return;
    }
    // Mesmo usuário/tenant com token renovado: a conexão segue; se o servidor encerrar
    // quando o token antigo expirar, reconectamos com o novo. Outra sessão: refaz o handshake.
    if (resolveIdentity() !== handshakeIdentity) rehandshake();
  });
  skipInitialToken = false;

  let skipInitialTenant = true;
  const stopTenant = onTenantIdChange(() => {
    if (skipInitialTenant) return;
    if (socket?.connected && resolveIdentity() !== handshakeIdentity) rehandshake();
  });
  skipInitialTenant = false;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  detachEnvironment = () => {
    stopToken?.();
    stopTenant?.();
    if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
    detachEnvironment = null;
  };
};

const createSocket = (io) => {
  const instance = io(resolveSocketUrl(), {
    ...SOCKET_OPTIONS,
    auth: (callback) => callback({ token: getAuthToken() }),
  });
  instance.on('connect', handleConnect);
  instance.on('disconnect', handleDisconnect);
  instance.on('connect_error', handleConnectError);
  // No socket.io v4 o `reconnect_failed` e o `reconnect_attempt` saem do Manager (`socket.io`).
  instance.io?.on?.('reconnect_failed', handleReconnectFailed);
  instance.io?.on?.('reconnect_attempt', handleReconnectAttempt);
  return instance;
};

const ensureSocket = () => {
  if (socket || connecting) return;
  setState({ status: 'connecting', connected: false, error: null });
  attachEnvironment();

  connecting = import('socket.io-client')
    .then(({ io }) => {
      if (consumers === 0 || socket) return;
      socket = createSocket(io);
      handlersByEvent.forEach((_handlers, event) => bindEvent(event));
      if (getAuthToken()) {
        socket.connect();
      } else {
        // Sem sessão ainda: conecta quando o token chegar (`onAuthTokenChange`).
        setState(IDLE_STATE);
      }
    })
    .catch((error) => {
      socket = null;
      setState({
        status: 'offline',
        connected: false,
        error: errorMessage(error, 'Falha ao carregar socket.io-client'),
      });
    })
    .finally(() => {
      connecting = null;
    });
};

const teardown = () => {
  releaseTimer = null;
  if (consumers > 0) return;
  clearRetry();
  retryAttempt = 0;
  detachEnvironment?.();
  const current = socket;
  socket = null;
  handshakeIdentity = null;
  if (current) {
    dispatchers.forEach((dispatcher, event) => current.off?.(event, dispatcher));
    current.off?.('connect', handleConnect);
    current.off?.('disconnect', handleDisconnect);
    current.off?.('connect_error', handleConnectError);
    current.io?.off?.('reconnect_failed', handleReconnectFailed);
    current.io?.off?.('reconnect_attempt', handleReconnectAttempt);
    current.disconnect?.();
  }
  dispatchers.clear();
  recentEvents.clear();
  setState(IDLE_STATE);
};

/* ------------------------------------------------------------------ API ---- */

/** Marca um consumidor da conexão; devolve a função que o libera (idempotente). */
export const acquireRealtime = () => {
  consumers += 1;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  ensureSocket();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0 && !releaseTimer) {
      releaseTimer = setTimeout(teardown, RELEASE_GRACE_MS);
    }
  };
};

/** Assina um ou mais eventos; o handler recebe `(payload, eventName)`. */
export const subscribeRealtimeEvent = (events, handler) => {
  if (typeof handler !== 'function') return () => {};
  const names = [...new Set((Array.isArray(events) ? events : [events]).filter(Boolean))];

  names.forEach((event) => {
    if (!handlersByEvent.has(event)) handlersByEvent.set(event, new Set());
    handlersByEvent.get(event).add(handler);
    bindEvent(event);
  });

  return () => {
    names.forEach((event) => {
      const handlers = handlersByEvent.get(event);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        handlersByEvent.delete(event);
        unbindEvent(event);
      }
    });
  };
};

/** Entra numa sala de recurso (`join-<kind>`); refeito a cada reconexão. */
export const joinRealtimeRoom = (kind, id) => {
  if (!kind || !id) return () => {};
  const key = `${kind}:${id}`;
  const entry = rooms.get(key) ?? { kind, id, count: 0 };
  entry.count += 1;
  rooms.set(key, entry);
  if (entry.count === 1 && socket?.connected) socket.emit(`join-${kind}`, id);

  let left = false;
  return () => {
    if (left) return;
    left = true;
    const current = rooms.get(key);
    if (!current) return;
    current.count -= 1;
    if (current.count <= 0) {
      rooms.delete(key);
      if (socket?.connected) socket.emit(`leave-${kind}`, id);
    }
  };
};

/** Envia um evento ao servidor; `false` quando não há conexão. */
export const emitRealtime = (event, payload) => {
  if (!socket?.connected) return false;
  socket.emit(event, payload);
  return true;
};

/** Tenta reconectar agora (botão "Tentar agora", volta da internet). */
export const reconnectRealtime = () => {
  clearRetry();
  retryAttempt = 0;
  if (consumers === 0) return;
  if (!socket) {
    ensureSocket();
    return;
  }
  if (socket.connected || !getAuthToken()) return;
  setState({ status: 'connecting', error: null });
  socket.connect();
};

export const getRealtimeState = () => state;

export const subscribeRealtimeState = (listener) => {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
};

/** Só para testes: derruba tudo na hora, sem a folga do ref-count. */
export const resetRealtimeForTests = () => {
  if (releaseTimer) clearTimeout(releaseTimer);
  consumers = 0;
  connecting = null;
  teardown();
  handlersByEvent.clear();
  rooms.clear();
  stateListeners.clear();
  state = IDLE_STATE;
};
