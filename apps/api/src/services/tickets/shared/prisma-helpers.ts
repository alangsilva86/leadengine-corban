import { ConflictError, ServiceUnavailableError, ValidationError } from '@ticketz/core';
import { Prisma } from '@prisma/client';
import { logger } from '../../../config/logger';

const isPrismaKnownError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const extractPrismaFieldNames = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const raw = error.meta?.field_name;

  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }

  if (typeof raw === 'string') {
    return raw
      .replace(/[()"']/g, ' ')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
};

export const isForeignKeyViolation = (error: unknown, field: string): boolean => {
  if (!isPrismaKnownError(error) || error.code !== 'P2003') {
    return false;
  }

  const fieldNames = extractPrismaFieldNames(error).map((name) => name.split('.').pop() ?? name);
  return fieldNames.includes(field);
};

export const isUniqueViolation = (error: unknown): boolean => isPrismaKnownError(error) && error.code === 'P2002';

export const handleDatabaseError = (error: unknown, context: Record<string, unknown> = {}): never => {
  logger.error('ticketService.databaseError', {
    ...context,
    error:
      error instanceof Error
        ? { message: error.message, name: error.name, code: (error as { code?: unknown }).code ?? null }
        : error,
  });

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    throw new ServiceUnavailableError('Falha de conectividade com o banco de dados.', { cause: error });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ValidationError('Parâmetros inválidos para a operação no banco de dados.', { cause: error });
  }

  if (isUniqueViolation(error)) {
    throw new ConflictError('Operação violou uma restrição de unicidade no banco de dados.', { cause: error });
  }

  throw error;
};
