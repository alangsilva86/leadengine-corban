import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@ticketz/core';

import { logger as defaultLogger } from '../../config/logger';
import { toSlug } from '../../lib/slug';
import type {
  CreateTenantInput,
  ListTenantsParams,
  PaginatedTenants,
  TenantEntity,
  TenantSettings,
  UpdateTenantInput,
} from './tenant.types';
import { TenantRepository, type ITenantRepository } from './tenant.repository';

export interface TenantAdminServiceDependencies {
  repository?: ITenantRepository;
  logger?: typeof defaultLogger;
}

export interface TenantAdminServicePort {
  createTenant(input: CreateTenantInput): Promise<TenantEntity>;
  listTenants(params: ListTenantsParams): Promise<PaginatedTenants>;
  getTenantById(id: string): Promise<TenantEntity>;
  updateTenant(id: string, input: UpdateTenantInput): Promise<TenantEntity>;
  toggleTenantActive(id: string, isActive: boolean): Promise<TenantEntity>;
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const isMissingRecord = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

const normalizeSettings = (settings?: TenantSettings): TenantSettings => {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    return { ...settings };
  }
  return {};
};

const normalizeSlug = (slug: string, fallback: string): string => toSlug(slug || fallback, fallback);

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => v?.toString?.() ?? '').filter(Boolean);
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
};

export class TenantAdminService implements TenantAdminServicePort {
  private readonly repository: ITenantRepository;
  private readonly logger: typeof defaultLogger;

  constructor(deps: TenantAdminServiceDependencies = {}) {
    this.repository = deps.repository ?? new TenantRepository();
    this.logger = deps.logger ?? defaultLogger;
  }

  async createTenant(input: CreateTenantInput): Promise<TenantEntity> {
    const payload: CreateTenantInput = {
      name: input.name.trim(),
      slug: normalizeSlug(input.slug, input.name),
      settings: normalizeSettings(input.settings),
      adminUser: {
        email: input.adminUser.email.trim().toLowerCase(),
        password: input.adminUser.password,
        name: input.adminUser.name?.trim() || input.name.trim(),
      },
    };

    try {
      const tenant = await this.repository.create(payload);
      this.logger.info('[tenant-admin] tenant created', { tenantId: tenant.id, slug: tenant.slug });
      return tenant;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const metaTargets = toArray((error as Prisma.PrismaClientKnownRequestError).meta?.target);
        if (metaTargets.some((target) => target.includes('email'))) {
          throw new ConflictError('E-mail do administrador já está em uso.', { email: payload.adminUser.email });
        }
        throw new ConflictError('Tenant slug already exists', { slug: payload.slug });
      }
      throw error;
    }
  }

  async getTenantById(id: string): Promise<TenantEntity> {
    const tenant = await this.repository.findById(id);
    if (!tenant) {
      throw new NotFoundError('Tenant', id);
    }
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<TenantEntity> {
    const normalized = normalizeSlug(slug, slug);
    const tenant = await this.repository.findBySlug(normalized);
    if (!tenant) {
      throw new NotFoundError('Tenant', normalized);
    }
    return tenant;
  }

  async listTenants(params: ListTenantsParams): Promise<PaginatedTenants> {
    return this.repository.list(params);
  }

  async updateTenant(id: string, input: UpdateTenantInput): Promise<TenantEntity> {
    await this.getTenantById(id);

    const payload: UpdateTenantInput = {
      name: typeof input.name === 'string' ? input.name.trim() : undefined,
      slug: typeof input.slug === 'string' ? normalizeSlug(input.slug, input.slug) : undefined,
      settings: input.settings ? normalizeSettings(input.settings) : undefined,
    };

    try {
      const updated = await this.repository.update(id, payload);
      this.logger.info('[tenant-admin] tenant updated', { tenantId: updated.id });
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Tenant slug already exists', { slug: payload.slug });
      }
      if (isMissingRecord(error)) {
        throw new NotFoundError('Tenant', id);
      }
      throw error;
    }
  }

  async toggleTenantActive(id: string, isActive: boolean): Promise<TenantEntity> {
    const existing = await this.getTenantById(id);

    if (existing.isActive === isActive) {
      return existing;
    }

    try {
      const updated = await this.repository.setActive(id, isActive);
      this.logger.info('[tenant-admin] tenant status toggled', { tenantId: updated.id, isActive: updated.isActive });
      return updated;
    } catch (error) {
      if (isMissingRecord(error)) {
        throw new NotFoundError('Tenant', id);
      }
      throw error;
    }
  }
}
