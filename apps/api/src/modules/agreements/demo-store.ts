import { randomUUID } from 'node:crypto';

import type {
  AgreementHistoryRecord,
  AgreementImportJobRecord,
  AgreementListFilters,
  AgreementRateRecord,
  AgreementRecord,
  AgreementTableRecord,
  AgreementWindowRecord,
  PaginatedAgreements,
} from './repository';
import { demoAgreementsSeed } from '../../../../../config/demo-agreements';

const DEFAULT_TENANT_ID = (process.env.AUTH_MVP_TENANT_ID ?? 'demo-tenant').trim() || 'demo-tenant';

const normalizeTenantId = (tenantId?: string): string => {
  const trimmed = (tenantId ?? '').trim();
  return trimmed.length ? trimmed : DEFAULT_TENANT_ID;
};

const DEFAULT_TENANT_IDS = new Set([DEFAULT_TENANT_ID, 'demo-tenant']);

interface DemoAgreementsState {
  agreements: AgreementRecord[];
  tables: AgreementTableRecord[];
  windows: AgreementWindowRecord[];
  rates: AgreementRateRecord[];
  history: AgreementHistoryRecord[];
  importJobs: AgreementImportJobRecord[];
}

interface BuildAgreementOptions {
  includeHistory?: boolean;
  historyLimit?: number;
}

const cloneDate = (value: Date | null): Date | null => (value ? new Date(value) : null);
const toNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cloneAgreement = (
  agreement: AgreementRecord,
  state: DemoAgreementsState,
  options: BuildAgreementOptions = {}
): AgreementRecord => {
  const base: AgreementRecord = {
    ...agreement,
    tags: [...agreement.tags],
    products: { ...agreement.products },
    metadata: { ...agreement.metadata },
    createdAt: new Date(agreement.createdAt),
    updatedAt: new Date(agreement.updatedAt),
    publishedAt: cloneDate(agreement.publishedAt),
  };

  const tables = state.tables
    .filter((table) => table.agreementId === agreement.id)
    .map((table) => ({
      ...table,
      metadata: { ...table.metadata },
      createdAt: new Date(table.createdAt),
      updatedAt: new Date(table.updatedAt),
    }));

  const windows = state.windows
    .filter((window) => window.agreementId === agreement.id)
    .map((window) => ({
      ...window,
      metadata: { ...window.metadata },
      createdAt: new Date(window.createdAt),
      updatedAt: new Date(window.updatedAt),
    }));

  const rates = state.rates
    .filter((rate) => rate.agreementId === agreement.id)
    .map((rate) => ({
      ...rate,
      metadata: { ...rate.metadata },
      createdAt: new Date(rate.createdAt),
      updatedAt: new Date(rate.updatedAt),
    }));

  const record: AgreementRecord = {
    ...base,
    tables,
    windows,
    rates,
  };

  if (options.includeHistory) {
    const limit = options.historyLimit ?? 50;
    record.history = state.history
      .filter((entry) => entry.agreementId === agreement.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        metadata: { ...entry.metadata },
        createdAt: new Date(entry.createdAt),
      }));
  }

  return record;
};

const toLower = (value: string | null | undefined): string => (value ?? '').toLowerCase();

const now = () => new Date();

export class DemoAgreementsStore {
  private readonly allowedTenants: Set<string>;
  private readonly stateByTenant = new Map<string, DemoAgreementsState>();

  constructor(tenantIds?: string[]) {
    const seedTenantIds = tenantIds && tenantIds.length > 0 ? tenantIds : Array.from(DEFAULT_TENANT_IDS);
    const normalized = seedTenantIds.map((tenant) => normalizeTenantId(tenant)).filter(Boolean);
    this.allowedTenants = new Set(normalized.length ? normalized : [DEFAULT_TENANT_ID]);

    for (const tenantId of this.allowedTenants) {
      this.stateByTenant.set(tenantId, this.buildInitialState(tenantId));
    }
  }

