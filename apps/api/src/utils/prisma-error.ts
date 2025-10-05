import { Prisma } from '@prisma/client';

type PrismaHttpErrorType = 'connectivity' | 'validation' | 'not-found' | 'conflict';

export interface PrismaHttpError {
  status: number;
  code: string;
  message: string;
  type: PrismaHttpErrorType;
}

export interface PrismaErrorMappingOptions {
  connectivity?: { code: string; message: string; status?: number };
  validation?: { code: string; message: string; status?: number };
  notFound?: { code: string; message: string; status?: 404 | 409 };
  conflict?: { code: string; message: string; status?: 409 };
}

const CONNECTIVITY_ERROR_CODES = new Set(
  Array.from({ length: 18 }, (_, index) => `P${(1000 + index).toString()}`)
);

const isKnownRequestError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const isValidationError = (
  error: unknown
): error is Prisma.PrismaClientValidationError =>
  error instanceof Prisma.PrismaClientValidationError;

const isInitializationError = (
  error: unknown
): error is Prisma.PrismaClientInitializationError =>
  error instanceof Prisma.PrismaClientInitializationError;

const isRustPanicError = (
  error: unknown
): error is Prisma.PrismaClientRustPanicError =>
  error instanceof Prisma.PrismaClientRustPanicError;

export const mapPrismaError = (
  error: unknown,
  options: PrismaErrorMappingOptions
): PrismaHttpError | null => {
  if (isKnownRequestError(error)) {
    if (CONNECTIVITY_ERROR_CODES.has(error.code)) {
      const connectivity = options.connectivity ?? {
        code: 'PRISMA_CONNECTIVITY_ERROR',
        message: 'Falha de conectividade com o banco de dados.',
        status: 503,
      };
      return {
        status: connectivity.status ?? 503,
        code: connectivity.code,
        message: connectivity.message,
        type: 'connectivity',
      } satisfies PrismaHttpError;
    }

    if (error.code === 'P2025') {
      if (options.notFound) {
        return {
          status: options.notFound.status ?? 404,
          code: options.notFound.code,
          message: options.notFound.message,
          type: options.notFound.status === 409 ? 'conflict' : 'not-found',
        } satisfies PrismaHttpError;
      }

      if (options.conflict) {
        return {
          status: options.conflict.status ?? 409,
          code: options.conflict.code,
          message: options.conflict.message,
          type: 'conflict',
        } satisfies PrismaHttpError;
      }

      return {
        status: 404,
        code: 'PRISMA_RECORD_NOT_FOUND',
        message: 'Registro não encontrado.',
        type: 'not-found',
      } satisfies PrismaHttpError;
    }
  }

  if (isValidationError(error)) {
    const validation = options.validation ?? {
      code: 'PRISMA_VALIDATION_ERROR',
      message: 'Parâmetros inválidos para a consulta Prisma.',
      status: 400,
    };
    return {
      status: validation.status ?? 400,
      code: validation.code,
      message: validation.message,
      type: 'validation',
    } satisfies PrismaHttpError;
  }

  if (isInitializationError(error) || isRustPanicError(error)) {
    const connectivity = options.connectivity ?? {
      code: 'PRISMA_CONNECTIVITY_ERROR',
      message: 'Falha de conectividade com o banco de dados.',
      status: 503,
    };
    return {
      status: connectivity.status ?? 503,
      code: connectivity.code,
      message: connectivity.message,
      type: 'connectivity',
    } satisfies PrismaHttpError;
  }

  return null;
};

export const isPrismaConnectivityError = (error: unknown): boolean => {
  if (isKnownRequestError(error)) {
    return CONNECTIVITY_ERROR_CODES.has(error.code);
  }

  return isInitializationError(error) || isRustPanicError(error);
};
