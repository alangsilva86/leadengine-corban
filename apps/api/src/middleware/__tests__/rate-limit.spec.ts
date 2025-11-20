import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachRateLimitHeaders,
  buildRateLimitConfigFromEnv,
  createRateLimitOptionsHandler,
  type RateLimitedRequest,
  type RateLimitConfig,
} from '../rate-limit';

describe('rate-limit middleware', () => {
  const fixedDate = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockResponse = () => {
    const headers: Record<string, string> = {};

    return {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      get headers() {
        return headers;
      },
    } satisfies Partial<express.Response> as express.Response & {
      headers: Record<string, string>;
    };
  };

  const expectHeaderSnapshot = (res: { headers: Record<string, string> }, expected: Record<string, string>) => {
    expect(res.headers['X-RateLimit-Limit']).toBe(expected['X-RateLimit-Limit']);
    expect(res.headers['X-RateLimit-Remaining']).toBe(expected['X-RateLimit-Remaining']);
    expect(res.headers['X-RateLimit-Reset']).toBe(expected['X-RateLimit-Reset']);
  };

  it('attaches rate limit headers based on the request rateLimit state', () => {
    const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 100 };
    const requestMock = {
      rateLimit: {
        limit: 50,
        remaining: 10,
        resetTime: new Date(fixedDate.getTime() + 30_000),
      },
    } as RateLimitedRequest;
    const responseMock = createMockResponse();

    attachRateLimitHeaders(requestMock, responseMock, config);

    expectHeaderSnapshot(responseMock, {
      'X-RateLimit-Limit': '50',
      'X-RateLimit-Remaining': '10',
      'X-RateLimit-Reset': '30',
    });
  });

  it('falls back to configured defaults when rate limit state is missing', () => {
    const config: RateLimitConfig = { windowMs: 120_000, maxRequests: 200 };
    const requestMock = {} as RateLimitedRequest;
    const responseMock = createMockResponse();

    attachRateLimitHeaders(requestMock, responseMock, config);

    expectHeaderSnapshot(responseMock, {
      'X-RateLimit-Limit': '200',
      'X-RateLimit-Remaining': '200',
      'X-RateLimit-Reset': '120',
    });
  });

  it('handles OPTIONS requests and attaches headers for API routes', async () => {
    const config = buildRateLimitConfigFromEnv({}) as RateLimitConfig;
    const app = express();

    app.use(createRateLimitOptionsHandler(config));
    app.get('/api/ping', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const optionsResponse = await request(app).options('/api/ping');

    expect(optionsResponse.status).toBe(204);
    expect(optionsResponse.headers['x-ratelimit-limit']).toBe(config.maxRequests.toString());
    expect(optionsResponse.headers['x-ratelimit-remaining']).toBe(config.maxRequests.toString());
    expect(optionsResponse.headers['x-ratelimit-reset']).toBe(Math.ceil(config.windowMs / 1000).toString());

    const nonApiResponse = await request(app).options('/healthz');

    expect(nonApiResponse.status).toBe(204);
    expect(nonApiResponse.headers['x-ratelimit-limit']).toBeUndefined();
  });
});