  private buildInitialState(tenantId: string): DemoAgreementsState {
    const createdAt = now();
    const agreements: AgreementRecord[] = [];
    const tables: AgreementTableRecord[] = [];
    const windows: AgreementWindowRecord[] = [];
    const rates: AgreementRateRecord[] = [];
    const history: AgreementHistoryRecord[] = [];

    for (const seed of demoAgreementsSeed) {
      const agreementId = seed.id ?? randomUUID();
      const publishedAt = seed.publishedAt ? new Date(seed.publishedAt) : createdAt;
      agreements.push({
        id: agreementId,
        tenantId,
        name: seed.name,
        slug: seed.slug,
        status: seed.status ?? 'published',
        type: seed.type ?? null,
        segment: seed.segment ?? null,
        description: seed.description ?? null,
        tags: Array.isArray(seed.tags) ? [...seed.tags] : [],
        products: { ...(seed.products ?? {}) },
        metadata: { ...(seed.metadata ?? {}), seed: true },
        archived: false,
        publishedAt,
        createdAt,
        updatedAt: createdAt,
      });

      history.push({
        id: randomUUID(),
        tenantId,
        agreementId,
        windowId: null,
        actorId: null,
        actorName: 'Sistema',
        action: 'created',
        message: 'Convênio importado automaticamente para o modo demonstração.',
        metadata: { seed: true },
        createdAt,
      });

      for (const tableSeed of seed.tables ?? []) {
        const tableId = tableSeed.id ?? `${agreementId}-${tableSeed.name}`;
        const effectiveFrom = tableSeed.effectiveFrom ? new Date(tableSeed.effectiveFrom) : null;
        const effectiveTo = tableSeed.effectiveTo ? new Date(tableSeed.effectiveTo) : null;

        tables.push({
          id: tableId,
          tenantId,
          agreementId,
          externalId: null,
          name: tableSeed.name,
          product: tableSeed.product,
          modality: tableSeed.modality,
          version: tableSeed.version ?? 1,
          effectiveFrom,
          effectiveTo,
          metadata: { ...(tableSeed.metadata ?? {}), seed: true },
          createdAt,
          updatedAt: createdAt,
        });

        for (const rateSeed of tableSeed.rates ?? []) {
          rates.push({
            id: rateSeed.id ?? `${tableId}-${rateSeed.termMonths ?? 'na'}`,
            tenantId,
            agreementId,
            tableId,
            windowId: null,
            product: tableSeed.product,
            modality: tableSeed.modality,
            termMonths: rateSeed.termMonths ?? null,
            coefficient: toNullableNumber(rateSeed.coefficient),
            monthlyRate: toNullableNumber(rateSeed.monthlyRate),
            annualRate: toNullableNumber(rateSeed.annualRate),
            tacPercentage: toNullableNumber(rateSeed.tacPercentage),
            metadata: { ...(rateSeed.metadata ?? {}), seed: true },
            createdAt,
            updatedAt: createdAt,
          });
        }
      }
    }

    return {
      agreements,
      tables,
      windows,
      rates,
      history,
      importJobs: [],
    };
  }

  private bootstrapTenantState(tenantId: string): DemoAgreementsState {
    if (!this.stateByTenant.has(tenantId)) {
      this.stateByTenant.set(tenantId, this.buildInitialState(tenantId));
    }

    return this.stateByTenant.get(tenantId)!;
  }

  private getState(rawTenantId: string): DemoAgreementsState | null {
    const tenantId = normalizeTenantId(rawTenantId);

    if (!this.allowedTenants.has(tenantId)) {
      this.allowedTenants.add(tenantId);
    }

    return this.bootstrapTenantState(tenantId);
  }

  private applySearchFilters(agreements: AgreementRecord[], filters: AgreementListFilters): AgreementRecord[] {
    const statusFilter = (filters.status ?? '').trim();
    const search = toLower(filters.search ?? '');

    return agreements.filter((agreement) => {
      if (statusFilter && agreement.status !== statusFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        toLower(agreement.name).includes(search) ||
        toLower(agreement.slug).includes(search) ||
        toLower(agreement.segment).includes(search)
      );
    });
  }

  async listAgreements(
    tenantId: string,
    filters: AgreementListFilters,
    pagination: { page: number; limit: number }
  ): Promise<PaginatedAgreements> {
    const state = this.getState(tenantId);
    const page = Math.max(pagination.page, 1);
    const limit = Math.min(Math.max(pagination.limit, 1), 100);

    if (!state) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const filtered = this.applySearchFilters(state.agreements, filters).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map((agreement) => cloneAgreement(agreement, state));

    return { items, total, page, limit, totalPages };
  }

  async findAgreementById(tenantId: string, agreementId: string): Promise<AgreementRecord | null> {
    const state = this.getState(tenantId);
    if (!state) {
      return null;
    }
    const agreement = state.agreements.find((item) => item.id === agreementId);
    return agreement ? cloneAgreement(agreement, state, { includeHistory: true }) : null;
  }

