import { describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError } from '@ticketz/core';

import type { ITenantRepository } from '../tenant.repository';
import { TenantAdminService } from '../tenant.service';
import type { PaginatedTenants, TenantEntity } from '../tenant.types';

const buildTenant = (overrides: Partial<TenantEntity> = {}): TenantEntity => ({
  id: 'tenant-1',
  name: 'Tenant 1',
  slug: 'tenant-1',
  isActive: true,
  settings: {},
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const buildRepository = (overrides: Partial<ITenantRepository> = {}): ITenantRepository => ({
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
  ...overrides,
});

describe('TenantAdminService', () => {
  it('creates tenant with normalized slug and settings', async () => {
    const repository = buildRepository({
      create: vi.fn().mockResolvedValue(buildTenant({ slug: 'tenant-base' })),
    });

    const service = new TenantAdminService({ repository });

    const result = await service.createTenant({
      name: 'Tenant Base',
      slug: 'Tenant Base',
      settings: { onboardingCompleted: false },
    });

    expect(result.slug).toBe('tenant-base');
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Tenant Base',
      slug: 'tenant-base',
      settings: { onboardingCompleted: false },
    });
  });

  it('throws ConflictError when slug already exists', async () => {
    const repository = buildRepository({
      create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    });

    const service = new TenantAdminService({ repository });

    await expect(
      service.createTenant({ name: 'Tenant', slug: 'tenant', settings: {} })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('lists tenants with pagination defaults', async () => {
    const page: PaginatedTenants = {
      items: [buildTenant()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
    const repository = buildRepository({
      list: vi.fn().mockResolvedValue(page),
    });

    const service = new TenantAdminService({ repository });
    const result = await service.listTenants({});

    expect(result).toEqual(page);
    expect(repository.list).toHaveBeenCalledWith({});
  });

  it('updates tenant and handles slug conflicts', async () => {
    const existing = buildTenant();
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockRejectedValueOnce({ code: 'P2002' }),
    });

    const service = new TenantAdminService({ repository });

    await expect(service.updateTenant(existing.id, { slug: 'new slug' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when tenant does not exist on toggle', async () => {
    const repository = buildRepository({
      findById: vi.fn().mockResolvedValue(null),
    });

    const service = new TenantAdminService({ repository });

    await expect(service.toggleTenantActive('missing', true)).rejects.toBeInstanceOf(NotFoundError);
  });
});
