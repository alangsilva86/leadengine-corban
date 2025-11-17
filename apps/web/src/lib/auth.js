import { getEnvVar } from './runtime-env.js';

const DEFAULT_TENANT_ID = (() => {
  const envTenant =
    getEnvVar('VITE_DEMO_TENANT_ID') ||
    getEnvVar('VITE_API_TENANT_ID') ||
    getEnvVar('VITE_TENANT_ID') ||
    'demo-tenant';
  return typeof envTenant === 'string' && envTenant.trim().length > 0
    ? envTenant.trim()
    : 'demo-tenant';
})();

const TENANT_STORAGE_KEY = 'tenantId';
const AUTH_STORAGE_KEY = 'leadengine.auth.session.v1';

const storageCandidates = [
  () => (typeof window !== 'undefined' ? window.localStorage : undefined),
  () => (typeof window !== 'undefined' ? window.sessionStorage : undefined),
];

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
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
};

const writeToStorage = (key, value) => {
  for (const resolver of storageCandidates) {
    const storage = safeCall(resolver);
    if (!storage) continue;
    if (typeof value === 'string' && value.length > 0) {
      safeCall(() => storage.setItem(key, value));
    } else {
      safeCall(() => storage.removeItem(key));
    }
  }
};

const tokenSubscribers = new Set();
const tenantSubscribers = new Set();
const tokenExpirationSubscribers = new Set();

let currentTenantId = readFromStorage(TENANT_STORAGE_KEY) || DEFAULT_TENANT_ID;
let currentAuthToken = null;
let currentAuthPayload = null;
let currentAuthExpiresAt = null;
let tokenExpirationTimer = null;

const notifyTokenSubscribers = () => {
  tokenSubscribers.forEach((callback) => {
    try {
      callback(currentAuthToken ?? null);
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

const notifyTokenExpirationSubscribers = () => {
  tokenExpirationSubscribers.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.error('Auth expiration subscriber failed', error);
    }
  });
};

const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') {
    return null;
  }
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = typeof window === 'undefined' ? Buffer.from(padded, 'base64').toString('utf8') : atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    console.debug('Failed to decode JWT payload', error);
    return null;
  }
};

const computeExpiration = (payload, explicitExpiresAt) => {
  if (typeof explicitExpiresAt === 'number' && Number.isFinite(explicitExpiresAt)) {
    return explicitExpiresAt;
  }
  if (payload && typeof payload.exp === 'number') {
    return payload.exp * 1000;
  }
  // fallback: 15 minutes
  return Date.now() + 15 * 60 * 1000;
};

const persistAuthState = () => {
  if (!currentAuthToken) {
    writeToStorage(AUTH_STORAGE_KEY, null);
    return;
  }
  const payload = {
    token: currentAuthToken,
    expiresAt: currentAuthExpiresAt,
  };
  writeToStorage(AUTH_STORAGE_KEY, JSON.stringify(payload));
};

const clearExpirationTimer = () => {
  if (tokenExpirationTimer) {
    clearTimeout(tokenExpirationTimer);
    tokenExpirationTimer = null;
  }
};

const scheduleTokenExpiration = () => {
  clearExpirationTimer();
  if (!currentAuthToken || !currentAuthExpiresAt) {
    return;
  }
  const delay = Math.max(0, currentAuthExpiresAt - Date.now());
  const safeDelay = Math.min(delay, 2_147_483_647); // ~24 dias
  tokenExpirationTimer = setTimeout(() => {
    tokenExpirationTimer = null;
    clearAuthToken();
    notifyTokenExpirationSubscribers();
  }, safeDelay);
};

const deriveTenantIdFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (typeof payload.tenantId === 'string') {
    const normalized = payload.tenantId.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (payload.tenant && typeof payload.tenant === 'object') {
    const candidate = payload.tenant.id ?? payload.tenant.tenantId;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const applyTenantChange = (tenantId) => {
  const normalized = typeof tenantId === 'string' ? tenantId.trim() : undefined;
  currentTenantId = normalized && normalized.length > 0 ? normalized : DEFAULT_TENANT_ID;
  writeToStorage(TENANT_STORAGE_KEY, currentTenantId);
  notifyTenantSubscribers();
  return currentTenantId;
};

const restoreAuthState = () => {
  const raw = readFromStorage(AUTH_STORAGE_KEY);
  if (!raw) {
    currentAuthToken = null;
    currentAuthPayload = null;
    currentAuthExpiresAt = null;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string') {
      writeToStorage(AUTH_STORAGE_KEY, null);
      return;
    }
    const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
    if (expiresAt && expiresAt <= Date.now()) {
      writeToStorage(AUTH_STORAGE_KEY, null);
      return;
    }
    currentAuthToken = parsed.token;
    currentAuthPayload = decodeJwtPayload(parsed.token);
    currentAuthExpiresAt = expiresAt ?? computeExpiration(currentAuthPayload, null);
    scheduleTokenExpiration();
    const tenantFromToken = deriveTenantIdFromPayload(currentAuthPayload);
    if (tenantFromToken) {
      applyTenantChange(tenantFromToken);
    }
  } catch (error) {
    console.debug('Failed to restore auth token from storage', error);
    writeToStorage(AUTH_STORAGE_KEY, null);
    currentAuthToken = null;
    currentAuthPayload = null;
    currentAuthExpiresAt = null;
  }
};

restoreAuthState();

export const getAuthToken = () => {
  if (currentAuthToken && currentAuthExpiresAt && currentAuthExpiresAt <= Date.now()) {
    clearAuthToken();
    notifyTokenExpirationSubscribers();
    return null;
  }
  return currentAuthToken;
};

export const onAuthTokenChange = (callback) => {
  if (typeof callback !== 'function') {
    return () => {};
  }
  tokenSubscribers.add(callback);
  callback(currentAuthToken ?? null);
  return () => tokenSubscribers.delete(callback);
};

export const onAuthTokenExpire = (callback) => {
  if (typeof callback !== 'function') {
    return () => {};
  }
  tokenExpirationSubscribers.add(callback);
  return () => tokenExpirationSubscribers.delete(callback);
};

export const getAuthPayload = () => currentAuthPayload;

export const setAuthToken = (token, options = {}) => {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!normalized) {
    clearAuthToken();
    return null;
  }

  currentAuthToken = normalized;
  currentAuthPayload = decodeJwtPayload(normalized);
  currentAuthExpiresAt = computeExpiration(currentAuthPayload, options.expiresAt ?? null);
  persistAuthState();
  scheduleTokenExpiration();

  const tenantFromToken = deriveTenantIdFromPayload(currentAuthPayload);
  if (tenantFromToken) {
    applyTenantChange(tenantFromToken);
  }

  notifyTokenSubscribers();
  return normalized;
};

export const clearAuthToken = () => {
  if (!currentAuthToken) {
    writeToStorage(AUTH_STORAGE_KEY, null);
    clearExpirationTimer();
    currentAuthPayload = null;
    currentAuthExpiresAt = null;
    return;
  }

  currentAuthToken = null;
  currentAuthPayload = null;
  currentAuthExpiresAt = null;
  clearExpirationTimer();
  writeToStorage(AUTH_STORAGE_KEY, null);
  notifyTokenSubscribers();
};

export const getTenantId = () => currentTenantId;

export const onTenantIdChange = (callback) => {
  if (typeof callback !== 'function') {
    return () => {};
  }
  tenantSubscribers.add(callback);
  callback(currentTenantId);
  return () => tenantSubscribers.delete(callback);
};

export const setTenantId = (tenantId) => applyTenantChange(tenantId);

export const clearTenantId = () => {
  applyTenantChange(DEFAULT_TENANT_ID);
};

export default {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  onAuthTokenChange,
  onAuthTokenExpire,
  getAuthPayload,
  getTenantId,
  setTenantId,
  clearTenantId,
  onTenantIdChange,
};
