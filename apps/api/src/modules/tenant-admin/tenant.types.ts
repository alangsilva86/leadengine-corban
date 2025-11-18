import { z } from 'zod';

/**
 * Representa as configurações dinâmicas que cada tenant pode carregar.
 * Futuramente este campo será usado como ponte para capabilities simples
 * (ex.: feature flags e limites específicos) antes da chegada do módulo
 * completo de planos/assinaturas.
 */
export const TenantSettingsSchema = z.record(z.unknown()).default({});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export interface TenantEntity {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Futuro: acoplar informações de plano/capabilities aqui para evitar
   * múltiplas consultas ao módulo administrativo.
   */
  planSnapshot?: TenantPlanSnapshot | null;
}

export interface TenantPlanSnapshot {
  planId: string;
  planName?: string;
  /** Placeholder para capacidades básicas por tenant. */
  featureFlags?: Record<string, boolean>;
}

export interface TenantAdminUser {
  name: string;
  email: string;
  password: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  settings?: TenantSettings;
  adminUser: TenantAdminUser;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  settings?: TenantSettings;
}

export interface ListTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
  slug?: string;
  isActive?: boolean;
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
