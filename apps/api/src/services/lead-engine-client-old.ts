
import { fetch, Headers, type HeadersInit, type RequestInit } from 'undici';
import {
  leadEngineConfig,
  agreementDefinitions,
  type AgreementSummary,
  type BrokerLeadRecord,
  type AgreementDefinition,
} from '../config/lead-engine';
import { logger } from '../config/logger';

const LOG_PREFIX = '[LeadEngine]';

const FALLBACK_LEADS: BrokerLeadRecord[] = [
  {
    id: 'demo-lead-1',
    fullName: 'Maria Helena Souza',
    document: '09941751919',
    registrations: ['1839'],
    agreementId: 'saec-goiania',
    phone: '+5562999887766',
    margin: 487.5,
    netMargin: 390,
    score: 92,
    tags: ['respondido', 'whatsapp'],
  },
  {
    id: 'demo-lead-2',
    fullName: 'Carlos Henrique Lima',
    document: '82477214500',
    registrations: ['1920'],
    agreementId: 'saec-goiania',
    phone: '+5562999776655',
    margin: 512.4,
    netMargin: 405.8,
    score: 88,
    tags: ['novo', 'sms'],
  },
  {
    id: 'demo-lead-3',
    fullName: 'Fernanda Alves Ribeiro',
    document: '15840762033',
    registrations: ['2044'],
    agreementId: 'rf1-boa-vista',
    phone: '+5595999776655',
    margin: 462.75,
    netMargin: 371.4,
    score: 86,
    tags: ['respondido', 'whatsapp'],
  },
];

type LeadCountFilters = Record<string, string | number | boolean | undefined>;

class LeadEngineClient {
  private readonly baseUrl: string;
  private readonly creditBaseUrl?: string;
  private readonly timeoutMs: number;
  private readonly token: string;

  constructor() {
    this.baseUrl = leadEngineConfig.baseUrl.replace(/\/$/, '');
    this.creditBaseUrl = leadEngineConfig.creditBaseUrl?.replace(/\/$/, '');
    this.timeoutMs = leadEngineConfig.timeoutMs;
    this.token = leadEngineConfig.basicToken;

    logger.info(`${LOG_PREFIX} ✨ Cliente calibrado`, {
      baseUrl: this.baseUrl,
      creditBaseUrl: this.creditBaseUrl ?? null,
      timeoutMs: this.timeoutMs,
      hasToken: Boolean(this.token),
      defaultStartDate: leadEngineConfig.defaultStartDate || null,
      defaultEndDate: leadEngineConfig.defaultEndDate || null,
    });
  }

  private ensureBasic(token?: string): string | undefined {
    if (!token) {
      return undefined;
    }
    return token.startsWith('Basic ') ? token : `Basic ${token}`;
  }

