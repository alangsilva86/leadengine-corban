import { setTimeout as delay } from 'node:timers/promises';

import { fetch, Headers, type HeadersInit, type RequestInit, type Response } from 'undici';

import type { BankIntegrationSettings } from '../../../config/bank-integrations';
import { logger } from '../../../config/logger';
import { createLeadEngineError } from '../../lead-engine-client';

import type {
  BankIntegrationAgreementRaw,
  BankIntegrationClient,
  BankIntegrationRequestContext,
  BankIntegrationResponseEnvelope,
  BankPaginatedRequestConfig,
} from './types';

const LOG_PREFIX = '[AgreementsSync]';

class RequestThrottler {
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  constructor(private readonly intervalMs: number, private readonly maxPerInterval: number) {}

  async schedule<T>(operation: () => Promise<T>): Promise<T> {
    if (this.maxPerInterval <= 0 || this.intervalMs <= 0) {
      return operation();
    }

    const execute = async () => {
      const now = Date.now();
      const minInterval = Math.ceil(this.intervalMs / this.maxPerInterval);
      const elapsed = now - this.lastCallAt;
      if (elapsed < minInterval) {
        await delay(minInterval - elapsed);
      }

      const result = await operation();
      this.lastCallAt = Date.now();
      return result;
    };

    this.queue = this.queue.then(execute, execute);
    return this.queue as Promise<T>;
  }
}

const buildHeaders = (init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
};

export abstract class BankIntegrationHttpClient implements BankIntegrationClient {
  protected readonly throttler: RequestThrottler;

  constructor(public readonly settings: BankIntegrationSettings) {
    this.throttler = new RequestThrottler(
      settings.throttle.intervalMs,
      settings.throttle.maxRequestsPerInterval
    );
  }

  protected buildUrl(path: string): string {
    const trimmedBase = this.settings.baseUrl.replace(/\/$/, '');
    if (!trimmedBase) {
      throw new Error(`Base URL ausente para ${this.settings.id}`);
    }
    if (!path.startsWith('/')) {
      return `${trimmedBase}/${path}`;
    }
    return `${trimmedBase}${path}`;
  }

  protected applyAuth(headers: Headers): void {
    const auth = this.settings.auth;
    if (!auth) {
      return;
    }

    switch (auth.type) {
      case 'apiKey':
        headers.set(auth.header, auth.value);
        break;
      case 'basic': {
        const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers.set('Authorization', `Basic ${token}`);
        break;
      }
      case 'bearer':
        headers.set('Authorization', `Bearer ${auth.token}`);
        break;
      default:
        break;
    }
  }

  protected async request<T>(
    path: string,
    init: RequestInit = {},
    query?: URLSearchParams,
    context?: BankIntegrationRequestContext
  ): Promise<T> {
    const url = this.buildUrl(path);
    const resolvedUrl = query ? `${url}?${query.toString()}` : url;

    const headers = buildHeaders(init);
    this.applyAuth(headers);

    const startedAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);

    const execute = async (): Promise<T> => {
      try {
        const response = await fetch(resolvedUrl, {
          ...init,
          headers,
          signal: controller.signal,
        });

        return this.handleResponse<T>(response, resolvedUrl, context);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw createLeadEngineError(`Timeout ao chamar ${this.settings.name}`, { status: 504 });
        }

        throw createLeadEngineError(
          `Falha ao chamar ${this.settings.name}: ${error instanceof Error ? error.message : String(error)}`,
          { status: 503 }
        );
      }
    };

    try {
      const result = await this.throttler.schedule(async () => this.retry(execute, context));
      const elapsedMs = Date.now() - startedAt;
      logger.debug(`${LOG_PREFIX} ✅ ${this.settings.id} resposta`, {
        providerId: this.settings.id,
        url: resolvedUrl,
        elapsedMs,
        traceId: context?.traceId ?? null,
      });
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async retry<T>(operation: () => Promise<T>, context?: BankIntegrationRequestContext): Promise<T> {
    const maxAttempts = Math.max(this.settings.maxRetries, 1);
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      try {
        attempt += 1;
        return await operation();
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt >= maxAttempts;
        logger.warn(`${LOG_PREFIX} ⚠️ Falha ao chamar ${this.settings.id}`, {
          providerId: this.settings.id,
          attempt,
          maxAttempts,
          traceId: context?.traceId ?? null,
          error,
        });
        if (isLastAttempt) {
          throw error;
        }
        const backoffMs = Math.min(2 ** attempt * 250, 5_000);
        await delay(backoffMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : createLeadEngineError(`Falha desconhecida ao chamar ${this.settings.name}`);
  }

  private async handleResponse<T>(response: Response, url: string, context?: BankIntegrationRequestContext): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      logger.error(`${LOG_PREFIX} ❌ ${this.settings.id} respondeu ${response.status}`, {
        providerId: this.settings.id,
        status: response.status,
        statusText: response.statusText,
        traceId: context?.traceId ?? null,
        body: body.slice(0, 500),
      });
      throw createLeadEngineError(
        `${this.settings.name} respondeu ${response.status}: ${response.statusText || 'Erro desconhecido'}`,
        {
          status: response.status,
          statusText: response.statusText,
          details: body,
        }
      );
    }

    const payload = (await response.json()) as T;
    return payload;
  }

  protected async paginate<T>(
    path: string,
    config: BankPaginatedRequestConfig,
    handler: (response: unknown, page: number) => { items: T[]; hasNext: boolean; cursor?: string | number | null },
    context: BankIntegrationRequestContext,
    init: RequestInit = {}
  ): Promise<T[]> {
    const results: T[] = [];
    const pagination = config.pagination;
    let page = pagination.initialPage;
    let keepFetching = true;

    while (keepFetching) {
      const params = new URLSearchParams();
      params.set(pagination.pageParam, String(page));
      const size = config.pageSizeOverride ?? pagination.maxPageSize;
      params.set(pagination.sizeParam, String(size));

      const response = await this.request<unknown>(path, init, params, context);
      const pageResult = handler(response, page);
      results.push(...pageResult.items);

      if (!pageResult.hasNext) {
        keepFetching = false;
      } else if (typeof pageResult.cursor === 'number') {
        page = pageResult.cursor;
      } else {
        page += 1;
      }
    }

    return results;
  }

  protected abstract fetchFromProvider(
    context: BankIntegrationRequestContext
  ): Promise<BankIntegrationAgreementRaw[]>;

  async fetchAgreements(context: BankIntegrationRequestContext): Promise<BankIntegrationAgreementRaw[]> {
    logger.info(`${LOG_PREFIX} ⏳ Iniciando coleta de convênios`, {
      providerId: this.settings.id,
      traceId: context.traceId,
    });
    return this.fetchFromProvider(context);
  }
}

export const ensureEnvelope = <T>(payload: unknown): BankIntegrationResponseEnvelope<T> => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const data = Array.isArray(record.data) ? (record.data as T[]) : [];
    const pagination = record.pagination && typeof record.pagination === 'object'
      ? (record.pagination as BankIntegrationResponseEnvelope<T>['pagination'])
      : undefined;
    return { data, pagination };
  }

  if (Array.isArray(payload)) {
    return { data: payload as T[] };
  }

  return { data: [] };
};

export const __testing = {
  RequestThrottler,
  buildHeaders,
};

