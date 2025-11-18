import { z } from 'zod';

import { TenantSettingsSchema } from './tenant.types';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateTenantSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(slugRegex, 'Slug deve conter apenas letras minúsculas, números e hifens.'),
    adminEmail: z.string().trim().toLowerCase().email(),
    adminPassword: z.string().min(8).max(120),
    adminName: z.string().trim().min(3).max(120).optional(),
    settings: TenantSettingsSchema.optional(),
  })
  .transform((data) => ({
    name: data.name,
    slug: data.slug,
    settings: data.settings,
    adminUser: {
      email: data.adminEmail,
      password: data.adminPassword,
      name: data.adminName ?? data.name,
    },
  }));

export const UpdateTenantSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(slugRegex, 'Slug deve conter apenas letras minúsculas, números e hifens.')
    .optional(),
  settings: TenantSettingsSchema.optional(),
});

export const ListTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(10_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  isActive: z.preprocess((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    return undefined;
  }, z.boolean().optional()),
});

export const TenantIdParamSchema = z.object({
  tenantId: z.string().trim().min(1),
});

export const ToggleTenantSchema = z.object({
  isActive: z.boolean(),
});
