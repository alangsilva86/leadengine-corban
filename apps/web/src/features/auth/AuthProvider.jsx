import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { apiGet, apiPost } from '@/lib/api.js';
import {
  clearAuthToken,
  getAuthToken,
  getTenantId,
  onAuthTokenChange,
  onAuthTokenExpire,
  setAuthToken,
  setTenantId,
  setTenantSlugHint,
} from '@/lib/auth.js';

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

const readErrorMessage = (error, fallback = 'Não foi possível completar a ação.') => {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object' && error) {
    const payloadMessage = error?.payload?.error?.message;
    if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
      return payloadMessage.trim();
    }
  }
  return fallback;
};

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState(() => (getAuthToken() ? 'checking' : 'unauthenticated'));
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(status === 'checking');
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const finishWith = useCallback((nextStatus, user = null) => {
    setStatus(nextStatus);
    setCurrentUser(user);
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(
    async (signal) => {
      const token = getAuthToken();
      if (!token) {
        finishWith('unauthenticated', null);
        return null;
      }

      setLoading(true);
      setError(null);

      try {
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
          clearAuthToken();
          finishWith('unauthenticated', null);
          return null;
        }
        console.warn('Falha ao carregar sessão atual', err);
        setError(err);
        finishWith('error', null);
        return null;
      }
    },
    [finishWith]
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
    const unsubscribeToken = onAuthTokenChange(() => {
      refresh();
    });
    const unsubscribeExpire = onAuthTokenExpire(() => {
      clearAuthToken();
      finishWith('unauthenticated', null);
    });

    const handleUnauthorized = () => {
      clearAuthToken();
      finishWith('unauthenticated', null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('leadengine:auth-unauthorized', handleUnauthorized);
    }

    return () => {
      unsubscribeToken?.();
      unsubscribeExpire?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('leadengine:auth-unauthorized', handleUnauthorized);
      }
    };
  }, [finishWith, refresh]);

  const login = useCallback(async ({ email, password, tenantSlug, remember = false }) => {
    if (!email || !password || !tenantSlug) {
      throw new Error('Informe e-mail, senha e tenant para continuar.');
    }

    const payload = await apiPost('/api/auth/login', {
      email,
      password,
      tenantSlug,
      remember,
    });

    const token = payload?.data?.token?.accessToken;
    if (!token) {
      throw new Error('Resposta inválida ao autenticar.');
    }

    const expiresAt = Date.now() + (remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    setAuthToken(token, { expiresAt });
    const tenant = payload?.data?.user?.tenant?.id ?? payload?.data?.user?.tenantId ?? tenantSlug;
    const tenantSlugHint =
      payload?.data?.user?.tenant?.slug ?? payload?.data?.user?.tenant?.name ?? tenantSlug ?? null;
    if (tenant) {
      setTenantId(tenant);
    }
    if (tenantSlugHint) {
      setTenantSlugHint(tenantSlugHint);
    }

    setCurrentUser(payload?.data?.user ?? null);
    setStatus('authenticated');
    setLoading(false);
    return payload?.data ?? null;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch (err) {
      if (err?.status !== 404) {
        console.debug('Falha ao encerrar sessão no backend', err);
      }
    } finally {
      clearAuthToken();
      finishWith('unauthenticated', null);
    }
  }, [finishWith]);

  const recoverPassword = useCallback(async ({ email, tenantSlug }) => {
    if (!email) {
      throw new Error('Informe o e-mail cadastrado para continuar.');
    }
    try {
      await apiPost('/api/auth/password/recover', {
        email,
        tenantSlug: tenantSlug || getTenantId(),
      });
      toast.success('Enviamos instruções para o seu e-mail.');
    } catch (err) {
      throw new Error(readErrorMessage(err, 'Não foi possível enviar o e-mail de recuperação.'));
    }
  }, []);

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
      recoverPassword,
      refresh,
      selectTenant,
    }),
    [currentUser, error, loading, login, logout, recoverPassword, refresh, selectTenant, status]
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
