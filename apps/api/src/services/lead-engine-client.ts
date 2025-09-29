import { fetch, Headers, type HeadersInit, type RequestInit } from 'undici';
import { logger } from '../config/logger';

const LOG_PREFIX = '[LeadEngine]';

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

export interface BrokerLeadRecord {
  id: string;
  fullName?: string;
  document: string;
  registrations?: string[];
  agreementId?: string;
  agreementCode?: string;
  phone?: string;
  margin?: number;
  netMargin?: number;
  score?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AgreementSummary {
  id: string;
  name: string;
  slug: string;
  region?: string;
  availableLeads: number;
  hotLeads: number;
  lastSyncAt: string | null;
}

// ============================================================================
// Convênios disponíveis baseados na collection Postman
// ============================================================================

const AVAILABLE_AGREEMENTS = [
  { id: 'saec-goiania', name: 'SAEC Goiânia', slug: 'SaecGoiania', region: 'GO' },
  { id: 'saec-curaca', name: 'SAEC Curaçá', slug: 'SaecCuraca', region: 'BA' },
  { id: 'saec-caldas-novas', name: 'SAEC Caldas Novas', slug: 'SaecCaldasNovas', region: 'GO' },
  { id: 'rf1-boa-vista', name: 'RF1 Boa Vista', slug: 'Rf1BoaVista', region: 'RR' },
  { id: 'econsig-londrina', name: 'EConsig Londrina', slug: 'EConsigLondrina', region: 'PR' },
  { id: 'consigtec-maringa', name: 'ConsigTec Maringá', slug: 'ConsigTecMaringa', region: 'PR' },
  { id: 'econsig-guaratuba', name: 'EConsig Guaratuba', slug: 'EConsigGuaratuba', region: 'PR' },
];

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
  private readonly creditBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly token: string;
  private readonly useRealData: boolean;

  constructor() {
    this.baseUrl = (process.env.LEAD_ENGINE_BASE_URL || '').replace(/\/$/, '');
    this.creditBaseUrl = (process.env.LEAD_ENGINE_CREDIT_BASE_URL || '').replace(/\/$/, '');
    this.timeoutMs = parseInt(process.env.LEAD_ENGINE_TIMEOUT_MS || '8000');
    this.token = process.env.LEAD_ENGINE_BASIC_TOKEN || '';
    this.useRealData = process.env.USE_REAL_DATA === 'true';

    logger.info(`${LOG_PREFIX} ✨ Cliente inicializado`, {
      baseUrl: this.baseUrl,
      creditBaseUrl: this.creditBaseUrl,
      timeoutMs: this.timeoutMs,
      hasToken: Boolean(this.token),
      useRealData: this.useRealData,
    });
  }

  private get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  private ensureBasicAuth(token: string): string {
    return token.startsWith('Basic ') ? token : `Basic ${token}`;
  }

