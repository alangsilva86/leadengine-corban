const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

const prepareAuthorization = (rawToken) => {
  if (!rawToken) {
    return undefined;
  }

  const trimmed = rawToken.trim();
  if (/^(basic|bearer)\s+/i.test(trimmed)) {
    return trimmed;
  }

  return `Bearer ${trimmed}`;
};

const baseHeaders = () => {
  const headers = {
    Accept: 'application/json',
  };

  // Prioriza seleção feita pelo usuário (persistida no navegador)
  let tenantId = undefined;
  try {
    tenantId = localStorage.getItem('tenantId') || undefined;
  } catch (storageError) {
    console.debug('Falha ao recuperar tenantId do storage local', storageError);
  }
  tenantId =
    tenantId || import.meta.env.VITE_API_TENANT_ID || import.meta.env.VITE_TENANT_ID || 'demo-tenant';
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  const authHeader = prepareAuthorization(
    import.meta.env.VITE_API_AUTH_TOKEN || import.meta.env.VITE_API_TOKEN
  );
  if (authHeader) {
    headers.Authorization = authHeader;
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
    throw new Error(errorMessage || 'Erro ao comunicar com a API');
  }
  return payload;
};

const withDefaultHeaders = (extraHeaders = {}) => ({
  ...baseHeaders(),
  ...extraHeaders,
});

const safeFetch = async (path, init = {}) => {
  try {
    const response = await fetch(buildUrl(path), init);
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Falha de rede ao comunicar com a API');
    }
    throw error;
  }
};

export const apiGet = async (path, options = {}) =>
  safeFetch(path, {
    headers: withDefaultHeaders(),
    credentials: 'include',
    ...options,
  });

export const apiPost = async (path, body, options = {}) =>
  safeFetch(path, {
    method: 'POST',
    headers: withDefaultHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    credentials: 'include',
    ...options,
  });

export const apiPatch = async (path, body, options = {}) =>
  safeFetch(path, {
    method: 'PATCH',
    headers: withDefaultHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    credentials: 'include',
    ...options,
  });
