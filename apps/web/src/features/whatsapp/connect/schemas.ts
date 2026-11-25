import { z } from 'zod';

/** Mensagem quando o campo não foi enviado (equivale ao `required_error` do zod 3). */
const requiredError = (message: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? message : undefined),
});

const pairingPhoneSchema = z
  .object({
    phone: z
      .string(requiredError('Informe o telefone que receberá o código.'))
      .trim()
      .min(10, 'Informe o telefone que receberá o código.')
      .regex(/^[0-9+()\-\s]+$/, 'Use apenas números e caracteres válidos.'),
  })
  .transform(({ phone }) => ({ phone }));

const createInstanceSchema = z
  .object({
    name: z
      .string(requiredError('Informe um nome para o número.'))
      .trim()
      .min(1, 'Informe um nome para o número.'),
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
      .string(requiredError('Informe o nome da regra.'))
      .trim()
      .min(1, 'Informe o nome da regra.'),
    instanceId: z
      .string(requiredError('Escolha o número que vai receber os leads da regra.'))
      .trim()
      .min(1, 'Escolha o número que vai receber os leads da regra.'),
    agreementId: z
      .string(requiredError('Informe a origem dos leads.'))
      .trim()
      .min(1, 'Informe a origem dos leads.'),
    agreementName: z
      .string(requiredError('Informe o nome da origem dos leads.'))
      .trim()
      .min(1, 'Informe o nome da origem dos leads.'),
    product: z
      .string(requiredError('Selecione o produto principal.'))
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
      }, z.number(requiredError('Informe a margem desejada.')))
      .refine((value) => (typeof value === 'number' ? value > 0 : false), {
        error: 'Informe a margem desejada.',
      }),
    strategy: z
      .string(requiredError('Selecione a estratégia operacional.'))
      .trim()
      .min(1, 'Selecione a estratégia operacional.'),
    status: z
      .enum(['active', 'paused', 'draft'], requiredError('Escolha o status inicial da regra.'))
      .default('active'),
    leadSource: z.enum(['inbound', 'internal_list', 'partner'], requiredError('Selecione a origem dos leads.')),
    marginType: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : 'percentage')),
    segments: z
      .array(z.string().trim().min(1))
      .optional()
      .transform((value) => {
        if (!value || value.length === 0) {
          return [] as string[];
        }
        const normalized = value
          .map((entry) => entry.trim())
          .filter(Boolean);
        return Array.from(new Set(normalized));
      }),
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
      tags,
      segments = [],
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
      ...(segments.length ? { segments } : {}),
      ...(tags || segments.length
        ? { tags: Array.from(new Set([...(tags ?? []), ...segments])) }
        : {}),
    })
  );

export type PairingPhoneInput = z.infer<typeof pairingPhoneSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
