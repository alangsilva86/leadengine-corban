import { apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { getEnvVar } from '@/lib/runtime-env.js';
import type {
  ListTenantsParams,
  PaginatedTenants,
  TenantEntity,
  TenantPayload,
} from '../types';

const PLATFORM_ADMIN_HEADER = 'x-platform-admin-token';
const PLATFORM_ADMIN_FALLBACK_HEADER = 'x-platform-admin';
const DEFAULT_ADMIN_TOKEN = 'true';

const resolveAdminToken = (): string => {
  const fromEnv = getEnvVar('VITE_PLATFORM_ADMIN_TOKEN', '');
  if (typeof fromEnv === 'string') {
    const trimmed = fromEnv.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return DEFAULT_ADMIN_TOKEN;
};

const baseAdminHeaders = () => {
  const token = resolveAdminToken();
  return {
    [PLATFORM_ADMIN_HEADER]: token,
    [PLATFORM_ADMIN_FALLBACK_HEADER]: token,
  } satisfies Record<string, string>;
};

const buildQueryString = (params?: ListTenantsParams): string => {
  if (!params) {
    return '';
  }
  const query = new URLSearchParams();
  if (params.page) {
    query.set('page', params.page.toString());
  }
  if (params.limit) {
    query.set('limit', params.limit.toString());
  }
  if (params.search) {
    query.set('search', params.search.trim());
  }
  if (params.slug) {
    query.set('slug', params.slug.trim());
  }
  if (typeof params.isActive === 'boolean') {
    query.set('isActive', params.isActive ? 'true' : 'false');
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

const readData = <T>(payload: { data?: T } | null | undefined): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
};

export const tenantAdminClient = {
  async listTenants(params?: ListTenantsParams): Promise<PaginatedTenants> {
    const response = await apiGet(`/api/tenant-admin/tenants${buildQueryString(params)}`, {
      headers: baseAdminHeaders(),
    });
    return readData<PaginatedTenants>(response);
  },
  async getTenant(id: string): Promise<TenantEntity> {
    const response = await apiGet(`/api/tenant-admin/tenants/${id}`, {
      headers: baseAdminHeaders(),
    });
    return readData<TenantEntity>(response);
  },
  async createTenant(payload: TenantPayload): Promise<TenantEntity> {
    const response = await apiPost('/api/tenant-admin/tenants', payload, {
      headers: baseAdminHeaders(),
    });
    return readData<TenantEntity>(response);
  },
  async updateTenant(id: string, payload: Partial<TenantPayload>): Promise<TenantEntity> {
    const response = await apiPatch(`/api/tenant-admin/tenants/${id}`, payload, {
      headers: baseAdminHeaders(),
    });
    return readData<TenantEntity>(response);
  },
  async toggleTenantActive(id: string, isActive: boolean): Promise<TenantEntity> {
    const response = await apiPatch(`/api/tenant-admin/tenants/${id}/toggle-active`, { isActive }, {
      headers: baseAdminHeaders(),
    });
    return readData<TenantEntity>(response);
  },
};

export type TenantAdminClient = typeof tenantAdminClient;
