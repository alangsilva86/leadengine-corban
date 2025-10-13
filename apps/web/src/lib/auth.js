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

let currentTenantId = readFromStorage(TENANT_STORAGE_KEY) || DEFAULT_TENANT_ID;

const tokenSubscribers = new Set();
const tenantSubscribers = new Set();

const notifyTokenSubscribers = () => {
  tokenSubscribers.forEach((callback) => {
    try {
      callback(null);
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

export const getAuthToken = () => null;

export const onAuthTokenChange = (callback) => {
  if (typeof callback !== 'function') {
    return () => {};
  }
  tokenSubscribers.add(callback);
  callback(null);
  return () => tokenSubscribers.delete(callback);
};

export const setAuthToken = () => null;

export const clearAuthToken = () => {
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

export const setTenantId = (tenantId) => {
  const normalized = typeof tenantId === 'string' ? tenantId.trim() : undefined;
  currentTenantId = normalized && normalized.length > 0 ? normalized : DEFAULT_TENANT_ID;
  writeToStorage(TENANT_STORAGE_KEY, currentTenantId);
  notifyTenantSubscribers();
  return currentTenantId;
};

export const clearTenantId = () => {
  currentTenantId = DEFAULT_TENANT_ID;
  writeToStorage(TENANT_STORAGE_KEY, currentTenantId);
  notifyTenantSubscribers();
};

export const loginWithCredentials = async () => ({
  token: null,
  tenantId: getTenantId(),
  payload: { mode: 'demo' },
});

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
