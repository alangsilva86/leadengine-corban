import { fetch, Headers, type HeadersInit, type RequestInit, type Response } from 'undici';
import {
  agreementDefinitions,
  leadEngineConfig,
  type AgreementDefinition,
  type AgreementSummary as ConfigAgreementSummary,
  type BrokerLeadRecord as ConfigBrokerLeadRecord,
} from '../config/lead-engine';
import { logger } from '../config/logger';

const LOG_PREFIX = '[LeadEngine]';

export interface LeadEngineError extends Error {
  status?: number;
  statusText?: string;
  retryAfter?: string | number;
  details?: unknown;
}

const createLeadEngineError = (
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

export type AgreementSummary = ConfigAgreementSummary;

// ============================================================================
// Convênios disponíveis baseados na collection Postman
// ============================================================================


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
    this.useRealData = process.env.USE_REAL_DATA === 'true';

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

  private buildFallbackSummary(definition: AgreementDefinition): AgreementSummary {
    const fallbackLeads = FALLBACK_LEADS.filter((lead) => lead.agreementId === definition.id);
    return {
      ...definition,
      availableLeads: fallbackLeads.length,
      hotLeads: Math.min(fallbackLeads.length, 5),
      lastSyncAt: null,
    } satisfies AgreementSummary;
  }

  private async countLeads(
    filters: Record<string, string | number | boolean | undefined>
  ): Promise<number> {
    if (!this.useRealData) {
      const agreementCode = typeof filters.agreementCode === 'string' ? filters.agreementCode : undefined;
      const definition = agreementCode
        ? agreementDefinitions.find(
            (item) => item.slug === agreementCode || item.id === agreementCode
          )
        : undefined;

      const scoped = agreementCode
        ? FALLBACK_LEADS.filter(
            (lead) =>
              lead.agreementCode === agreementCode ||
              lead.agreementId === (definition?.id ?? agreementCode)
          )
        : FALLBACK_LEADS;

      const isHotQuery =
        Object.prototype.hasOwnProperty.call(filters, 'classification') ||
        Object.prototype.hasOwnProperty.call(filters, 'leadStatus');

      if (isHotQuery) {
        return Math.min(scoped.length, Math.max(Math.floor(scoped.length * 0.2), scoped.length > 0 ? 1 : 0));
      }

      return scoped.length;
    }

    const params = new URLSearchParams();
    params.set('_page', '0');
    params.set('_size', '1');
    const range = this.applyDefaultRange(params);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });

    type CountResponse =
      | { value?: { total?: number } }
      | { total?: number }
      | { success?: boolean; value?: { total?: number } };
    const payload = await this.request<CountResponse>(`/api/v1/lead?${params.toString()}`);
    const total = (payload as any)?.value?.total ?? (payload as any)?.total;
    const parsedTotal = Number.isFinite(total) ? Number(total) : 0;

    const printableFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined && value !== null)
    );

    logger.info(`${LOG_PREFIX} 📊 Contagem de leads concluída`, {
      filters: printableFilters,
      total: parsedTotal,
      rangeStart: range.start ?? null,
      rangeEnd: range.end ?? null,
    });

    if (parsedTotal === 0) {
      logger.warn(`${LOG_PREFIX} ℹ️ Consulta retornou zero leads`, {
        filters: printableFilters,
      });
    }

    return parsedTotal;
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

  private async buildAgreementSummary(
    definition: AgreementDefinition
  ): Promise<AgreementSummary> {
    if (!this.useRealData) {
      return this.buildFallbackSummary(definition);
    }

    const agreementCode = definition.slug;

    const availableLeads = await this.countLeads({ agreementCode });
    const hotLeads = await this.countLeads({ agreementCode, classification: 2 });

    const summary: AgreementSummary = {
      ...definition,
      availableLeads,
      hotLeads,
      lastSyncAt: new Date().toISOString(),
    } satisfies AgreementSummary;

    logger.info(`${LOG_PREFIX} 🧮 Estatísticas atualizadas`, {
      agreementCode,
      availableLeads,
      hotLeads,
    });

    return summary;
  }

  async getAgreementSummaries(): Promise<{
    summaries: AgreementSummary[];
    warnings: Array<{ agreementId: string; reason: string }>;
  }> {
    const settled = await Promise.allSettled(
      agreementDefinitions.map((definition) => this.buildAgreementSummary(definition))
    );

    const summaries: AgreementSummary[] = [];
    const warnings: Array<{ agreementId: string; reason: string }> = [];

    settled.forEach((result, index) => {
      const definition = agreementDefinitions[index];
      if (result.status === 'fulfilled') {
        summaries.push(result.value);
        return;
      }

      const reason = result.reason instanceof Error ? result.reason.message : 'Erro desconhecido';
      warnings.push({ agreementId: definition.id, reason });

      logger.error(`${LOG_PREFIX} 🧨 Falha ao atualizar convênio`, {
        agreementId: definition.id,
        agreementCode: definition.slug,
        message: reason,
      });

      summaries.push(this.buildFallbackSummary(definition));
    });

    if (warnings.length > 0) {
      logger.warn(`${LOG_PREFIX} ⚠️ Estatísticas concluídas com alertas`, {
        warnings,
      });
    }

    return { summaries, warnings };
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
    const agreement = agreementDefinitions.find((item) => item.id === agreementId);
    if (!agreement) {
      throw createLeadEngineError(`Convênio não encontrado: ${agreementId}`, {
        status: 400,
      });
    }

    const response = await this.getLeads({
      agreementCode: agreement.slug,
      size: take,
      page: 0,
    });

    const leads = response.data || response.items || response.value?.data || [];

    if (!Array.isArray(leads) || leads.length === 0) {
      logger.warn(`${LOG_PREFIX} ⚠️ Broker retornou zero leads`, {
        agreementId,
        agreementCode: agreement.slug,
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
      agreementCode: lead.agreementCode || agreement.slug,
    }));
  }

  getAvailableAgreements() {
    return agreementDefinitions;
  }
}

export const leadEngineClient = new LeadEngineClient();
