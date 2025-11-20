import { z } from 'zod';

export const pairingPhoneSchema = z
  .object({
    phone: z
      .string({ required_error: 'Informe o telefone que receberá o código.' })
      .trim()
      .min(10, 'Informe o telefone que receberá o código.')
      .regex(/^[0-9+()\-\s]+$/, 'Use apenas números e caracteres válidos.'),
  })
  .transform(({ phone }) => ({ phone }));

export const createInstanceSchema = z
  .object({
    name: z
      .string({ required_error: 'Informe um nome para a instância.' })
      .trim()
      .min(1, 'Informe um nome para a instância.'),
    id: z
      .string()
      .trim()
      .max(64, 'O identificador deve ter no máximo 64 caracteres.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .transform(({ name, id }) => ({
    name,
    id,
  }));

export const createCampaignSchema = z
  .object({
    name: z
      .string({ required_error: 'Informe o nome da campanha.' })
      .trim()
      .min(1, 'Informe o nome da campanha.'),
    instanceId: z
      .string({ required_error: 'Escolha a instância que será vinculada à campanha.' })
      .trim()
      .min(1, 'Escolha a instância que será vinculada à campanha.'),
    agreementId: z
      .string({ required_error: 'Selecione a origem responsável pela campanha.' })
      .trim()
      .min(1, 'Selecione a origem responsável pela campanha.'),
    agreementName: z
      .string({ required_error: 'Informe o nome da origem.' })
      .trim()
      .min(1, 'Informe o nome da origem.'),
    leadSource: z
      .string({ required_error: 'Selecione a fonte da campanha.' })
      .trim()
      .min(1, 'Selecione a fonte da campanha.'),
    product: z
      .string({ required_error: 'Selecione o produto principal.' })
      .trim()
      .min(1, 'Selecione o produto principal.'),
    margin: z
      .preprocess((value) => {
        if (typeof value === 'string') {
          const normalized = value.replace(',', '.');
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
      }, z.number({ required_error: 'Informe a margem desejada.' }))
      .refine((value) => (typeof value === 'number' ? value > 0 : false), {
        message: 'Informe a margem desejada.',
      }),
    strategy: z
      .string({ required_error: 'Selecione a estratégia operacional.' })
      .trim()
      .min(1, 'Selecione a estratégia operacional.'),
    status: z
      .enum(['active', 'paused', 'draft'], {
        required_error: 'Escolha o status inicial da campanha.',
      })
      .default('active'),
    marginType: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : 'percentage')),
    segments: z
      .array(z.string().trim().min(1))
      .optional()
      .transform((value) => (value && value.length > 0 ? Array.from(new Set(value)) : undefined)),
    tags: z
      .array(z.string().trim().min(1))
      .optional()
      .transform((value) => (value && value.length > 0 ? Array.from(new Set(value)) : undefined)),
  })
  .transform(
    ({
      name,
      instanceId,
      status,
      agreementId,
      agreementName,
      leadSource,
      product,
      margin,
      strategy,
      marginType,
      segments,
      tags,
    }) => ({
      name,
      instanceId,
      status,
      agreementId,
      agreementName,
      leadSource,
      strategy,
      productType: product,
      marginType,
      marginValue: margin,
      ...(segments ? { segments } : {}),
      ...(tags || segments ? { tags: Array.from(new Set([...(tags ?? []), ...(segments ?? [])])) } : {}),
    })
  );

export type PairingPhoneInput = z.infer<typeof pairingPhoneSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
