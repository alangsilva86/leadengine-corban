import { z } from 'zod';

type NullableString = string | null;
type NullableNumber = number | null;

export type ContactField = 'name' | 'document' | 'email' | 'phone';
export type DealField = 'installmentValue' | 'netValue' | 'term' | 'product' | 'bank';

const normalizeString = (value: unknown): NullableString => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

export const normalizeTextValue = (value: unknown): NullableString => normalizeString(value);

export const normalizeCurrencyValue = (value: unknown): NullableNumber => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const cleaned = text.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');

  if (!cleaned) {
    return null;
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(',', '.');
  }

  const amount = Number.parseFloat(normalized);

  return Number.isNaN(amount) ? null : amount;
};

export const normalizeIntegerValue = (value: unknown): NullableNumber => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  const digits = String(value).replace(/\D+/g, '');

  if (!digits) {
    return null;
  }

  const normalized = Number.parseInt(digits, 10);

  return Number.isNaN(normalized) ? null : normalized;
};

const trimmedStringSchema = z.preprocess(normalizeString, z.string().min(1).nullable());

const phoneSchema = z.preprocess((value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  const digits = String(value).replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}, z.string().min(3).nullable());

const currencySchema = z.preprocess(normalizeCurrencyValue, z.number().nullable());
const integerSchema = z.preprocess(normalizeIntegerValue, z.number().int().nullable());
const textSchema = z.preprocess(normalizeString, z.string().min(1).nullable());

const contactFieldValueSchemas: Record<ContactField, z.ZodType<NullableString>> = {
  name: trimmedStringSchema,
  document: trimmedStringSchema,
  email: trimmedStringSchema,
  phone: phoneSchema,
};

const dealFieldValueSchemas: Record<DealField, z.ZodType<NullableString | NullableNumber>> = {
  installmentValue: currencySchema,
  netValue: currencySchema,
  term: integerSchema,
  product: textSchema,
  bank: textSchema,
};

export const normalizeContactFieldValue = (field: ContactField, value: unknown): NullableString => {
  return contactFieldValueSchemas[field].parse(value);
};

export const normalizeDealFieldValue = (field: DealField, value: unknown): NullableString | NullableNumber => {
  return dealFieldValueSchemas[field].parse(value);
};

export const contactFieldUpdateSchema = z
  .object({
    field: z.enum(['name', 'document', 'email', 'phone']),
    value: z.unknown(),
  })
  .transform(({ field, value }) => ({
    field,
    value: normalizeContactFieldValue(field, value),
  }));

export const dealFieldUpdateSchema = z
  .object({
    field: z.enum(['installmentValue', 'netValue', 'term', 'product', 'bank']),
    value: z.unknown(),
  })
  .transform(({ field, value }) => ({
    field,
    value: normalizeDealFieldValue(field, value),
  }));

export type ContactFieldUpdate = z.infer<typeof contactFieldUpdateSchema>;
export type DealFieldUpdate = z.infer<typeof dealFieldUpdateSchema>;
