import type { Prisma, PrismaClient, Tenant } from '@prisma/client';

import { prisma as defaultPrisma } from '../../lib/prisma';
import type {
  CreateTenantInput,
  ListTenantsParams,
  PaginatedTenants,
  TenantEntity,
  TenantSettings,
  UpdateTenantInput,
} from './tenant.types';
import bcrypt from 'bcryptjs';

export interface TenantRepositoryDependencies {
  prisma?: PrismaClient;
}

export interface ITenantRepository {
  create(data: CreateTenantInput): Promise<TenantEntity>;
  findById(id: string): Promise<TenantEntity | null>;
  findBySlug(slug: string): Promise<TenantEntity | null>;
  list(params: ListTenantsParams): Promise<PaginatedTenants>;
  update(id: string, data: UpdateTenantInput): Promise<TenantEntity>;
  setActive(id: string, isActive: boolean): Promise<TenantEntity>;
}

const normalizeSettings = (settings: Prisma.JsonValue | null | undefined): TenantSettings => {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    return { ...(settings as Record<string, unknown>) };
  }
  return {};
};

const toEntity = (record: Tenant): TenantEntity => ({
  id: record.id,
  name: record.name,
  slug: record.slug,
  isActive: record.isActive,
  settings: normalizeSettings(record.settings),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class TenantRepository implements ITenantRepository {
  private readonly prisma: PrismaClient;

  constructor(deps: TenantRepositoryDependencies = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
  }

  async create(data: CreateTenantInput): Promise<TenantEntity> {
    const passwordHash = await bcrypt.hash(data.adminUser.password, 10);
    const record = await this.prisma.$transaction(async (tx) => {
      const tenantRecord = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          settings: data.settings ?? {},
        },
      });

      await tx.user.create({
        data: {
          tenantId: tenantRecord.id,
          email: data.adminUser.email,
          name: data.adminUser.name,
          role: 'ADMIN',
          passwordHash,
          isActive: true,
          settings: {},
        },
      });

      return tenantRecord;
    });

    return toEntity(record);
  }

  async findById(id: string): Promise<TenantEntity | null> {
    const record = await this.prisma.tenant.findUnique({ where: { id } });
    return record ? toEntity(record) : null;
  }

  async findBySlug(slug: string): Promise<TenantEntity | null> {
    const record = await this.prisma.tenant.findUnique({ where: { slug } });
    return record ? toEntity(record) : null;
  }

  async list(params: ListTenantsParams): Promise<PaginatedTenants> {
    const page = Number.isFinite(params.page) && (params.page ?? 0) > 0 ? params.page! : DEFAULT_PAGE;
    const limitCandidate = Number.isFinite(params.limit) && (params.limit ?? 0) > 0 ? params.limit! : DEFAULT_LIMIT;
    const limit = Math.min(limitCandidate, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

    if (typeof params.isActive === 'boolean') {
      where.isActive = params.isActive;
    }

    if (params.slug) {
      where.slug = params.slug;
    }

    if (params.search) {
      const normalized = params.search.trim();
      if (normalized.length > 0) {
        where.OR = [
          { name: { contains: normalized, mode: 'insensitive' } },
          { slug: { contains: normalized, mode: 'insensitive' } },
        ];
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const hasNext = page * limit < total;
    const hasPrev = page > 1 && total > 0;

    return {
      items: records.map(toEntity),
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  async update(id: string, data: UpdateTenantInput): Promise<TenantEntity> {
    const record = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        settings: data.settings,
      },
    });

    return toEntity(record);
  }

  async setActive(id: string, isActive: boolean): Promise<TenantEntity> {
    const record = await this.prisma.tenant.update({
      where: { id },
      data: { isActive },
    });

    return toEntity(record);
  }
}
