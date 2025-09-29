const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

const TOKEN_STORAGE_KEY = 'leadengine_auth_token';
const TENANT_STORAGE_KEY = 'tenantId';

const storageCandidates = [
  () => (typeof window !== 'undefined' ? window.localStorage : undefined),
  () => (typeof window !== 'undefined' ? window.sessionStorage : undefined),
];

const tokenSubscribers = new Set();
const tenantSubscribers = new Set();

const safeCall = (fn, ...args) => {
  try {
    return fn(...args);
  } catch (error) {
    console.debug('Auth storage operation failed', error);
    return undefined;
  }
};

const readFromStorage = (key) => {
  for (const resolver of storageCandidates) {
    const storage = safeCall(resolver);
    if (!storage) continue;
    const value = safeCall(() => storage.getItem(key));
    if (value) {
      return value;
    }
  }
  return undefined;
};

const writeToStorage = (key, value) => {
  let persisted = false;
  for (const resolver of storageCandidates) {
    const storage = safeCall(resolver);
    if (!storage) continue;
    if (typeof value === 'string' && value.length > 0) {
      persisted = safeCall(() => storage.setItem(key, value)) === undefined || persisted;
    } else {
      persisted = safeCall(() => storage.removeItem(key)) === undefined || persisted;
    }
    if (persisted) break;
  }
  return persisted;
};

let currentToken = readFromStorage(TOKEN_STORAGE_KEY);
let currentTenantId = readFromStorage(TENANT_STORAGE_KEY) || undefined;

const notifyTokenSubscribers = () => {
  tokenSubscribers.forEach((callback) => {
    try {
      callback(currentToken);
    } catch (error) {
      console.error('Auth token subscriber failed', error);
    }
  });
};

const notifyTenantSubscribers = () => {
  tenantSubscribers.forEach((callback) => {
    try {
      callback(currentTenantId);
    } catch (error) {
      console.error('Tenant subscriber failed', error);
    }
  });
};

const commitToken = (token, { persist = true, notify = true } = {}) => {
  const normalized = typeof token === 'string' ? token.trim() : undefined;
  currentToken = normalized && normalized.length > 0 ? normalized : undefined;
  if (persist) {
    if (currentToken) {
      writeToStorage(TOKEN_STORAGE_KEY, currentToken);
    } else {
      writeToStorage(TOKEN_STORAGE_KEY, undefined);
    }
  }
  if (notify) {
    notifyTokenSubscribers();
  }
};

const commitTenantId = (tenantId, { persist = true, notify = true } = {}) => {
  const normalized = typeof tenantId === 'string' ? tenantId.trim() : undefined;
  currentTenantId = normalized && normalized.length > 0 ? normalized : undefined;
  if (persist) {
    if (currentTenantId) {
      writeToStorage(TENANT_STORAGE_KEY, currentTenantId);
    } else {
      writeToStorage(TENANT_STORAGE_KEY, undefined);
    }
  }
  if (notify) {
    notifyTenantSubscribers();
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_STORAGE_KEY) {
      commitToken(event.newValue ?? undefined, { persist: false, notify: true });
    }
    if (event.key === TENANT_STORAGE_KEY) {
      commitTenantId(event.newValue ?? undefined, { persist: false, notify: true });
    }
  });
}

const buildUrl = (path) => {
  if (!path) {
    return API_BASE_URL || '';
  }
  if (/^https?:/i.test(path)) {
    return path;
  }
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path;
};

export const getAuthToken = () => currentToken;

export const onAuthTokenChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  tokenSubscribers.add(callback);
  return () => tokenSubscribers.delete(callback);
};

export const setAuthToken = (token) => {
  commitToken(token, { persist: true, notify: true });
  return currentToken;
};

export const clearAuthToken = () => {
  commitToken(undefined, { persist: true, notify: true });
};

export const getTenantId = () => currentTenantId;

export const onTenantIdChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  tenantSubscribers.add(callback);
  return () => tenantSubscribers.delete(callback);
};

export const setTenantId = (tenantId) => {
  commitTenantId(tenantId, { persist: true, notify: true });
  return currentTenantId;
};

export const clearTenantId = () => {
  commitTenantId(undefined, { persist: true, notify: true });
};

const parseLoginResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(message || 'Falha ao autenticar na API');
  }
  return payload;
};

export const loginWithCredentials = async ({ email, password, tenantId } = {}) => {
  const requestBody = {
    email,
    password,
  };
  if (tenantId) {
    requestBody.tenantId = tenantId;
  }

  const response = await fetch(buildUrl('/api/auth/login'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(requestBody),
  });

  const payload = await parseLoginResponse(response);
  const token =
    payload?.token || payload?.accessToken || payload?.data?.token || payload?.jwt || payload?.data?.accessToken;
  if (!token) {
    throw new Error('A resposta da API não retornou um token de autenticação');
  }

  const resolvedTenant =
    tenantId ||
    payload?.tenantId ||
    payload?.tenant?.id ||
    payload?.user?.tenantId ||
    payload?.user?.tenant?.id ||
    payload?.data?.tenantId ||
    payload?.data?.tenant?.id ||
    payload?.data?.user?.tenantId ||
    payload?.data?.user?.tenant?.id;

  commitToken(token, { persist: true, notify: true });
  commitTenantId(resolvedTenant, { persist: true, notify: true });

  return {
    token,
    tenantId: getTenantId(),
    payload,
  };
};

export const logout = () => {
  clearAuthToken();
};

export default {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  onAuthTokenChange,
  getTenantId,
  setTenantId,
  clearTenantId,
  onTenantIdChange,
  loginWithCredentials,
  logout,
};
