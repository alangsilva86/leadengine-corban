import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '@ticketz/core';

const PRIMARY_HEADER = 'x-platform-admin-token';
const FALLBACK_HEADER = 'x-platform-admin';
const ENV_TOKEN = (process.env.PLATFORM_ADMIN_TOKEN ?? '').trim();

const readHeader = (req: Request, headerName: string): string | null => {
  const raw = req.headers[headerName];

  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw[0] ?? '').toString().trim() : null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const isValidToken = (token: string): boolean => {
  if (!ENV_TOKEN) return false;
  const expected = Buffer.from(ENV_TOKEN);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const requirePlatformAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authenticated user is required for platform admin access.'));
  }

  const providedToken = readHeader(req, PRIMARY_HEADER) ?? readHeader(req, FALLBACK_HEADER);

  if (!providedToken) {
    return next(new ForbiddenError('Platform admin token missing.'));
  }

  if (!isValidToken(providedToken)) {
    return next(new ForbiddenError('Invalid platform admin token.'));
  }

  next();
};
