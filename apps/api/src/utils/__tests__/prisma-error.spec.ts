import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { mapPrismaError } from '../prisma-error';

describe('mapPrismaError', () => {
  it('maps connectivity errors to 503', () => {
    const connectivityError = new Prisma.PrismaClientKnownRequestError('down', {
      code: 'P1000',
      clientVersion: 'test',
    });

    const mapped = mapPrismaError(connectivityError, {
      connectivity: {
        code: 'STORE_UNAVAILABLE',
        message: 'Indisponível',
      },
    });

    expect(mapped).toEqual({
      status: 503,
      code: 'STORE_UNAVAILABLE',
      message: 'Indisponível',
      type: 'connectivity',
    });
  });

  it('maps initialization errors to connectivity response', () => {
    const initializationError = new Prisma.PrismaClientInitializationError(
      'failed',
      'init error',
      'test'
    );
    const mapped = mapPrismaError(initializationError, {
      connectivity: {
        code: 'STORE_UNAVAILABLE',
        message: 'Indisponível',
      },
    });

    expect(mapped).toMatchObject({
      status: 503,
      type: 'connectivity',
    });
  });

  it('maps validation errors to 400', () => {
    const validationError = new Prisma.PrismaClientValidationError('invalid filters', {
      clientVersion: 'test',
    });
    const mapped = mapPrismaError(validationError, {
      validation: {
        code: 'INVALID_FILTER',
        message: 'Filtro inválido',
      },
    });

    expect(mapped).toEqual({
      status: 400,
      code: 'INVALID_FILTER',
      message: 'Filtro inválido',
      type: 'validation',
    });
  });

  it('maps P2025 errors using provided notFound mapping', () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const mapped = mapPrismaError(notFoundError, {
      notFound: {
        code: 'NOT_FOUND',
        message: 'Registro não existe',
      },
    });

    expect(mapped).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Registro não existe',
      type: 'not-found',
    });
  });

  it('supports mapping P2025 to conflict responses', () => {
    const conflictError = new Prisma.PrismaClientKnownRequestError('state error', {
      code: 'P2025',
      clientVersion: 'test',
    });

    const mapped = mapPrismaError(conflictError, {
      conflict: {
        code: 'BAD_STATE',
        message: 'Estado inválido',
        status: 409,
      },
    });

    expect(mapped).toEqual({
      status: 409,
      code: 'BAD_STATE',
      message: 'Estado inválido',
      type: 'conflict',
    });
  });

  it('returns null for unknown errors', () => {
    const mapped = mapPrismaError(new Error('generic'), {});
    expect(mapped).toBeNull();
  });
});
