import { z } from 'zod';

const stringWithMin = (min: number) =>
  z
    .string({ required_error: 'Campo obrigatório.' })
    .trim()
    .min(min, `Deve ter pelo menos ${min} caracteres.`);

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional();

export const AgreementTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(64);

export const AgreementBaseSchema = z
  .object({
    name: stringWithMin(3).max(120),
    slug: stringWithMin(3)
      .max(120)
      .regex(/^[a-z0-9\-]+$/, 'Use apenas letras minúsculas, números e hífens.'),
    status: z.string().trim().min(1).default('draft'),
    type: optionalString,
    segment: optionalString,
    description: optionalString,
    tags: z.array(AgreementTagSchema).max(25).optional().default([]),
    products: z
      .record(z.string(), z.unknown())
      .optional()
      .transform((value) => value ?? {}),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .transform((value) => value ?? {}),
    archived: z.boolean().optional().default(false),
  })
  .strict();

export const CreateAgreementSchema = AgreementBaseSchema.extend({
  publishedAt: z.coerce.date().optional(),
});

export const UpdateAgreementSchema = AgreementBaseSchema.partial().extend({
  publishedAt: z.coerce.date().optional().nullable(),
});

export const AgreementWindowSchema = z
  .object({
    id: optionalString,
    tableId: optionalString,
    label: stringWithMin(3).max(80),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .transform((value) => value ?? {}),
  })
  .strict();

export const AgreementRateSchema = z
  .object({
    id: optionalString,
    tableId: optionalString,
    windowId: optionalString,
    product: stringWithMin(2).max(120),
    modality: stringWithMin(2).max(80),
    termMonths: z.coerce.number().int().positive().optional(),
    coefficient: z.coerce.number().min(0).optional(),
    monthlyRate: z.coerce.number().min(0).optional(),
    annualRate: z.coerce.number().min(0).optional(),
    tacPercentage: z.coerce.number().min(0).optional(),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .transform((value) => value ?? {}),
  })
  .strict();

export const AgreementHistoryFilterSchema = z
  .object({
    cursor: optionalString,
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const AgreementListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    search: optionalString,
    status: optionalString,
  })
  .strict();

export const AgreementImportRequestSchema = z
  .object({
    agreementId: stringWithMin(3).max(120),
    checksum: stringWithMin(8).max(128),
    fileName: stringWithMin(3).max(180),
    tempFilePath: stringWithMin(1),
    mimeType: optionalString,
    size: z.coerce.number().int().min(1),
  })
  .strict();

export type AgreementPayload = z.infer<typeof CreateAgreementSchema>;
export type AgreementUpdatePayload = z.infer<typeof UpdateAgreementSchema>;
export type AgreementWindowPayload = z.infer<typeof AgreementWindowSchema>;
export type AgreementRatePayload = z.infer<typeof AgreementRateSchema>;
export type AgreementListQuery = z.infer<typeof AgreementListQuerySchema>;
export type AgreementImportRequest = z.infer<typeof AgreementImportRequestSchema>;
