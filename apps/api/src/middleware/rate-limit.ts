import type express from 'express';

const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

type RateLimitState = {
  limit?: number;
  remaining?: number;
  resetTime?: Date;
};

export type RateLimitedRequest = express.Request & { rateLimit?: RateLimitState };

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const parseRateLimitWindowMs = (env: NodeJS.ProcessEnv): number => {
  const parsed = Number(env.RATE_LIMIT_WINDOW_MS);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_RATE_LIMIT_WINDOW_MS;
};

const parseRateLimitMaxRequests = (env: NodeJS.ProcessEnv): number => {
  const parsed = Number(env.RATE_LIMIT_MAX_REQUESTS);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_RATE_LIMIT_MAX_REQUESTS;
};

export const buildRateLimitConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): RateLimitConfig => ({
  windowMs: parseRateLimitWindowMs(env),
  maxRequests: parseRateLimitMaxRequests(env),
});

export const attachRateLimitHeaders = (
  req: RateLimitedRequest,
  res: express.Response,
  { windowMs, maxRequests }: RateLimitConfig,
): void => {
  const rateLimit = req.rateLimit;
  const limit = typeof rateLimit?.limit === 'number' ? rateLimit.limit : maxRequests;
  const remaining = typeof rateLimit?.remaining === 'number' ? Math.max(0, rateLimit.remaining) : limit;
  const resetReference = rateLimit?.resetTime instanceof Date ? rateLimit.resetTime : null;
  const resetTime = resetReference ?? new Date(Date.now() + windowMs);
  const resetSeconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
};

export const createRateLimitOptionsHandler = (config: RateLimitConfig): express.RequestHandler => {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      if (req.path.startsWith('/api')) {
        attachRateLimitHeaders(req as RateLimitedRequest, res, config);
      }
      res.status(204).end();
      return;
    }

    next();
  };
};
