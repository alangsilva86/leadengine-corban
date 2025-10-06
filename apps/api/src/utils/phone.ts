import { z } from 'zod';

const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

const MIN_LENGTH = 8;
const MAX_LENGTH = 15; // E.164 max without plus

export class PhoneNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneNormalizationError';
  }
}

const PhoneSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => digitsOnly(value))
  .superRefine((value, ctx) => {
    if (value.length < MIN_LENGTH) {
      ctx.addIssue({
        code: 'too_small',
        minimum: MIN_LENGTH,
        type: 'number',
        inclusive: true,
        message: `Informe um telefone com ao menos ${MIN_LENGTH} dígitos.`,
        path: [],
      });
    }

    if (value.length > MAX_LENGTH) {
      ctx.addIssue({
        code: 'too_big',
        maximum: MAX_LENGTH,
        type: 'number',
        inclusive: true,
        message: `Telefone excede o limite de ${MAX_LENGTH} dígitos para E.164.`,
        path: [],
      });
    }
  });

export type NormalizedPhone = {
  e164: string;
  digits: string;
};

export const normalizePhoneNumber = (input: string): NormalizedPhone => {
  try {
    const digits = PhoneSchema.parse(input);
    const e164 = digits.startsWith('+') ? digits : `+${digits}`;
    return {
      e164,
      digits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telefone inválido';
    throw new PhoneNormalizationError(message);
  }
};

export const isValidPhoneNumber = (input: string): boolean => {
  try {
    PhoneSchema.parse(input);
    return true;
  } catch {
    return false;
  }
};
