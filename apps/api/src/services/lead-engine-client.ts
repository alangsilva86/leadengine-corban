import { fetch, Headers, type HeadersInit, type RequestInit, type Response } from 'undici';
import {
  leadEngineConfig,
  type BrokerLeadRecord as ConfigBrokerLeadRecord,
} from '../config/lead-engine';
import { getUseRealDataFlag } from '../config/feature-flags';
import { logger } from '../config/logger';

const LOG_PREFIX = '[LeadEngine]';

export interface LeadEngineError extends Error {
  status?: number;
  statusText?: string;
  retryAfter?: string | number;
  details?: unknown;
}

export const createLeadEngineError = (
  message: string,
  options: { status?: number; statusText?: string; retryAfter?: string | number; details?: unknown } = {}
): LeadEngineError => {
  const error = new Error(message) as LeadEngineError;
  if (options.status !== undefined) {
    error.status = options.status;
  }
  if (options.statusText !== undefined) {
    error.statusText = options.statusText;
  }
  if (options.retryAfter !== undefined) {
    error.retryAfter = options.retryAfter;
  }
  if (options.details !== undefined) {
    error.details = options.details;
  }
  return error;
};

// ============================================================================
// Types baseados na API real
// ============================================================================

export interface IngestLeadRequest {
  document: string;
  registrations: {
    number: string;
    agreementCode: string;
  }[];
}

export interface CreditLeadRequest {
  RegistrationNumber: string;
  Document: string;
}

export interface LeadResponse {
  data?: BrokerLeadRecord[];
  items?: BrokerLeadRecord[];
  value?: {
    data?: BrokerLeadRecord[];
    total?: number;
  };
  total?: number;
  pagination?: {
    page: number;
    size: number;
    total: number;
  };
}

export type BrokerLeadRecord = ConfigBrokerLeadRecord & {
  agreementCode?: string;
  createdAt?: string;
  updatedAt?: string;
};
// ============================================================================
// Dados de fallback para desenvolvimento
// ============================================================================