  private async request<T>(
    path: string, 
    init?: RequestInit, 
    baseUrl?: string
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Lead Engine não está configurado (baseUrl/token ausentes)');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${baseUrl || this.baseUrl}${path}`;
    const startedAt = Date.now();

    logger.info(`${LOG_PREFIX} 🛰️ ${init?.method || 'GET'} ${url}`);

    try {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      headers.set('Authorization', this.ensureBasicAuth(this.token));

      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - startedAt;

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        logger.error(`${LOG_PREFIX} 💥 ${response.status} erro na requisição`, {
          url,
          elapsedMs,
          error: text.slice(0, 500),
        });
        throw new Error(`Lead Engine respondeu ${response.status}: ${text}`);
      }

      const data = (await response.json()) as T;
      logger.info(`${LOG_PREFIX} ✅ Resposta recebida`, {
        url,
        elapsedMs,
      });
      return data;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error(`${LOG_PREFIX} ❌ Falha na requisição`, {
        url,
        elapsedMs,
        error: message,
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============================================================================
  // Métodos públicos baseados na API real
  // ============================================================================

  /**
   * Busca leads paginados do Lead Engine principal
   */
  async getLeads(params: {
    startDateUtc?: string;
    endDateUtc?: string;
    page?: number;
    size?: number;
    documentNumber?: string;
    agreementCode?: string;
  }): Promise<LeadResponse> {
    if (!this.useRealData || !this.isConfigured) {
      return this.getFallbackLeads(params);
    }

    const queryParams = new URLSearchParams({
      startDateUtc: params.startDateUtc || process.env.LEAD_ENGINE_DEFAULT_START_DATE || '2025-01-01T00:00:00Z',
      endDateUtc: params.endDateUtc || process.env.LEAD_ENGINE_DEFAULT_END_DATE || '2025-12-31T23:59:59Z',
      _page: (params.page || 0).toString(),
      _size: (params.size || 100).toString(),
    });

    if (params.documentNumber) {
      queryParams.append('documentNumber', params.documentNumber);
    }
    if (params.agreementCode) {
      queryParams.append('agreementCode', params.agreementCode);
    }

    try {
      return await this.request<LeadResponse>(`/api/v1/lead?${queryParams}`);
    } catch (error) {
      logger.warn(`${LOG_PREFIX} Fallback para dados locais`, { error });
      return this.getFallbackLeads(params);
    }
  }

  /**
   * Ingere leads no Lead Engine principal
   */
  async ingestLead(leads: IngestLeadRequest[]): Promise<void> {
    if (!this.useRealData || !this.isConfigured) {
      logger.info(`${LOG_PREFIX} Simulando ingestão de ${leads.length} leads`);
      return;
    }

    await this.request('/api/v1/lead', {
      method: 'POST',
      body: JSON.stringify(leads),
    });

    logger.info(`${LOG_PREFIX} ✅ ${leads.length} leads ingeridos com sucesso`);
  }

  /**
   * Ingere leads de crédito por convênio específico
   */
  async ingestCreditLead(agreementSlug: string, leads: CreditLeadRequest[]): Promise<void> {
    if (!this.useRealData || !this.isConfigured) {
      logger.info(`${LOG_PREFIX} Simulando ingestão de ${leads.length} leads de crédito para ${agreementSlug}`);
      return;
    }

    await this.request(`/api/v1/lead-credit/${agreementSlug}`, {
      method: 'POST',
      body: JSON.stringify(leads),
    }, this.creditBaseUrl);

    logger.info(`${LOG_PREFIX} ✅ ${leads.length} leads de crédito ingeridos para ${agreementSlug}`);
  }

  /**
   * Busca leads por convênio específico
   */
  async fetchLeadsByAgreement(agreementId: string, take: number = 25): Promise<BrokerLeadRecord[]> {
    const agreement = AVAILABLE_AGREEMENTS.find(a => a.id === agreementId);
    if (!agreement) {
      throw new Error(`Convênio não encontrado: ${agreementId}`);
    }

    const response = await this.getLeads({
      agreementCode: agreement.slug,
      size: take,
      page: 0,
    });

    const leads = response.data || response.items || response.value?.data || [];
    
    return leads.map(lead => ({
      ...lead,
      agreementId: agreementId,
      agreementCode: agreement.slug,
    }));
  }

  /**
   * Obtém resumo de todos os convênios
   */
  async getAgreementSummaries(): Promise<{
    summaries: AgreementSummary[];
    warnings: Array<{ agreementId: string; reason: string }>;
  }> {
    const summaries: AgreementSummary[] = [];
    const warnings: Array<{ agreementId: string; reason: string }> = [];

    for (const agreement of AVAILABLE_AGREEMENTS) {
      try {
        const response = await this.getLeads({
          agreementCode: agreement.slug,
          size: 1,
          page: 0,
        });

        const total = response.total || response.value?.total || response.pagination?.total || 0;
        
        // Simular leads "quentes" como 20% do total
        const hotLeads = Math.floor(total * 0.2);

        summaries.push({
          id: agreement.id,
          name: agreement.name,
          slug: agreement.slug,
          region: agreement.region,
          availableLeads: total,
          hotLeads: hotLeads,
          lastSyncAt: new Date().toISOString(),
        });

        logger.info(`${LOG_PREFIX} 📊 Estatísticas para ${agreement.name}`, {
          total,
          hotLeads,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Erro desconhecido';
        warnings.push({ agreementId: agreement.id, reason });
        
        // Fallback com dados simulados
        summaries.push({
          id: agreement.id,
          name: agreement.name,
          slug: agreement.slug,
          region: agreement.region,
          availableLeads: Math.floor(Math.random() * 100) + 10,
          hotLeads: Math.floor(Math.random() * 20) + 2,
          lastSyncAt: null,
        });

        logger.warn(`${LOG_PREFIX} ⚠️ Fallback para ${agreement.name}`, { reason });
      }
    }

    return { summaries, warnings };
  }

  /**
   * Dados de fallback para desenvolvimento
   */
  private getFallbackLeads(params: any): LeadResponse {
    const agreementCode = params.agreementCode;
    let leads = FALLBACK_LEADS;

    if (agreementCode) {
      leads = FALLBACK_LEADS.filter(lead => 
        lead.agreementCode === agreementCode || lead.agreementId === agreementCode
      );
    }

    const size = params.size || 25;
    const page = params.page || 0;
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

  /**
   * Lista convênios disponíveis
   */
  getAvailableAgreements() {
    return AVAILABLE_AGREEMENTS;
  }
}

export const leadEngineClient = new LeadEngineClient();
