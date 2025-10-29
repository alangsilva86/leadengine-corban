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
    status: z
      .enum(['active', 'paused', 'draft'], {
        required_error: 'Escolha o status inicial da campanha.',
      })
      .default('active'),
  })
  .transform(({ name, instanceId, status }) => ({ name, instanceId, status }));

export type PairingPhoneInput = z.infer<typeof pairingPhoneSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