const FALLBACK_LEADS: BrokerLeadRecord[] = [
  {
    id: 'demo-lead-1',
    fullName: 'Maria Helena Souza',
    document: '09941751919',
    registrations: ['1839'],
    agreementId: 'saec-goiania',
    agreementCode: 'SaecGoiania',
    phone: '+5562999887766',
    margin: 487.5,
    netMargin: 390,
    score: 92,
    tags: ['respondido', 'whatsapp'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-lead-2',
    fullName: 'Carlos Henrique Lima',
    document: '82477214500',
    registrations: ['1920'],
    agreementId: 'saec-goiania',
    agreementCode: 'SaecGoiania',
    phone: '+5562999776655',
    margin: 512.4,
    netMargin: 405.8,
    score: 88,
    tags: ['novo', 'sms'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-lead-3',
    fullName: 'Fernanda Alves Ribeiro',
    document: '15840762033',
    registrations: ['2044'],
    agreementId: 'rf1-boa-vista',
    agreementCode: 'Rf1BoaVista',
    phone: '+5595999776655',
    margin: 462.75,
    netMargin: 371.4,
    score: 86,
    tags: ['respondido', 'whatsapp'],
    createdAt: new Date().toISOString(),
  },
];

// ============================================================================
// Cliente Lead Engine atualizado
// ============================================================================

class LeadEngineClient {
  private readonly baseUrl: string;
  private readonly creditBaseUrl?: string;
  private readonly timeoutMs: number;
  private readonly token: string;
  private readonly useRealData: boolean;

  constructor() {
    this.baseUrl = leadEngineConfig.baseUrl.replace(/\/$/, '');
    this.creditBaseUrl = leadEngineConfig.creditBaseUrl?.replace(/\/$/, '');
    this.timeoutMs = leadEngineConfig.timeoutMs;
    this.token = leadEngineConfig.basicToken;
    this.useRealData = getUseRealDataFlag();

    logger.info(`${LOG_PREFIX} ✨ Cliente inicializado`, {
      baseUrl: this.baseUrl,
      creditBaseUrl: this.creditBaseUrl ?? null,
      timeoutMs: this.timeoutMs,
      hasToken: Boolean(this.token),
      useRealData: this.useRealData,
      defaultStartDate: leadEngineConfig.defaultStartDate ?? null,
      defaultEndDate: leadEngineConfig.defaultEndDate ?? null,
    });
  }

  private ensureBasic(token?: string): string | undefined {
    if (!token) {
      return undefined;
    }
    return token.startsWith('Basic ') ? token : `Basic ${token}`;
  }

  private assertConfigured(path: string, baseUrl?: string): void {
    const resolvedBaseUrl = baseUrl ?? this.baseUrl;
    if (!resolvedBaseUrl || !this.token) {
      logger.error(`${LOG_PREFIX} 🚨 Configuração ausente para chamada`, {
        baseUrl: resolvedBaseUrl || null,
        hasToken: Boolean(this.token),
        path,
      });
      throw new Error('Lead Engine broker não está configurado (baseUrl/token ausentes).');
    }
  }

  private async request<T>(path: string, init?: RequestInit, baseUrl?: string): Promise<T> {
    this.assertConfigured(path, baseUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const resolvedBaseUrl = baseUrl ?? this.baseUrl;
    const url = `${resolvedBaseUrl}${path}`;
    const startedAt = Date.now();

    logger.info(`${LOG_PREFIX} 🛰️ ${init?.method || 'GET'} ${url}`, {
      path,
    });

    try {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');

      const authorization = this.ensureBasic(this.token);
      if (authorization) {
        headers.set('Authorization', authorization);
      }

      let response: Response;

      try {
        response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });
      } catch (fetchError) {
        const elapsedMs = Date.now() - startedAt;
        logger.error(`${LOG_PREFIX} ❌ Falha na requisição`, {
          url,
          path,
          elapsedMs,
          error: fetchError,
        });

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw createLeadEngineError('Lead Engine timeout ao processar a requisição.', { status: 504 });
        }

        throw createLeadEngineError(
          `Falha ao comunicar com o Lead Engine: ${
            fetchError instanceof Error ? fetchError.message : String(fetchError)
          }`,
          { status: 503 }
        );
      }

      const elapsedMs = Date.now() - startedAt;

      if (!response.ok) {
        const retryAfter = response.headers.get('Retry-After') ?? undefined;
        const raw = await response.text();
        let details: unknown = raw;
        try {
          details = raw ? JSON.parse(raw) : undefined;
        } catch {
          // Mantém representação textual
        }
        const preview = typeof raw === 'string' ? raw.slice(0, 500) : undefined;

        logger.error(`${LOG_PREFIX} 💥 ${response.status} erro na requisição`, {
          url,
          path,
          elapsedMs,
          preview,
        });

        throw createLeadEngineError(
          `Lead Engine respondeu ${response.status}: ${response.statusText || preview || 'Erro desconhecido'}`,
          {
            status: response.status,
            statusText: response.statusText,
            retryAfter,
            details,
          }
        );
      }

      const data = (await response.json()) as T;
      logger.info(`${LOG_PREFIX} ✅ Resposta recebida`, {
        url,
        path,
        elapsedMs,
      });
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private applyDefaultRange(params: URLSearchParams): { start?: string; end?: string } {
    const range: { start?: string; end?: string } = {};

    if (!params.has('startDateUtc') && leadEngineConfig.defaultStartDate) {
      params.set('startDateUtc', leadEngineConfig.defaultStartDate);
      range.start = leadEngineConfig.defaultStartDate;
    }
    if (!params.has('endDateUtc') && leadEngineConfig.defaultEndDate) {
      params.set('endDateUtc', leadEngineConfig.defaultEndDate);
      range.end = leadEngineConfig.defaultEndDate;
    }

    return range;
  }

  private fallback(agreementId: string, take: number): BrokerLeadRecord[] {
    const scoped = FALLBACK_LEADS.filter((lead) => lead.agreementId === agreementId);
    const candidates = scoped.length > 0 ? scoped : FALLBACK_LEADS;
    const quantity = Math.min(Math.max(take, 1), Math.max(candidates.length, 1));
    const timestamp = Date.now();

    return Array.from({ length: quantity }, (_, index) => {
      const base = candidates[index % candidates.length];
      return {
        ...base,
        id: `${base.id}-${timestamp}-${index}`,
        agreementId,
      } satisfies BrokerLeadRecord;
    });
  }

  public getFallbackLeadsForAgreement(agreementId: string, take = 25): BrokerLeadRecord[] {
    return this.fallback(agreementId, take);
  }

  private getFallbackLeads(params: {
    agreementCode?: string;
    documentNumber?: string;
    size?: number;
    page?: number;
  }): LeadResponse {
    const agreementCode = params.agreementCode;
    let leads = FALLBACK_LEADS;

    if (agreementCode) {
      leads = FALLBACK_LEADS.filter(
        (lead) => lead.agreementCode === agreementCode || lead.agreementId === agreementCode
      );
    }

    if (params.documentNumber) {
      leads = leads.filter((lead) => lead.document === params.documentNumber);
    }

    const size = Math.min(Math.max(params.size ?? 25, 1), 100);
    const page = Math.max(params.page ?? 0, 0);
    const start = page * size;
    const end = start + size;

    return {
      data: leads.slice(start, end),
      total: leads.length,
      pagination: {
        page,
        size,
        total: leads.length,
      },
    };
  }

  async getLeads(params: {
    startDateUtc?: string;
    endDateUtc?: string;
    page?: number;
    size?: number;
    documentNumber?: string;
    agreementCode?: string;
  }): Promise<LeadResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('_page', String(Math.max(params.page ?? 0, 0)));
    queryParams.set('_size', String(Math.min(Math.max(params.size ?? 100, 1), 100)));

    if (params.startDateUtc) {
      queryParams.set('startDateUtc', params.startDateUtc);
    }
    if (params.endDateUtc) {
      queryParams.set('endDateUtc', params.endDateUtc);
    }
    if (params.documentNumber) {
      queryParams.set('documentNumber', params.documentNumber);
    }
    if (params.agreementCode) {
      queryParams.set('agreementCode', params.agreementCode);
    }

    const range = this.applyDefaultRange(queryParams);

    if (!this.useRealData) {
      logger.info(`${LOG_PREFIX} 🧪 Retornando leads de fallback`, {
        agreementCode: params.agreementCode ?? null,
        rangeStart: range.start ?? null,
        rangeEnd: range.end ?? null,
      });
      return this.getFallbackLeads(params);
    }

    try {
      return await this.request<LeadResponse>(`/api/v1/lead?${queryParams.toString()}`);
    } catch (error) {
      logger.warn(`${LOG_PREFIX} Fallback para dados locais`, {
        agreementCode: params.agreementCode ?? null,
        error,
      });
      return this.getFallbackLeads(params);
    }
  }

  async ingestLead(leads: IngestLeadRequest[]): Promise<void> {
    if (!this.useRealData) {
      logger.info(`${LOG_PREFIX} Simulando ingestão de ${leads.length} leads`);
      return;
    }

    await this.request('/api/v1/lead', {
      method: 'POST',
      body: JSON.stringify(leads),
    });

    logger.info(`${LOG_PREFIX} ✅ ${leads.length} leads ingeridos com sucesso`);
  }

  async ingestCreditLead(agreementSlug: string, leads: CreditLeadRequest[]): Promise<void> {
    if (!this.useRealData) {
      logger.info(
        `${LOG_PREFIX} Simulando ingestão de ${leads.length} leads de crédito para ${agreementSlug}`
      );
      return;
    }

    if (!this.creditBaseUrl) {
      throw new Error('Lead Engine credit broker não está configurado.');
    }

    await this.request(
      `/api/v1/lead-credit/${agreementSlug}`,
      {
        method: 'POST',
        body: JSON.stringify(leads),
      },
      this.creditBaseUrl
    );

    logger.info(`${LOG_PREFIX} ✅ ${leads.length} leads de crédito ingeridos para ${agreementSlug}`);
  }

  async fetchLeadsByAgreement(
    agreementId: string,
    take: number = 25
  ): Promise<BrokerLeadRecord[]> {
    const response = await this.getLeads({
      agreementCode: agreementId,
      size: take,
      page: 0,
    });

    const leads = response.data || response.items || response.value?.data || [];

    if (!Array.isArray(leads) || leads.length === 0) {
      logger.warn(`${LOG_PREFIX} ⚠️ Broker retornou zero leads`, {
        agreementId,
        agreementCode: agreementId,
        take,
      });
      return this.fallback(agreementId, take);
    }

    logger.info(`${LOG_PREFIX} ✅ Leads recebidos`, {
      agreementId,
      requested: take,
      received: leads.length,
    });

    return (leads as BrokerLeadRecord[]).map((lead) => ({
      ...lead,
      agreementId: lead.agreementId || agreementId,
      agreementCode: lead.agreementCode || agreementId,
    }));
  }
}

export const leadEngineClient = new LeadEngineClient();
