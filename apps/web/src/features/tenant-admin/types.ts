export type TenantSettings = Record<string, unknown>;

export type TenantPlanSnapshot = {
  /** Futuro: exibir o plano e os limites efetivos do tenant. */
  planId?: string;
  name?: string;
  features?: string[];
  limits?: Record<string, number>;
} | null;

export interface TenantEntity {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
  /** Reservado para capabilities/planos quando disponíveis na API. */
  planSnapshot?: TenantPlanSnapshot;
}

export interface PaginatedTenants {
  items: TenantEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
  slug?: string;
  isActive?: boolean;
}

export interface TenantPayload {
  name: string;
  slug: string;
  settings?: TenantSettings;
}

export interface TenantFormState {
  name: string;
  slug: string;
  isActive: boolean;
  settingsText: string;
}
