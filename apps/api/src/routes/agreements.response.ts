import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../config/logger';
import { DatabaseDisabledError } from '../lib/prisma';
import { formatZodIssues } from '../utils/http-validation';

const STORAGE_DISABLED_ERROR_CODES = new Set(['DATABASE_DISABLED', 'STORAGE_DATABASE_DISABLED']);
const STORAGE_UNAVAILABLE_PRISMA_CODES = new Set([
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

const readErrorCode = (error: unknown): string | null => {
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

const isStorageDisabledError = (error: unknown): boolean => {
  if (error instanceof DatabaseDisabledError) {
    return true;
  }

  const code = readErrorCode(error);
  return Boolean(code && STORAGE_DISABLED_ERROR_CODES.has(code));
};

const resolveStorageUnavailableError = (error: unknown): { prismaCode?: string } | null => {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {};
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (STORAGE_UNAVAILABLE_PRISMA_CODES.has(error.code)) {
      return { prismaCode: error.code };
    }
    return null;
  }

  const code = readErrorCode(error);
  if (code && STORAGE_UNAVAILABLE_PRISMA_CODES.has(code)) {
    return { prismaCode: code };
  }

  return null;
};

export const respondSuccess = (
  res: Response,
  status: number,
  data: unknown,
  meta: Record<string, unknown> = {}
) => {
  res.status(status).json({
    data,
    meta: {
      requestId: res.locals.requestId ?? null,
      generatedAt: new Date().toISOString(),
      ...meta,
    },
  });
};

export const respondError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) => {
  res.status(status).json({
    data: null,
    meta: { requestId: res.locals.requestId ?? null },
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
};

const handleZodError = (res: Response, error: ZodError) => {
  const issues = formatZodIssues(error.issues);
  respondError(res, 400, 'VALIDATION_ERROR', 'Requisição inválida.', { errors: issues });
};

export const handleServiceError = (
  res: Response,
  error: unknown,
  context: Record<string, unknown> = {}
) => {
  if (error instanceof ZodError) {
    handleZodError(res, error);
    return;
  }

  if (isStorageDisabledError(error)) {
    logger.warn('[/agreements] storage disabled', { ...context });
    respondError(
      res,
      503,
      'AGREEMENTS_STORAGE_DISABLED',
      'Persistência de convênios desabilitada neste ambiente. Configure DATABASE_URL ou habilite o tenant demo.'
    );
    return;
  }

  const storageError = resolveStorageUnavailableError(error);
  if (storageError) {
    logger.error('[/agreements] storage unavailable', { ...context, error });
    respondError(
      res,
      503,
      'AGREEMENTS_STORAGE_UNAVAILABLE',
      'Banco de convênios indisponível. Execute as migrações pendentes ou verifique a conexão com o banco.',
      storageError.prismaCode ? { prismaCode: storageError.prismaCode } : undefined
    );
    return;
  }

  const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 500;
  const code = typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : 'AGREEMENTS_ERROR';
  const message = error instanceof Error ? error.message : 'Erro inesperado.';

  logger.error('[/agreements] operation failed', { ...context, error });
  respondError(res, status, code, message);
};
