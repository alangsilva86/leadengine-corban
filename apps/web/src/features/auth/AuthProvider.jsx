import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api.js';
import {
  clearAuthToken,
  getAuthPayload,
  getAuthToken,
  getTenantId,
  onAuthTokenChange,
  onAuthTokenExpire,
  setAuthToken,
  setTenantId,
  setTenantSlugHint,
} from '@/lib/auth.js';

/** @typedef {{
  status: string, loading: boolean, error: unknown, user: any, tenantId: string,
  login: (input: {email: string, password: string, tenantSlug: string, remember?: boolean}) => Promise<unknown>,
  logout: () => Promise<void>, refresh: () => void, selectTenant: (id: string) => void
}} AuthContextValue */
/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null);

const resolveTenantFromUser = (user) => {
  if (!user) {
    return null;
  }
  if (typeof user.tenantId === 'string' && user.tenantId.trim()) {
    return user.tenantId.trim();
  }
  if (user.tenant && typeof user.tenant === 'object') {
    const candidate = user.tenant.id ?? user.tenant.tenantId;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const resolveTenantSlugHintFromUser = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }
  if (user.tenant && typeof user.tenant === 'object') {
    const candidate = user.tenant.slug ?? user.tenant.name;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('checking');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(status === 'checking');
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const renewalRef = useRef(null);
  const sessionVersion = useRef(0);
  const signingOut = useRef(false);

  const finishWith = useCallback((nextStatus, user = null) => {
    setStatus(nextStatus);
    setCurrentUser(user);
    setLoading(false);
  }, []);

  const acceptSession = useCallback((session) => {
    const token = session?.token?.accessToken;
    if (!token || !session?.user) throw new Error('Resposta inválida ao autenticar.');
    const tenant = resolveTenantFromUser(session.user);
    const slug = resolveTenantSlugHintFromUser(session.user);
    if (tenant) setTenantId(tenant);
    if (slug) setTenantSlugHint(slug);
    setAuthToken(token);
    setError(null);
    finishWith('authenticated', session.user);
    return session.user;
  }, [finishWith]);

  const renewSession = useCallback(() => {
    if (signingOut.current) return Promise.resolve(null);
    if (renewalRef.current) return renewalRef.current;
    const version = sessionVersion.current;
    const send = () => apiPost('/api/auth/token/refresh', {});
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    const request = locks ? locks.request('corban-session-renewal', send) : send();
    const pending = request.then(({ data }) => {
      return version === sessionVersion.current ? acceptSession(data) : null;
    }).catch((err) => {
      if (version !== sessionVersion.current) return null;
      if (err?.status !== 401) throw err;
      clearAuthToken();
      queryClient.clear();
      finishWith('unauthenticated', null);
      return null;
    }).finally(() => {
      if (renewalRef.current === pending) renewalRef.current = null;
    });
    renewalRef.current = pending;
    return pending;
  }, [acceptSession, finishWith, queryClient]);

  const fetchProfile = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);

      try {
        if (!getAuthToken()) return await renewSession();
        const response = await apiGet('/api/auth/me', { signal });
        if (signal?.aborted) {
          return null;
        }
        const user = response?.data ?? null;
        const tenantFromUser = resolveTenantFromUser(user);
        const tenantSlugHint = resolveTenantSlugHintFromUser(user);
        if (tenantFromUser) {
          setTenantId(tenantFromUser);
        }
        if (tenantSlugHint) {
          setTenantSlugHint(tenantSlugHint);
        }
        finishWith(user ? 'authenticated' : 'unauthenticated', user);
        return user;
      } catch (err) {
        if (signal?.aborted) {
          return null;
        }
        if (err?.status === 401) {
          try {
            return await renewSession();
          } catch (renewalError) {
            setError(renewalError);
            finishWith('error', null);
            return null;
          }
        }
        console.warn('Falha ao carregar sessão atual', err);
        setError(err);
        finishWith('error', null);
        return null;
      }
    },
    [finishWith, renewSession]
  );

  const refresh = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchProfile(controller.signal);
  }, [fetchProfile]);

  useEffect(() => {
    refresh();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    let timer;
    const handleRenewalFailure = (err) => {
      if (getAuthToken()) return;
      setError(err);
      finishWith('error', null);
    };
    const renew = () => {
      void renewSession().catch(handleRenewalFailure);
    };
    const unsubscribeToken = onAuthTokenChange(() => {
      clearTimeout(timer);
      const expiry = getAuthPayload()?.exp;
      // Skip the proactive timer for the final two minutes of an expiring session.
      // The expiration handler will make one last attempt.
      const delay = typeof expiry === 'number' ? expiry * 1000 - Date.now() - 120_000 : 0;
      if (delay > 0) timer = setTimeout(renew, delay);
    });
    const unsubscribeExpire = onAuthTokenExpire(renew);

    if (typeof window !== 'undefined') {
      window.addEventListener('leadengine:auth-unauthorized', renew);
    }

    return () => {
      unsubscribeToken?.();
      unsubscribeExpire?.();
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('leadengine:auth-unauthorized', renew);
      }
    };
  }, [finishWith, renewSession]);

  const login = useCallback(async ({ email, password, tenantSlug, remember = false }) => {
    if (!email || !password || !tenantSlug) {
      throw new Error('Preencha e-mail, senha e código da empresa.');
    }

    sessionVersion.current += 1;
    abortControllerRef.current?.abort();
    const payload = await apiPost('/api/auth/login', {
      email,
      password,
      tenantSlug,
      remember,
      sessionCookie: true,
    });

    queryClient.clear();
    acceptSession(payload?.data);
    return payload?.data ?? null;
  }, [acceptSession, queryClient]);

  const logout = useCallback(async () => {
    signingOut.current = true;
    sessionVersion.current += 1;
    abortControllerRef.current?.abort();
    try {
      await apiPost('/api/auth/logout', {});
    } catch (err) {
      if (err?.status !== 404) {
        console.debug('Falha ao encerrar sessão no backend', err);
      }
    } finally {
      clearAuthToken();
      queryClient.clear();
      finishWith('unauthenticated', null);
      signingOut.current = false;
    }
  }, [finishWith, queryClient]);

  const selectTenant = useCallback((tenantId) => {
    setTenantId(tenantId);
  }, []);

  const contextValue = useMemo(
    () => ({
      status,
      loading,
      error,
      user: currentUser,
      tenantId: resolveTenantFromUser(currentUser) ?? getTenantId(),
      login,
      logout,
      refresh,
      selectTenant,
    }),
    [currentUser, error, loading, login, logout, refresh, selectTenant, status]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return ctx;
};

export default AuthProvider;