  private assertConfigured(path: string): void {
    if (!this.baseUrl || !this.token) {
      logger.error(`${LOG_PREFIX} 🚨 Configuração ausente para chamada`, {
        baseUrl: this.baseUrl || null,
        hasToken: Boolean(this.token),
        path,
      });
      throw new Error('Lead Engine broker não está configurado (baseUrl/token ausentes).');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    this.assertConfigured(path);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${this.baseUrl}${path}`;
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

      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - startedAt;

      if (!response.ok) {
        const raw = await response.text();
        const preview = raw.slice(0, 500);
        logger.error(`${LOG_PREFIX} 💥 ${response.status} ao falar com o broker`, {
          url,
          path,
          elapsedMs,
          preview,
        });
        throw new Error(`Lead Engine respondeu ${response.status}: ${preview}`);
      }

      const data = (await response.json()) as T;
      logger.info(`${LOG_PREFIX} ✅ Resposta recebida`, {
        url,
        path,
        elapsedMs,
      });
      return data;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const name = error instanceof Error ? error.name : 'UnknownError';
      logger.error(`${LOG_PREFIX} ❌ Falha ao chamar broker`, {
        url,
        path,
        elapsedMs,
        name,
        message,
      });
      throw error instanceof Error ? error : new Error('Erro desconhecido ao chamar Lead Engine');
    } finally {
      clearTimeout(timeout);
    }
  }

  private applyDefaultRange(params: URLSearchParams): { start?: string; end?: string } {
    const range: { start?: string; end?: string } = {};

    if (leadEngineConfig.defaultStartDate) {
      params.set('startDateUtc', leadEngineConfig.defaultStartDate);
      range.start = leadEngineConfig.defaultStartDate;
    }
    if (leadEngineConfig.defaultEndDate) {
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

  private buildFallbackSummary(definition: AgreementDefinition): AgreementSummary {
    const fallbackLeads = FALLBACK_LEADS.filter((lead) => lead.agreementId === definition.id);
    return {
      ...definition,
      availableLeads: fallbackLeads.length,
      hotLeads: Math.min(fallbackLeads.length, 5),
      lastSyncAt: null,
    } satisfies AgreementSummary;
  }

  private async countLeads(filters: LeadCountFilters): Promise<number> {
    const params = new URLSearchParams();
    params.set('_page', '0');
    params.set('_size', '1');
    const range = this.applyDefaultRange(params);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
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
      Object.entries(filters).filter(([_, value]) => value !== undefined)
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

  private async buildAgreementSummary(definition: AgreementDefinition): Promise<AgreementSummary> {
    const agreementCode = definition.slug;

    const availableLeads = await this.countLeads({ agreementCode });
    const hotLeads = await this.countLeads({ agreementCode, classification: 2 });

    const summary: AgreementSummary = {
      ...definition,
      availableLeads,
      hotLeads,
      lastSyncAt: new Date().toISOString(),
    };

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

  async fetchLeads(options: { agreementId: string; take: number }): Promise<BrokerLeadRecord[]> {
    const { agreementId, take } = options;
    const definition = agreementDefinitions.find((item) => item.id === agreementId);
    const agreementCode = definition?.slug ?? agreementId;

    const params = new URLSearchParams();
    params.set('agreementCode', agreementCode);
    params.set('_size', String(Math.min(Math.max(take, 1), 100)));
    params.set('_page', '0');
    const range = this.applyDefaultRange(params);

    logger.info(`${LOG_PREFIX} 🎯 Buscando leads`, {
      agreementId,
      agreementCode,
      take,
      rangeStart: range.start ?? null,
      rangeEnd: range.end ?? null,
    });

    try {
      type BrokerListResponse =
        | { value?: { data?: BrokerLeadRecord[] } }
        | { data?: BrokerLeadRecord[]; items?: BrokerLeadRecord[] };

      const payload = await this.request<BrokerListResponse>(
        `/api/v1/lead?${params.toString()}`
      );

      const rawLeads =
        (payload as any)?.value?.data ??
        (payload as any)?.data ??
        (payload as any)?.items ??
        [];
      const leads = Array.isArray(rawLeads) ? (rawLeads as BrokerLeadRecord[]) : [];

      if (leads.length === 0) {
        logger.warn(`${LOG_PREFIX} ⚠️ Broker retornou zero leads`, {
          agreementId,
          agreementCode,
          take,
        });
        return this.fallback(agreementId, take);
      }

      logger.info(`${LOG_PREFIX} ✅ Leads recebidos`, {
        agreementId,
        requested: take,
        received: leads.length,
      });

      return leads.map((lead) => ({
        ...lead,
        // garante coerência do agreementId
        agreementId: lead.agreementId || agreementId,
      }));
    } catch (error) {
      logger.warn(`${LOG_PREFIX} ✖ Falha ao buscar leads, usando fallback local`, {
        agreementId,
        agreementCode,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.fallback(agreementId, take);
    }
  }
}

export const leadEngineClient = new LeadEngineClient();
