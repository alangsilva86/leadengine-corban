import { logger } from './logger';

let cachedJwtSecret: string | undefined;

const resolveJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    const message =
      'JWT_SECRET environment variable is required but was not provided. Set JWT_SECRET to a strong secret value before starting the API server.';
    logger.error(message);
    throw new Error(message);
  }
  return secret;
};

export const getJwtSecret = (): string => {
  if (!cachedJwtSecret) {
    cachedJwtSecret = resolveJwtSecret();
  }
  return cachedJwtSecret;
};

export const JWT_SECRET = getJwtSecret();
