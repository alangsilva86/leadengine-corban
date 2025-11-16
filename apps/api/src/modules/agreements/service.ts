import { logger as defaultLogger } from '../../config/logger';
import { emitToAgreement, emitToTenant } from '../../lib/socket-registry';
import type {
  AgreementImportJobRecord,
  AgreementListFilters,
  AgreementRateRecord,
  AgreementRecord,
  AgreementWindowRecord,
  PaginatedAgreements,
} from './repository';
import { AgreementsRepository } from './repository';
import type {
  AgreementImportRequest,
  AgreementRatePayload,
  AgreementUpdatePayload,
  AgreementWindowPayload,
} from './validators';

export interface AgreementsServiceDependencies {
  repository?: AgreementsRepository;
  logger?: typeof defaultLogger;
  emitAgreementEvent?: (agreementId: string, event: string, payload: unknown) => void;
  emitTenantEvent?: (tenantId: string, event: string, payload: unknown) => void;
}

export interface ActorContext {
  id: string;
  name: string;
}

export interface AgreementAuditMetadata {
  actor?: string | null;
  actorRole?: string | null;
  note?: string | null;
}

export interface AgreementDto {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  type: string | null;
  segment: string | null;
  description: string | null;
  tags: string[];
  products: Record<string, unknown>;
  metadata: Record<string, unknown>;
  archived: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  windows: AgreementWindowDto[];
  rates: AgreementRateDto[];
}

