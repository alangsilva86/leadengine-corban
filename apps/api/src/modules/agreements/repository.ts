import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { DatabaseDisabledError, isDatabaseEnabled, prisma as prismaClient } from '../../lib/prisma';
import { getAgreementsConfig } from './config';
import { DemoAgreementsStore } from './demo-store';

export interface AgreementRecord {
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
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tables?: AgreementTableRecord[];
  windows?: AgreementWindowRecord[];
  rates?: AgreementRateRecord[];
  history?: AgreementHistoryRecord[];
}

export interface AgreementTableRecord {
  id: string;
  tenantId: string;
  agreementId: string;
  externalId: string | null;
  name: string;
  product: string;
  modality: string;
  version: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgreementWindowRecord {
  id: string;
  tenantId: string;
  agreementId: string;
  tableId: string | null;
  label: string;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgreementRateRecord {
  id: string;
  tenantId: string;
  agreementId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AgreementHistoryRecord {
  id: string;
  tenantId: string;
  agreementId: string;
  windowId: string | null;
  actorId: string | null;
  actorName: string | null;
  action: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AgreementImportJobRecord {
  id: string;
  tenantId: string;
  agreementId: string | null;
  source: string | null;
  fileKey: string | null;
  fileName: string | null;
  checksum: string | null;
  status: string;
  totalRows: number;
  processedRows: number;
  errorCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaDelegate<TRecord> {
  findMany(args?: unknown): Promise<TRecord[]>;
  findUnique(args: unknown): Promise<TRecord | null>;
  findFirst(args: unknown): Promise<TRecord | null>;
  create(args: unknown): Promise<TRecord>;
  update(args: unknown): Promise<TRecord>;
  delete(args: unknown): Promise<TRecord>;
  count(args: unknown): Promise<number>;
}

interface AgreementsPrismaClient extends PrismaClient {
  agreement: PrismaDelegate<AgreementRecord>;
  agreementTable: PrismaDelegate<AgreementTableRecord>;
  agreementWindow: PrismaDelegate<AgreementWindowRecord>;
  agreementRate: PrismaDelegate<AgreementRateRecord>;
  agreementHistory: PrismaDelegate<AgreementHistoryRecord>;
  agreementImportJob: PrismaDelegate<AgreementImportJobRecord> & {
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface AgreementListFilters {
  search?: string;
  status?: string;
}

export interface PaginatedAgreements {
  items: AgreementRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgreementsRepositoryDependencies {
  prisma?: AgreementsPrismaClient;
}

interface StorageOperationOptions<T> {
  tenantId?: string;
  operation: string;
  database: () => Promise<T>;
  fallback: (store: DemoAgreementsStore) => Promise<T>;
}

const STORAGE_DISABLED_ERROR_CODES = new Set(['DATABASE_DISABLED', 'STORAGE_DATABASE_DISABLED']);
const STORAGE_UNAVAILABLE_PRISMA_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1014',
  'P1015',
  'P1016',
  'P1017',
  'P2000',
  'P2001',
  'P2002',
  'P2003',
  'P2004',
  'P2005',
  'P2006',
  'P2007',
  'P2008',
  'P2009',
  'P2010',
  'P2021',
  'P2022',
  'P2023',
  'P2024',
]);

const defaultPrisma = prismaClient as unknown as AgreementsPrismaClient;

const hasErrorName = (error: unknown, name: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if ('name' in error && typeof (error as { name?: unknown }).name === 'string') {
    return (error as { name: string }).name === name;
  }

  return false;
};

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  return null;
};

export class AgreementsRepository {
  private readonly prisma: AgreementsPrismaClient;
  private readonly demoMode: boolean;
  private demoStore: DemoAgreementsStore | null;

  constructor(dependencies: AgreementsRepositoryDependencies = {}) {
    this.prisma = dependencies.prisma ?? defaultPrisma;
    const { demoModeEnabled } = getAgreementsConfig();
    this.demoMode = demoModeEnabled || !isDatabaseEnabled;
    this.demoStore = this.demoMode ? new DemoAgreementsStore() : null;

    if (this.demoMode) {
      logger.warn('[/agreements] Demo mode enabled — database operations are disabled.');
    }
  }

  private getOrCreateDemoStore(): DemoAgreementsStore {
    if (!this.demoStore) {
      this.demoStore = new DemoAgreementsStore();
    }

    return this.demoStore;
  }

  private shouldFallbackForError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    if (error instanceof DatabaseDisabledError || hasErrorName(error, 'DatabaseDisabledError')) {
      return true;
    }

    const hasInitializationError = typeof Prisma.PrismaClientInitializationError === 'function';
    if (hasInitializationError && error instanceof Prisma.PrismaClientInitializationError) {
      return true;
    }

    const hasRustPanicError = typeof Prisma.PrismaClientRustPanicError === 'function';
    if (hasRustPanicError && error instanceof Prisma.PrismaClientRustPanicError) {
      return true;
    }

    const hasKnownRequestError = typeof Prisma.PrismaClientKnownRequestError === 'function';
    if (hasKnownRequestError && error instanceof Prisma.PrismaClientKnownRequestError) {
      return STORAGE_UNAVAILABLE_PRISMA_CODES.has(error.code);
    }

    const code = readErrorCode(error);
    if (code && (STORAGE_DISABLED_ERROR_CODES.has(code) || STORAGE_UNAVAILABLE_PRISMA_CODES.has(code))) {
      return true;
    }

    return false;
  }

  private async withStorageFallback<T>(options: StorageOperationOptions<T>): Promise<T> {
    const { database, fallback, tenantId, operation } = options;

    if (this.demoMode) {
      return fallback(this.getOrCreateDemoStore());
    }

    try {
      return await database();
    } catch (error) {
      if (this.shouldFallbackForError(error)) {
        logger.warn('[/agreements] storage unavailable — using demo fallback', {
          tenantId: tenantId ?? 'unknown',
          operation,
          error,
        });
        const store = this.getOrCreateDemoStore();
        return fallback(store);
      }

      throw error;
    }
  }

  async listAgreements(
    tenantId: string,
    filters: AgreementListFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedAgreements> {
    const page = Math.max(pagination.page, 1);
    const limit = Math.min(Math.max(pagination.limit, 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { segment: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.withStorageFallback({
      tenantId,
      operation: 'listAgreements',
      database: async () => {
        const [total, items] = await this.prisma.$transaction([
          this.prisma.agreement.count({ where }),
          this.prisma.agreement.findMany({
            where,
            include: {
              tables: true,
              windows: true,
              rates: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
        ]);

        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

        return { items, total, page, limit, totalPages };
      },
      fallback: (store) => store.listAgreements(tenantId, filters, { page, limit }),
    });
  }

  findAgreementById(tenantId: string, agreementId: string): Promise<AgreementRecord | null> {
    return this.withStorageFallback({
      tenantId,
      operation: 'findAgreementById',
      database: () =>
        this.prisma.agreement.findFirst({
          where: { tenantId, id: agreementId },
          include: {
            tables: true,
            windows: true,
            rates: true,
            history: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        }),
      fallback: (store) => store.findAgreementById(tenantId, agreementId),
    });
  }

  createAgreement(data: Partial<AgreementRecord> & { tenantId: string; name: string; slug: string }): Promise<AgreementRecord> {
    return this.withStorageFallback({
      tenantId: data.tenantId,
      operation: 'createAgreement',
      database: () =>
        this.prisma.agreement.create({
          data,
        }),
      fallback: (store) => store.createAgreement(data),
    });
  }

  updateAgreement(
    tenantId: string,
    agreementId: string,
    data: Partial<AgreementRecord>
  ): Promise<AgreementRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'updateAgreement',
      database: () =>
        this.prisma.agreement.update({
          where: { id: agreementId },
          data,
        }),
      fallback: (store) => store.updateAgreement(tenantId, agreementId, data),
    });
  }

  deleteAgreement(tenantId: string, agreementId: string): Promise<AgreementRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'deleteAgreement',
      database: () =>
        this.prisma.agreement.delete({
          where: { id: agreementId },
        }),
      fallback: (store) => store.deleteAgreement(tenantId, agreementId),
    });
  }

  upsertWindow(
    tenantId: string,
    agreementId: string,
    windowId: string | null,
    payload: Partial<AgreementWindowRecord>
  ): Promise<AgreementWindowRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'upsertWindow',
      database: () => {
        if (windowId) {
          return this.prisma.agreementWindow.update({
            where: { id: windowId },
            data: payload,
          });
        }

        return this.prisma.agreementWindow.create({
          data: {
            ...payload,
            tenantId,
            agreementId,
          },
        });
      },
      fallback: (store) => store.upsertWindow(tenantId, agreementId, windowId, payload),
    });
  }

  deleteWindow(tenantId: string, windowId: string): Promise<AgreementWindowRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'deleteWindow',
      database: () =>
        this.prisma.agreementWindow.delete({
          where: { id: windowId },
        }),
      fallback: (store) => store.deleteWindow(tenantId, windowId),
    });
  }