  async createAgreement(data: Partial<AgreementRecord> & { tenantId: string; name: string; slug: string }): Promise<AgreementRecord> {
    const state = this.getState(data.tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const createdAt = now();
    const record: AgreementRecord = {
      id: data.id ?? randomUUID(),
      tenantId: data.tenantId,
      name: data.name,
      slug: data.slug,
      status: data.status ?? 'draft',
      type: data.type ?? null,
      segment: data.segment ?? null,
      description: data.description ?? null,
      tags: Array.isArray(data.tags) ? [...data.tags] : [],
      products: { ...(data.products ?? {}) },
      metadata: { ...(data.metadata ?? {}) },
      archived: Boolean(data.archived),
      publishedAt: data.publishedAt ?? null,
      createdAt,
      updatedAt: createdAt,
    };

    state.agreements.push(record);
    return { ...record, tags: [...record.tags], products: { ...record.products }, metadata: { ...record.metadata } };
  }

  async updateAgreement(
    tenantId: string,
    agreementId: string,
    updates: Partial<AgreementRecord>
  ): Promise<AgreementRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const index = state.agreements.findIndex((agreement) => agreement.id === agreementId);
    if (index === -1) {
      throw new Error('DEMO_STORE_AGREEMENT_NOT_FOUND');
    }

    const current = state.agreements[index];
    const updated: AgreementRecord = {
      ...current,
      ...updates,
      tags: Array.isArray(updates.tags) ? [...updates.tags] : current.tags,
      products: updates.products ? { ...updates.products } : current.products,
      metadata: updates.metadata ? { ...updates.metadata } : current.metadata,
      updatedAt: now(),
    };

    state.agreements[index] = updated;
    return { ...updated, tags: [...updated.tags], products: { ...updated.products }, metadata: { ...updated.metadata } };
  }

  async deleteAgreement(tenantId: string, agreementId: string): Promise<AgreementRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const index = state.agreements.findIndex((agreement) => agreement.id === agreementId);
    if (index === -1) {
      throw new Error('DEMO_STORE_AGREEMENT_NOT_FOUND');
    }

    const [removed] = state.agreements.splice(index, 1);
    state.tables = state.tables.filter((table) => table.agreementId !== agreementId);
    state.windows = state.windows.filter((window) => window.agreementId !== agreementId);
    state.rates = state.rates.filter((rate) => rate.agreementId !== agreementId);
    state.history = state.history.filter((entry) => entry.agreementId !== agreementId);

