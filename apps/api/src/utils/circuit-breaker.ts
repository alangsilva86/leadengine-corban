const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 120_000;

type IntegerEnvOptions = {
  min?: number;
};

const parseIntegerEnv = (
  name: string,
  fallback: number,
  options: IntegerEnvOptions = {}
): number => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    return options.min;
  }

  return parsed;
};

const FAILURE_THRESHOLD = parseIntegerEnv(
  'WHATSAPP_OUTBOUND_CIRCUIT_MAX_FAILURES',
  DEFAULT_MAX_FAILURES,
  { min: 1 }
);
const FAILURE_WINDOW_MS = parseIntegerEnv(
  'WHATSAPP_OUTBOUND_CIRCUIT_WINDOW_MS',
  DEFAULT_WINDOW_MS,
  { min: 1 }
);
const CIRCUIT_COOLDOWN_MS = parseIntegerEnv(
  'WHATSAPP_OUTBOUND_CIRCUIT_COOLDOWN_MS',
  DEFAULT_COOLDOWN_MS,
  { min: 1 }
);

type CircuitState = {
  failures: number[];
  openedAt: number | null;
};

const circuits = new Map<string, CircuitState>();

const getState = (key: string): CircuitState => {
  const existing = circuits.get(key);
  if (existing) {
    return existing;
  }
  const initial: CircuitState = { failures: [], openedAt: null };
  circuits.set(key, initial);
  return initial;
};

export class CircuitBreakerOpenError extends Error {
  readonly retryAt: number | null;
  readonly key: string;

  constructor(key: string, retryAt: number | null) {
    super('Circuit breaker aberto para este canal de envio.');
    this.name = 'CircuitBreakerOpenError';
    this.key = key;
    this.retryAt = retryAt;
  }
}

export const getCircuitBreakerConfig = () => ({
  maxFailures: FAILURE_THRESHOLD,
  windowMs: FAILURE_WINDOW_MS,
  cooldownMs: CIRCUIT_COOLDOWN_MS,
});

export const buildCircuitBreakerKey = (tenantId: string, instanceId: string): string =>
  `whatsapp:circuit:${tenantId}:${instanceId}`;

export const assertCircuitClosed = (key: string): void => {
  const state = getState(key);
  if (state.openedAt === null) {
    return;
  }

  const now = Date.now();
  const retryAt = state.openedAt + CIRCUIT_COOLDOWN_MS;
  if (now >= retryAt) {
    state.openedAt = null;
    state.failures = [];
    return;
  }

  throw new CircuitBreakerOpenError(key, retryAt);
};

export const recordCircuitFailure = (
  key: string
): { opened: boolean; failureCount: number; retryAt: number | null } => {
  const state = getState(key);
  const now = Date.now();
  state.failures = state.failures.filter((timestamp) => now - timestamp <= FAILURE_WINDOW_MS);
  state.failures.push(now);

  if (state.openedAt === null && state.failures.length >= FAILURE_THRESHOLD) {
    state.openedAt = now;
    const retryAt = now + CIRCUIT_COOLDOWN_MS;
    return { opened: true, failureCount: state.failures.length, retryAt };
  }

  return { opened: false, failureCount: state.failures.length, retryAt: state.openedAt };
};

export const recordCircuitSuccess = (key: string): boolean => {
  const state = getState(key);
  const wasOpen = state.openedAt !== null;
  state.failures = [];
  state.openedAt = null;
  return wasOpen;
};

export const resetCircuitBreaker = (key?: string): void => {
  if (!key) {
    circuits.clear();
    return;
  }
  circuits.delete(key);
};
