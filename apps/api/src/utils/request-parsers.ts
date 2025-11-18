import type { Request } from 'express';
import { WhatsAppBrokerError } from '../services/whatsapp-broker-client';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';

export const parseListParam = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return undefined;
};

export const parseDateParam = (value: unknown): Date | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
};

export const parseBooleanParam = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

export const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalizedEntry = normalizeQueryValue(entry);
      if (normalizedEntry) {
        return normalizedEntry;
      }
    }
    return undefined;
  }

  const normalized = normalizeString(value);
  return normalized ?? undefined;
};

export const safeTruncate = (value: unknown, limit = 2000): string => {
  if (typeof value === 'string') {
    return value.length > limit ? value.slice(0, limit) : value;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return '';
    }
    return serialized.length > limit ? serialized.slice(0, limit) : serialized;
  } catch (error) {
    const fallback = String(value);
    return fallback.length > limit ? fallback.slice(0, limit) : fallback;
  }
};

export const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ? safeTruncate(error.stack, 1000) : undefined,
    } satisfies Record<string, unknown>;
  }

  return {
    message: safeTruncate(error, 500),
  } satisfies Record<string, unknown>;
};

export const resolveRequestId = (req: Request, error?: unknown): string => {
  if (error instanceof WhatsAppBrokerError && error.requestId) {
    return error.requestId;
  }
  if (error instanceof WhatsAppTransportError && error.requestId) {
    return error.requestId;
  }
  const headerValue = typeof req.rid === 'string' && req.rid.length > 0 ? req.rid : null;
  if (headerValue) {
    return headerValue;
  }
  return `rid_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

export const resolveBrokerStatus = (error: unknown): number | null => {
  if (error instanceof WhatsAppBrokerError) {
    return typeof error.brokerStatus === 'number' ? error.brokerStatus : null;
  }
  if (error instanceof WhatsAppTransportError) {
    return typeof error.status === 'number' ? error.status : null;
  }
  return null;
};

export const resolveBrokerCode = (error: unknown): string | null => {
  if (error instanceof WhatsAppBrokerError) {
    return error.brokerCode ?? null;
  }
  if (error instanceof WhatsAppTransportError) {
    return error.code ?? null;
  }
  return null;
};