    return { ...removed };
  }

  async upsertWindow(
    tenantId: string,
    agreementId: string,
    windowId: string | null,
    payload: Partial<AgreementWindowRecord>
  ): Promise<AgreementWindowRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    if (windowId) {
      const index = state.windows.findIndex((window) => window.id === windowId && window.agreementId === agreementId);
      if (index === -1) {
        throw new Error('DEMO_STORE_WINDOW_NOT_FOUND');
      }

      const updated: AgreementWindowRecord = {
        ...state.windows[index],
        ...payload,
        metadata: payload.metadata ? { ...payload.metadata } : state.windows[index].metadata,
        updatedAt: now(),
      };

      state.windows[index] = updated;
      return { ...updated, metadata: { ...updated.metadata }, createdAt: new Date(updated.createdAt) };
    }

    const created: AgreementWindowRecord = {
      id: randomUUID(),
      tenantId,
      agreementId,
      tableId: payload.tableId ?? null,
      label: payload.label ?? 'Calendário',
      startsAt: payload.startsAt ?? null,
      endsAt: payload.endsAt ?? null,
      isActive: payload.isActive ?? true,
      metadata: { ...(payload.metadata ?? {}) },
      createdAt: now(),
      updatedAt: now(),
    };

    state.windows.push(created);
    return { ...created, metadata: { ...created.metadata }, createdAt: new Date(created.createdAt) };
  }

  async deleteWindow(tenantId: string, windowId: string): Promise<AgreementWindowRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const index = state.windows.findIndex((window) => window.id === windowId);
    if (index === -1) {
      throw new Error('DEMO_STORE_WINDOW_NOT_FOUND');
    }

    const [removed] = state.windows.splice(index, 1);
    state.rates = state.rates.map((rate) => (rate.windowId === windowId ? { ...rate, windowId: null } : rate));
    return { ...removed };
  }

  async upsertRate(
    tenantId: string,
    agreementId: string,
    rateId: string | null,
    payload: Partial<AgreementRateRecord>
  ): Promise<AgreementRateRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    if (rateId) {
      const index = state.rates.findIndex((rate) => rate.id === rateId && rate.agreementId === agreementId);
      if (index === -1) {
        throw new Error('DEMO_STORE_RATE_NOT_FOUND');
      }

      const updated: AgreementRateRecord = {
        ...state.rates[index],
        ...payload,
        metadata: payload.metadata ? { ...payload.metadata } : state.rates[index].metadata,
        updatedAt: now(),
      };

      state.rates[index] = updated;
      return { ...updated, metadata: { ...updated.metadata }, createdAt: new Date(updated.createdAt) };
    }

    const created: AgreementRateRecord = {
      id: randomUUID(),
      tenantId,
      agreementId,
      tableId: payload.tableId ?? null,
      windowId: payload.windowId ?? null,
      product: payload.product ?? 'consignado',
      modality: payload.modality ?? 'publico',
      termMonths: payload.termMonths ?? null,
      coefficient: payload.coefficient ?? null,
      monthlyRate: payload.monthlyRate ?? null,
      annualRate: payload.annualRate ?? null,
      tacPercentage: payload.tacPercentage ?? null,
      metadata: { ...(payload.metadata ?? {}) },
      createdAt: now(),
      updatedAt: now(),
    };

    state.rates.push(created);
    return { ...created, metadata: { ...created.metadata }, createdAt: new Date(created.createdAt) };
  }

  async deleteRate(tenantId: string, rateId: string): Promise<AgreementRateRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const index = state.rates.findIndex((rate) => rate.id === rateId);
    if (index === -1) {
      throw new Error('DEMO_STORE_RATE_NOT_FOUND');
    }

    const [removed] = state.rates.splice(index, 1);
    return { ...removed };
  }

  async appendHistoryEntry(
    tenantId: string,
    agreementId: string,
    entry: Omit<AgreementHistoryRecord, 'id' | 'tenantId' | 'agreementId' | 'createdAt'>
  ): Promise<AgreementHistoryRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const created: AgreementHistoryRecord = {
      id: randomUUID(),
      tenantId,
      agreementId,
      windowId: entry.windowId ?? null,
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
      action: entry.action,
      message: entry.message,
      metadata: { ...(entry.metadata ?? {}) },
      createdAt: now(),
    };

    state.history.unshift(created);
    return { ...created, metadata: { ...created.metadata } };
  }

  async listHistory(tenantId: string, agreementId: string, limit: number): Promise<AgreementHistoryRecord[]> {
    const state = this.getState(tenantId);
    if (!state) {
      return [];
    }
    return state.history
      .filter((entry) => entry.agreementId === agreementId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((entry) => ({ ...entry, metadata: { ...entry.metadata }, createdAt: new Date(entry.createdAt) }));
  }

  async createImportJob(
    tenantId: string,
    agreementId: string | null,
    payload: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const job: AgreementImportJobRecord = {
      id: randomUUID(),
      tenantId,
      agreementId,
      source: payload.source ?? 'demo',
      fileKey: payload.fileKey ?? null,
      fileName: payload.fileName ?? null,
      checksum: payload.checksum ?? randomUUID(),
      status: payload.status ?? 'pending',
      totalRows: payload.totalRows ?? 0,
      processedRows: payload.processedRows ?? 0,
      errorCount: payload.errorCount ?? 0,
      startedAt: payload.startedAt ?? null,
      finishedAt: payload.finishedAt ?? null,
      errorMessage: payload.errorMessage ?? null,
      metadata: { ...(payload.metadata ?? {}) },
      createdAt: now(),
      updatedAt: now(),
    };

    state.importJobs.push(job);
    return { ...job, metadata: { ...job.metadata }, createdAt: new Date(job.createdAt) };
  }

  async findImportJobByChecksum(tenantId: string, checksum: string): Promise<AgreementImportJobRecord | null> {
    const state = this.getState(tenantId);
    if (!state) {
      return null;
    }
    const job = state.importJobs.find((entry) => entry.checksum === checksum);
    return job ? { ...job, metadata: { ...job.metadata }, createdAt: new Date(job.createdAt) } : null;
  }

  async updateImportJob(
    tenantId: string,
    jobId: string,
    updates: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    const state = this.getState(tenantId);
    if (!state) {
      throw new Error('DEMO_STORE_TENANT_UNSUPPORTED');
    }

    const index = state.importJobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      throw new Error('DEMO_STORE_IMPORT_JOB_NOT_FOUND');
    }

    const updated: AgreementImportJobRecord = {
      ...state.importJobs[index],
      ...updates,
      metadata: updates.metadata ? { ...updates.metadata } : state.importJobs[index].metadata,
      updatedAt: now(),
    };

    state.importJobs[index] = updated;
    return { ...updated, metadata: { ...updated.metadata }, createdAt: new Date(updated.createdAt) };
  }

  async markImportJobProcessing(jobId: string): Promise<AgreementImportJobRecord | null> {
    for (const state of this.stateByTenant.values()) {
      const job = state.importJobs.find((entry) => entry.id === jobId);
      if (job) {
        job.status = 'processing';
        job.startedAt = now();
        job.updatedAt = job.startedAt;
        return { ...job, metadata: { ...job.metadata }, createdAt: new Date(job.createdAt) };
      }
    }

    return null;
  }

  async findPendingImportJobs(limit: number): Promise<AgreementImportJobRecord[]> {
    const pending: AgreementImportJobRecord[] = [];
    for (const state of this.stateByTenant.values()) {
      pending.push(
        ...state.importJobs
          .filter((job) => job.status === 'pending')
          .map((job) => ({ ...job, metadata: { ...job.metadata }, createdAt: new Date(job.createdAt) }))
      );
    }

    return pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
  }
}