  upsertRate(
    tenantId: string,
    agreementId: string,
    rateId: string | null,
    payload: Partial<AgreementRateRecord>
  ): Promise<AgreementRateRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'upsertRate',
      database: () => {
        if (rateId) {
          return this.prisma.agreementRate.update({
            where: { id: rateId },
            data: payload,
          });
        }

        return this.prisma.agreementRate.create({
          data: {
            ...payload,
            tenantId,
            agreementId,
          },
        });
      },
      fallback: (store) => store.upsertRate(tenantId, agreementId, rateId, payload),
    });
  }

  deleteRate(tenantId: string, rateId: string): Promise<AgreementRateRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'deleteRate',
      database: () =>
        this.prisma.agreementRate.delete({
          where: { id: rateId },
        }),
      fallback: (store) => store.deleteRate(tenantId, rateId),
    });
  }

  appendHistoryEntry(
    tenantId: string,
    agreementId: string,
    entry: Omit<AgreementHistoryRecord, 'id' | 'tenantId' | 'agreementId' | 'createdAt'>
  ): Promise<AgreementHistoryRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'appendHistoryEntry',
      database: () =>
        this.prisma.agreementHistory.create({
          data: {
            ...entry,
            tenantId,
            agreementId,
          },
        }),
      fallback: (store) => store.appendHistoryEntry(tenantId, agreementId, entry),
    });
  }

  listHistory(
    tenantId: string,
    agreementId: string,
    limit: number
  ): Promise<AgreementHistoryRecord[]> {
    return this.withStorageFallback({
      tenantId,
      operation: 'listHistory',
      database: () =>
        this.prisma.agreementHistory.findMany({
          where: { tenantId, agreementId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      fallback: (store) => store.listHistory(tenantId, agreementId, limit),
    });
  }

  createImportJob(
    tenantId: string,
    agreementId: string | null,
    payload: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'createImportJob',
      database: () =>
        this.prisma.agreementImportJob.create({
          data: {
            ...payload,
            tenantId,
            agreementId,
          },
        }),
      fallback: (store) => store.createImportJob(tenantId, agreementId, payload),
    });
  }

  findImportJobByChecksum(
    tenantId: string,
    checksum: string
  ): Promise<AgreementImportJobRecord | null> {
    return this.withStorageFallback({
      tenantId,
      operation: 'findImportJobByChecksum',
      database: () =>
        this.prisma.agreementImportJob.findFirst({
          where: { tenantId, checksum },
        }),
      fallback: (store) => store.findImportJobByChecksum(tenantId, checksum),
    });
  }

  updateImportJob(
    tenantId: string,
    jobId: string,
    updates: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    return this.withStorageFallback({
      tenantId,
      operation: 'updateImportJob',
      database: () =>
        this.prisma.agreementImportJob.update({
          where: { id: jobId },
          data: updates,
        }),
      fallback: (store) => store.updateImportJob(tenantId, jobId, updates),
    });
  }

  async markImportJobProcessing(jobId: string): Promise<AgreementImportJobRecord | null> {
    return this.withStorageFallback({
      operation: 'markImportJobProcessing',
      database: async () => {
        const updated = await this.prisma.agreementImportJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
          },
        });

        return updated;
      },
      fallback: (store) => store.markImportJobProcessing(jobId),
    });
  }

  async findPendingImportJobs(limit: number): Promise<AgreementImportJobRecord[]> {
    return this.withStorageFallback({
      operation: 'findPendingImportJobs',
      database: () =>
        this.prisma.agreementImportJob.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
          take: limit,
        }),
      fallback: (store) => store.findPendingImportJobs(limit),
    });
  }
}
