import type { Response } from 'express';
import { ZodError, z } from 'zod';
import { ContactStatusSchema, ContactTaskStatusSchema } from '@ticketz/core';

import { respondWithValidationError } from '../../utils/http-validation';

export const TagsParamSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    const tags = value
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .map((item) => item.trim())
      .filter(Boolean);
    return tags.length ? tags : undefined;
  }

  if (typeof value === 'string') {
    const tags = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return tags.length ? tags : undefined;
  }

  return undefined;
}, z.array(z.string()).optional());

export const StatusParamSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const rawItems = Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry : String(entry)))
    : typeof value === 'string' && value.trim()
    ? value.split(',').map((entry) => entry.trim())
    : [];

  if (!rawItems.length) {
    return undefined;
  }

  const normalized = rawItems
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== 'all');

  return normalized.length > 0 ? normalized : undefined;
}, z.array(ContactStatusSchema).optional());

export const DateParamSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}, z.date().optional());

export const BooleanParamSchema = z.preprocess((value) => {
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
}, z.boolean().optional());

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const ListContactsQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  status: StatusParamSchema,
  tags: TagsParamSchema,
  lastInteractionFrom: DateParamSchema,
  lastInteractionTo: DateParamSchema,
  hasOpenTickets: BooleanParamSchema,
  isBlocked: BooleanParamSchema,
  hasWhatsapp: BooleanParamSchema,
});

export const TaskStatusParamSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((item) => item.trim());
  }

  return undefined;
}, z.array(ContactTaskStatusSchema).optional());

export const ListContactTasksQuerySchema = PaginationQuerySchema.extend({
  status: TaskStatusParamSchema,
});

// z.guid() mantém a validação permissiva do .uuid() do zod 3 (o z.uuid() do zod 4 exige RFC 9562).
export const ContactResourceIdSchema = z.union([z.cuid(), z.guid()]);

export const ContactIdParamSchema = z.object({ contactId: ContactResourceIdSchema });
export const TaskIdParamSchema = z.object({ taskId: ContactResourceIdSchema });

export const parseOrRespond = <T>(schema: z.ZodType<T>, payload: unknown, res: Response): T | null => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      respondWithValidationError(res, error.issues);
      return null;
    }
    throw error;
  }
};
