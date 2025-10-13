import { getTenantId, onTenantIdChange } from './auth.js';
import { computeBackoffDelay, parseRetryAfterMs } from './rate-limit.js';
import { getEnvVar } from './runtime-env.js';

const DEFAULT_SAME_ORIGIN_HOSTS = ['leadengine-corban.up.railway.app'];

const parseHosts = (value) => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const configuredSameOriginHosts = parseHosts(getEnvVar('VITE_API_SAME_ORIGIN_HOSTS', ''));

const sameOriginHosts = new Set([...DEFAULT_SAME_ORIGIN_HOSTS, ...configuredSameOriginHosts]);

const shouldUseSameOriginBase = (rawValue) => {
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';

  if (
    normalizedValue === '' ||
    normalizedValue === '/' ||
    normalizedValue === '@auto' ||
    normalizedValue === 'auto' ||
    normalizedValue === '@proxy' ||
    normalizedValue === 'proxy' ||
    normalizedValue === '@same-origin' ||
    normalizedValue === 'same-origin'
  ) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const currentHost = window.location?.hostname?.toLowerCase() ?? '';
  if (currentHost && sameOriginHosts.has(currentHost)) {
    return true;
  }

  return false;
};

const normalizeBaseUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/$/, '');
  }

  return trimmed.replace(/\/$/, '');
};

export const API_BASE_URL = (() => {
  const rawUrl = getEnvVar('VITE_API_URL', '');

  if (shouldUseSameOriginBase(rawUrl)) {
    return '';
  }

  return normalizeBaseUrl(rawUrl);
})();

let persistedTenantId = getTenantId();

onTenantIdChange((nextTenant) => {
  persistedTenantId = nextTenant;
});

const baseHeaders = () => {
  const headers = {
    Accept: 'application/json',
  };

  // Prioriza seleção feita pelo usuário (persistida no navegador)
  let tenantId = persistedTenantId;

  if (!tenantId) {
    const envTenant =
      getEnvVar('VITE_API_TENANT_ID') ?? getEnvVar('VITE_TENANT_ID') ?? undefined;
    if (typeof envTenant === 'string') {
      const normalized = envTenant.trim();
      tenantId = normalized.length > 0 ? normalized : undefined;
    }
  }

  if (!tenantId) {
    tenantId = 'demo-tenant';
  }
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
};

const buildUrl = (path) => {
  if (!path) {
    return API_BASE_URL;
  }

  if (API_BASE_URL) {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  return path;
};

const handleResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const errorMessage = payload?.error?.message || response.statusText;
    const error = new Error(errorMessage || 'Erro ao comunicar com a API');
    error.status = response.status;
    error.statusText = response.statusText;
    error.payload = payload;
    const retryAfterHeader = response.headers.get('Retry-After');
    if (retryAfterHeader) {
      error.retryAfter = retryAfterHeader;
    }
    throw error;
  }
  return payload;
};

const withDefaultHeaders = (extraHeaders = {}) => ({
  ...baseHeaders(),
  ...extraHeaders,
});

const sleep = (ms) =>
  ms > 0
    ? new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
    : Promise.resolve();

const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 30000;

const rateLimitBuckets = new Map();

const resolveRateLimitKey = (path, customKey) => {
  if (typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }

  if (!path) {
    return '::root';
  }

  try {
    const url = path.startsWith('http')
      ? new URL(path)
      : new URL(path.startsWith('/') ? path : `/${path}`, API_BASE_URL || 'http://localhost');
    return url.pathname || path;
  } catch {
    return path.startsWith('/') ? path : `/${path}`;
  }
};

const runWithRateLimit = async (key, task) => {
  if (!rateLimitBuckets.has(key)) {
    rateLimitBuckets.set(key, {
      queue: Promise.resolve(),
      nextAvailableAt: 0,
      attempts: 0,
    });
  }

  const bucket = rateLimitBuckets.get(key);

  const execute = async () => {
    const waitMs = bucket.nextAvailableAt - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      const result = await task();
      bucket.nextAvailableAt = 0;
      bucket.attempts = 0;
      return result;
    } catch (error) {
      const status = error?.status ?? error?.statusCode ?? error?.response?.status;
      if (typeof status === 'number' && (status === 429 || status === 503 || status >= 500)) {
        const retryAfterMs = parseRetryAfterMs(
          error?.retryAfter ?? error?.payload?.retryAfter ?? error?.rateLimitDelayMs ?? null
        );
        const attempt = bucket.attempts + 1;
        bucket.attempts = attempt;
        const waitDuration =
          retryAfterMs !== null
            ? retryAfterMs
            : computeBackoffDelay(attempt, {
                baseMs: RATE_LIMIT_BASE_DELAY_MS,
                maxMs: RATE_LIMIT_MAX_DELAY_MS,
              });
        bucket.nextAvailableAt = Date.now() + waitDuration;
        error.rateLimitDelayMs = waitDuration;
      } else {
        bucket.nextAvailableAt = 0;
        bucket.attempts = 0;
      }

      throw error;
    }
  };

  bucket.queue = bucket.queue.then(execute, execute);
  return bucket.queue;
};

const safeFetch = async (path, init = {}) => {
  const { rateLimitKey, ...fetchInit } = init;
  const key = resolveRateLimitKey(path, rateLimitKey);

  return runWithRateLimit(key, async () => {
    let response;

    try {
      response = await fetch(buildUrl(path), fetchInit);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Falha de rede ao comunicar com a API');
      }
      throw error;
    }

    const rateInfo = {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset'),
      retryAfter: response.headers.get('Retry-After'),
    };

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('leadengine:rate-limit', { detail: rateInfo });
      window.dispatchEvent(event);
    }

    return handleResponse(response);
  });
};

const prepareOptions = (options = {}) => {
  const { rateLimitKey, headers: extraHeaders, ...rest } = options;
  const headers = withDefaultHeaders(extraHeaders);
  return { ...rest, rateLimitKey, headers };
};

export const apiGet = async (path, options = {}) => {
  const prepared = prepareOptions(options);
  return safeFetch(path, {
    ...prepared,
    credentials: prepared.credentials ?? 'include',
    cache: prepared.cache ?? 'no-store',
  });
};

export const apiPost = async (path, body, options = {}) => {
  const prepared = prepareOptions(options);
  const headers = { ...prepared.headers, 'Content-Type': 'application/json' };
  return safeFetch(path, {
    ...prepared,
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: prepared.credentials ?? 'include',
  });
};

export const apiPatch = async (path, body, options = {}) => {
  const prepared = prepareOptions(options);
  const headers = { ...prepared.headers, 'Content-Type': 'application/json' };
  return safeFetch(path, {
    ...prepared,
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
    credentials: prepared.credentials ?? 'include',
  });
};

export const apiDelete = async (path, options = {}) => {
  const prepared = prepareOptions(options);
  return safeFetch(path, {
    ...prepared,
    method: 'DELETE',
    credentials: prepared.credentials ?? 'include',
  });
};
