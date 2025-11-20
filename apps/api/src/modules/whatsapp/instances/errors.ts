import { logger } from '../../../config/logger';
import {
  whatsappStorageLatencySummary,
  whatsappStorageUnavailableCounter,
} from '../../../lib/metrics';

const PRISMA_STORAGE_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1014',
  'P1015',
  'P1016',
  'P1017',
  'P2000',
  'P2001',
  'P2002',
  'P2003',
  'P2004',
  'P2005',
  'P2006',
  'P2007',
  'P2008',
  'P2009',
  'P2010',
  'P2021',
  'P2022',
  'P2023',
  'P2024',
]);

const DATABASE_DISABLED_ERROR_CODES = new Set([
  'DATABASE_DISABLED',
  'STORAGE_DATABASE_DISABLED',
]);

export const hasErrorName = (error: unknown, expected: string): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === expected
  );
};

export const readPrismaErrorCode = (error: unknown): string | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  return null;
};

export const isDatabaseDisabledError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (hasErrorName(error, 'DatabaseDisabledError')) {
    return true;
  }

  const code = readPrismaErrorCode(error);
  if (code && DATABASE_DISABLED_ERROR_CODES.has(code)) {
    return true;
  }

  if (
    typeof error === 'object' &&
    'code' in (error as Record<string, unknown>) &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const normalized = ((error as { code?: string }).code ?? '').toString().trim();
    if (DATABASE_DISABLED_ERROR_CODES.has(normalized)) {
      return true;
    }
  }

  return false;
};

export const resolveWhatsAppStorageError = (
  error: unknown
): { isStorageError: boolean; prismaCode: string | null } => {
  if (isDatabaseDisabledError(error)) {
    return { isStorageError: true, prismaCode: 'DATABASE_DISABLED' };
  }

  const prismaCode = readPrismaErrorCode(error);

  if (prismaCode && PRISMA_STORAGE_ERROR_CODES.has(prismaCode)) {
    return { isStorageError: true, prismaCode };
  }

  if (
    hasErrorName(error, 'PrismaClientInitializationError') ||
    hasErrorName(error, 'PrismaClientRustPanicError')
  ) {
    return { isStorageError: true, prismaCode: null };
  }

  return { isStorageError: false, prismaCode: null };
};

export const describeErrorForLog = (error: unknown): unknown => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  if (typeof error === 'object' && error !== null) {
    return error;
  }

  return { value: error };
};

const deriveOperationType = (operation: string, fallback?: string | null): string => {
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  const normalized = operation.toLowerCase();
  const isRead = normalized.includes('get') || normalized.includes('read');

  if (normalized.includes('snapshot')) {
    return isRead ? 'snapshot.read' : 'snapshot.write';
  }

  if (normalized.includes('qr')) {
    return isRead ? 'qr.read' : 'qr.write';
  }

  if (normalized.includes('cache')) {
    return isRead ? 'snapshot.read' : 'snapshot.write';
  }

  if (normalized.includes('archive')) {
    return 'snapshot.write';
  }

  return 'storage';
};

export const observeStorageLatency = (
  operation: string,
  startedAt: number,
  outcome: 'success' | 'failure',
  context: { tenantId?: string; instanceId?: string | null; operationType?: string | null } = {}
): void => {
  const durationMs = Date.now() - startedAt;

  try {
    whatsappStorageLatencySummary.observe(
      {
        tenantId: context.tenantId,
        instanceId: context.instanceId,
        operation: deriveOperationType(operation, context.operationType),
        outcome,
      },
      durationMs
    );
  } catch {
    // metrics are best effort
  }
};

const incrementStorageUnavailable = (
  operation: string,
  context: { tenantId?: string; instanceId?: string | null; operationType?: string | null; errorCode?: string | null }
): void => {
  try {
    whatsappStorageUnavailableCounter.inc({
      tenantId: context.tenantId,
      instanceId: context.instanceId,
      operation: deriveOperationType(operation, context.operationType),
      errorCode: context.errorCode ?? 'WHATSAPP_STORAGE_UNAVAILABLE',
    });
  } catch {
    // ignore metric failures
  }
};

export const trackStorageUnavailable = (
  operation: string,
  context: { tenantId?: string; instanceId?: string | null; operationType?: string | null; errorCode?: string | null }
): void => incrementStorageUnavailable(operation, context);

export function logWhatsAppStorageError(
  operation: string,
  error: unknown,
  context: Record<string, unknown> & { tenantId?: string; instanceId?: string | null; operationType?: string | null } = {}
): boolean {
  const { isStorageError, prismaCode } = resolveWhatsAppStorageError(error);

  if (!isStorageError) {
    return false;
  }

  const operationType = deriveOperationType(operation, context.operationType);

  logger.warn(`whatsapp.storage.${operation}.failed`, {
    operation,
    operationType,
    tenantId: context.tenantId ?? null,
    instanceId: context.instanceId ?? null,
    ...(prismaCode ? { prismaCode } : {}),
    ...context,
    error: describeErrorForLog(error),
  });

  return true;
}