export interface AgreementWindowDto {
  id: string;
  label: string;
  tableId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface AgreementRateDto {
  id: string;
  tableId: string | null;
  windowId: string | null;
  product: string;
  modality: string;
  termMonths: number | null;
  coefficient: number | null;
  monthlyRate: number | null;
  annualRate: number | null;
  tacPercentage: number | null;
  metadata: Record<string, unknown>;
}

export interface AgreementHistoryDto {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AgreementListResult {
  items: AgreementDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgreementImportJobDto {
  id: string;
  agreementId: string | null;
  status: string;
  checksum: string | null;
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  errorCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
}

const toISOString = (value: Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  try {
    return value.toISOString();
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    try {
      const numeric = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(numeric) ? numeric : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mapWindow = (record: AgreementWindowRecord): AgreementWindowDto => ({
  id: record.id,
  label: record.label,
  tableId: record.tableId,
  startsAt: toISOString(record.startsAt),
  endsAt: toISOString(record.endsAt),
  isActive: record.isActive,
  metadata: { ...record.metadata },
});

const mapRate = (record: AgreementRateRecord): AgreementRateDto => ({
  id: record.id,
  tableId: record.tableId,
  windowId: record.windowId,
  product: record.product,
  modality: record.modality,
  termMonths: record.termMonths ?? null,
  coefficient: toNumber(record.coefficient),
  monthlyRate: toNumber(record.monthlyRate),
  annualRate: toNumber(record.annualRate),
  tacPercentage: toNumber(record.tacPercentage),
  metadata: { ...record.metadata },
});

const mapAgreement = (record: AgreementRecord): AgreementDto => ({
  id: record.id,
  tenantId: record.tenantId,
  name: record.name,
  slug: record.slug,
  status: record.status,
  type: record.type ?? null,
  segment: record.segment ?? null,
  description: record.description ?? null,
  tags: Array.isArray(record.tags) ? [...record.tags] : [],
  products: { ...record.products },
  metadata: { ...record.metadata },
  archived: Boolean(record.archived),
  publishedAt: toISOString(record.publishedAt),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  windows: Array.isArray(record.windows) ? record.windows.map(mapWindow) : [],
  rates: Array.isArray(record.rates) ? record.rates.map(mapRate) : [],
});

const mapHistory = (record: AgreementHistoryRecord): AgreementHistoryDto => ({
  id: record.id,
  actorId: record.actorId,
  actorName: record.actorName,
  action: record.action,
  message: record.message,
  createdAt: record.createdAt.toISOString(),
  metadata: { ...record.metadata },
});

const mapImportJob = (record: AgreementImportJobRecord): AgreementImportJobDto => ({
  id: record.id,
  agreementId: record.agreementId,
  status: record.status,
  checksum: record.checksum,
  fileName: record.fileName,
  totalRows: record.totalRows,
  processedRows: record.processedRows,
  errorCount: record.errorCount,
  createdAt: record.createdAt.toISOString(),
  startedAt: toISOString(record.startedAt),
  finishedAt: toISOString(record.finishedAt),
  errorMessage: record.errorMessage,
});

export class AgreementsService {
  private readonly repository: AgreementsRepository;
  private readonly logger: typeof defaultLogger;
  private readonly emitAgreementEvent: (agreementId: string, event: string, payload: unknown) => void;
  private readonly emitTenantEvent: (tenantId: string, event: string, payload: unknown) => void;

  constructor(dependencies: AgreementsServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new AgreementsRepository();
    this.logger = dependencies.logger ?? defaultLogger;
    this.emitAgreementEvent = dependencies.emitAgreementEvent ?? emitToAgreement;
    this.emitTenantEvent = dependencies.emitTenantEvent ?? emitToTenant;
  }

  async listAgreements(
    tenantId: string,
    filters: AgreementListFilters,
    pagination: { page: number; limit: number }
  ): Promise<AgreementListResult> {
    const results: PaginatedAgreements = await this.repository.listAgreements(tenantId, filters, pagination);
    return {
      items: results.items.map(mapAgreement),
      total: results.total,
      page: results.page,
      limit: results.limit,
      totalPages: results.totalPages,
    };
  }

  async getAgreement(tenantId: string, agreementId: string): Promise<AgreementDto | null> {
    const agreement = await this.repository.findAgreementById(tenantId, agreementId);
    return agreement ? mapAgreement(agreement) : null;
  }

  async createAgreement(
    tenantId: string,
    payload: AgreementUpdatePayload,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<AgreementDto> {
    const created = await this.repository.createAgreement({
      tenantId,
      name: payload.name!,
      slug: payload.slug!,
      status: payload.status ?? 'draft',
      type: payload.type ?? null,
      segment: payload.segment ?? null,
      description: payload.description ?? null,
      tags: payload.tags ?? [],
      products: payload.products ?? {},
      metadata: payload.metadata ?? {},
      archived: payload.archived ?? false,
      publishedAt: payload.publishedAt ?? null,
    });

    await this.appendHistory(tenantId, created.id, {
      actor,
      action: 'created',
      message: `Convênio ${created.name} criado`,
      metadata: { slug: created.slug },
      audit,
    });

    const dto = mapAgreement(created);
    this.emitAgreementEvent(dto.id, 'agreement.created', dto);
    this.emitTenantEvent(tenantId, 'agreements.updated', { agreementId: dto.id, event: 'created' });

    this.logger.info('[/agreements] Agreement created', {
      tenantId,
      agreementId: dto.id,
      slug: dto.slug,
      actorId: actor?.id ?? null,
    });

    return dto;
  }

  async updateAgreement(
    tenantId: string,
    agreementId: string,
    payload: AgreementUpdatePayload,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<AgreementDto> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    const updated = await this.repository.updateAgreement(tenantId, agreementId, {
      name: payload.name ?? existing.name,
      slug: payload.slug ?? existing.slug,
      status: payload.status ?? existing.status,
      type: payload.type ?? existing.type,
      segment: payload.segment ?? existing.segment,
      description: payload.description ?? existing.description,
      tags: payload.tags ?? existing.tags,
      products: payload.products ?? existing.products,
      metadata: payload.metadata ?? existing.metadata,
      archived: payload.archived ?? existing.archived,
      publishedAt: payload.publishedAt ?? existing.publishedAt,
    });

    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: 'updated',
      message: `Convênio ${updated.name} atualizado`,
      metadata: { changes: Object.keys(payload) },
      audit,
    });

    const dto = mapAgreement(updated);
    this.emitAgreementEvent(dto.id, 'agreement.updated', dto);
    this.emitTenantEvent(tenantId, 'agreements.updated', { agreementId: dto.id, event: 'updated' });

    this.logger.info('[/agreements] Agreement updated', {
      tenantId,
      agreementId: dto.id,
      actorId: actor?.id ?? null,
      changes: Object.keys(payload),
    });

    return dto;
  }

  async archiveAgreement(
    tenantId: string,
    agreementId: string,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<AgreementDto> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    const updated = await this.repository.updateAgreement(tenantId, agreementId, {
      archived: true,
      status: existing.status === 'active' ? 'archived' : existing.status,
    });

    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: 'archived',
      message: `Convênio ${updated.name} arquivado`,
      metadata: {},
      audit,
    });

    const dto = mapAgreement(updated);
    this.emitAgreementEvent(dto.id, 'agreement.archived', dto);
    this.emitTenantEvent(tenantId, 'agreements.updated', { agreementId: dto.id, event: 'archived' });

    this.logger.info('[/agreements] Agreement archived', {
      tenantId,
      agreementId: dto.id,
      actorId: actor?.id ?? null,
    });

    return dto;
  }

  async upsertWindow(
    tenantId: string,
    agreementId: string,
    payload: AgreementWindowPayload,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<AgreementWindowDto> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    if (payload.id) {
      const belongsToAgreement = (existing.windows ?? []).some((window) => window.id === payload.id);
      if (!belongsToAgreement) {
        throw Object.assign(new Error('Agreement window not found'), {
          code: 'AGREEMENT_WINDOW_NOT_FOUND',
          status: 404,
        });
      }
    }

    if (payload.tableId) {
      const hasTable = (existing.tables ?? []).some((table) => table.id === payload.tableId);
      if (!hasTable) {
        throw Object.assign(new Error('Agreement table not found'), {
          code: 'AGREEMENT_TABLE_NOT_FOUND',
          status: 404,
        });
      }
    }

    const result = await this.repository.upsertWindow(tenantId, agreementId, payload.id ?? null, {
      tableId: payload.tableId ?? null,
      label: payload.label,
      startsAt: payload.startsAt ?? null,
      endsAt: payload.endsAt ?? null,
      isActive: payload.isActive ?? true,
      metadata: payload.metadata ?? {},
    });

    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: payload.id ? 'window.updated' : 'window.created',
      message: `Janela ${result.label} ${payload.id ? 'atualizada' : 'criada'}`,
      metadata: { windowId: result.id },
      audit,
    });

    const dto = mapWindow(result);
    this.emitAgreementEvent(agreementId, 'agreement.window.updated', dto);

    return dto;
  }

  async removeWindow(
    tenantId: string,
    agreementId: string,
    windowId: string,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<void> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    const belongsToAgreement = (existing.windows ?? []).some((window) => window.id === windowId);
    if (!belongsToAgreement) {
      throw Object.assign(new Error('Agreement window not found'), {
        code: 'AGREEMENT_WINDOW_NOT_FOUND',
        status: 404,
      });
    }

    await this.repository.deleteWindow(tenantId, windowId);
    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: 'window.deleted',
      message: `Janela ${windowId} removida`,
      metadata: { windowId },
      audit,
    });

    this.emitAgreementEvent(agreementId, 'agreement.window.deleted', { windowId });
  }

  async upsertRate(
    tenantId: string,
    agreementId: string,
    payload: AgreementRatePayload,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<AgreementRateDto> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    if (payload.id) {
      const belongsToAgreement = (existing.rates ?? []).some((rate) => rate.id === payload.id);
      if (!belongsToAgreement) {
        throw Object.assign(new Error('Agreement rate not found'), {
          code: 'AGREEMENT_RATE_NOT_FOUND',
          status: 404,
        });
      }
    }

    if (payload.tableId) {
      const hasTable = (existing.tables ?? []).some((table) => table.id === payload.tableId);
      if (!hasTable) {
        throw Object.assign(new Error('Agreement table not found'), {
          code: 'AGREEMENT_TABLE_NOT_FOUND',
          status: 404,
        });
      }
    }

    if (payload.windowId) {
      const hasWindow = (existing.windows ?? []).some((window) => window.id === payload.windowId);
      if (!hasWindow) {
        throw Object.assign(new Error('Agreement window not found'), {
          code: 'AGREEMENT_WINDOW_NOT_FOUND',
          status: 404,
        });
      }
    }

    const result = await this.repository.upsertRate(tenantId, agreementId, payload.id ?? null, {
      tableId: payload.tableId ?? null,
      windowId: payload.windowId ?? null,
      product: payload.product,
      modality: payload.modality,
      termMonths: payload.termMonths ?? null,
      coefficient: payload.coefficient ?? null,
      monthlyRate: payload.monthlyRate ?? null,
      annualRate: payload.annualRate ?? null,
      tacPercentage: payload.tacPercentage ?? null,
      metadata: payload.metadata ?? {},
    });

    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: payload.id ? 'rate.updated' : 'rate.created',
      message: `Taxa ${result.product}/${result.modality} ${payload.id ? 'atualizada' : 'criada'}`,
      metadata: { rateId: result.id },
      audit,
    });

    const dto = mapRate(result);
    this.emitAgreementEvent(agreementId, 'agreement.rate.updated', dto);
    return dto;
  }

  async removeRate(
    tenantId: string,
    agreementId: string,
    rateId: string,
    actor: ActorContext | null,
    audit?: AgreementAuditMetadata | null
  ): Promise<void> {
    const existing = await this.repository.findAgreementById(tenantId, agreementId);
    if (!existing) {
      throw Object.assign(new Error('Agreement not found'), { code: 'AGREEMENT_NOT_FOUND', status: 404 });
    }

    const belongsToAgreement = (existing.rates ?? []).some((rate) => rate.id === rateId);
    if (!belongsToAgreement) {
      throw Object.assign(new Error('Agreement rate not found'), {
        code: 'AGREEMENT_RATE_NOT_FOUND',
        status: 404,
      });
    }

    await this.repository.deleteRate(tenantId, rateId);
    await this.appendHistory(tenantId, agreementId, {
      actor,
      action: 'rate.deleted',
      message: `Taxa ${rateId} removida`,
      metadata: { rateId },
      audit,
    });

    this.emitAgreementEvent(agreementId, 'agreement.rate.deleted', { rateId });
  }

  async listHistory(tenantId: string, agreementId: string, limit = 20): Promise<AgreementHistoryDto[]> {
    const history = await this.repository.listHistory(tenantId, agreementId, limit);
    return history.map(mapHistory);
  }

  async requestImport(
    tenantId: string,
    agreementId: string | null,
    payload: AgreementImportRequest,
    actor: ActorContext | null
  ): Promise<AgreementImportJobDto> {
    const existingJob = await this.repository.findImportJobByChecksum(tenantId, payload.checksum);
    if (existingJob && existingJob.status !== 'failed') {
      return mapImportJob(existingJob);
    }

    const job = await this.repository.createImportJob(tenantId, agreementId, {
      source: 'api',
      status: 'pending',
      checksum: payload.checksum,
      fileName: payload.fileName,
      metadata: {
        tempFilePath: payload.tempFilePath,
        mimeType: payload.mimeType ?? null,
        size: payload.size,
      },
    });

    if (agreementId ?? job.agreementId) {
      await this.appendHistory(tenantId, (agreementId ?? job.agreementId) as string, {
        actor,
        action: 'import.requested',
        message: 'Importação de convênios solicitada',
        metadata: { jobId: job.id },
      });
    }

    this.logger.info('[/agreements] Import job created', {
      tenantId,
      agreementId: agreementId ?? null,
      jobId: job.id,
      checksum: payload.checksum,
      actorId: actor?.id ?? null,
    });

    return mapImportJob(job);
  }

  async completeImport(
    tenantId: string,
    jobId: string,
    updates: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobDto> {
    const job = await this.repository.updateImportJob(tenantId, jobId, updates);

    const status = updates.status ?? job.status;
    if (job.agreementId && status) {
      const action = status === 'completed' ? 'import.completed' : status === 'failed' ? 'import.failed' : null;
      if (action) {
        const message =
          status === 'completed'
            ? 'Importação concluída com sucesso'
            : 'Importação de convênio falhou';
        await this.appendHistory(tenantId, job.agreementId, {
          actor: null,
          action,
          message,
          metadata: { jobId: job.id, status, errorMessage: job.errorMessage ?? null },
        });
      }
    }

    return mapImportJob(job);
  }

  private async appendHistory(
    tenantId: string,
    agreementId: string,
    entry: {
      actor: ActorContext | null;
      action: string;
      message: string;
      metadata: Record<string, unknown>;
      audit?: AgreementAuditMetadata | null;
    }
  ): Promise<void> {
    const actorName = entry.actor?.name ?? 'Sistema';
    const metadata = entry.audit ? { ...entry.metadata, audit: entry.audit } : entry.metadata;
    await this.repository.appendHistoryEntry(tenantId, agreementId, {
      actorId: entry.actor?.id ?? null,
      actorName,
      action: entry.action,
      message: entry.message,
      metadata,
      windowId: metadata.windowId ? String(metadata.windowId) : null,
    });
  }
}
