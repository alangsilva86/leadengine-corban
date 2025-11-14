import type { PrismaClient } from '@prisma/client';
import { prisma as prismaClient } from '../../lib/prisma';

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

const defaultPrisma = prismaClient as unknown as AgreementsPrismaClient;

export class AgreementsRepository {
  private readonly prisma: AgreementsPrismaClient;

  constructor(dependencies: AgreementsRepositoryDependencies = {}) {
    this.prisma = dependencies.prisma ?? defaultPrisma;
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
  }

  findAgreementById(tenantId: string, agreementId: string): Promise<AgreementRecord | null> {
    return this.prisma.agreement.findFirst({
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
    });
  }

  createAgreement(data: Partial<AgreementRecord> & { tenantId: string; name: string; slug: string }): Promise<AgreementRecord> {
    return this.prisma.agreement.create({
      data,
    });
  }

  updateAgreement(
    tenantId: string,
    agreementId: string,
    data: Partial<AgreementRecord>
  ): Promise<AgreementRecord> {
    return this.prisma.agreement.update({
      where: { id: agreementId },
      data,
    });
  }

  deleteAgreement(tenantId: string, agreementId: string): Promise<AgreementRecord> {
    return this.prisma.agreement.delete({
      where: { id: agreementId },
    });
  }

  upsertWindow(
    tenantId: string,
    agreementId: string,
    windowId: string | null,
    payload: Partial<AgreementWindowRecord>
  ): Promise<AgreementWindowRecord> {
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
  }

  deleteWindow(tenantId: string, windowId: string): Promise<AgreementWindowRecord> {
    return this.prisma.agreementWindow.delete({
      where: { id: windowId },
    });
  }

  upsertRate(
    tenantId: string,
    agreementId: string,
    rateId: string | null,
    payload: Partial<AgreementRateRecord>
  ): Promise<AgreementRateRecord> {
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
  }

  deleteRate(tenantId: string, rateId: string): Promise<AgreementRateRecord> {
    return this.prisma.agreementRate.delete({
      where: { id: rateId },
    });
  }

  appendHistoryEntry(
    tenantId: string,
    agreementId: string,
    entry: Omit<AgreementHistoryRecord, 'id' | 'tenantId' | 'agreementId' | 'createdAt'>
  ): Promise<AgreementHistoryRecord> {
    return this.prisma.agreementHistory.create({
      data: {
        ...entry,
        tenantId,
        agreementId,
      },
    });
  }

  listHistory(
    tenantId: string,
    agreementId: string,
    limit: number
  ): Promise<AgreementHistoryRecord[]> {
    return this.prisma.agreementHistory.findMany({
      where: { tenantId, agreementId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  createImportJob(
    tenantId: string,
    agreementId: string | null,
    payload: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    return this.prisma.agreementImportJob.create({
      data: {
        ...payload,
        tenantId,
        agreementId,
      },
    });
  }

  findImportJobByChecksum(
    tenantId: string,
    checksum: string
  ): Promise<AgreementImportJobRecord | null> {
    return this.prisma.agreementImportJob.findFirst({
      where: { tenantId, checksum },
    });
  }

  updateImportJob(
    tenantId: string,
    jobId: string,
    updates: Partial<AgreementImportJobRecord>
  ): Promise<AgreementImportJobRecord> {
    return this.prisma.agreementImportJob.update({
      where: { id: jobId },
      data: updates,
    });
  }

  async markImportJobProcessing(jobId: string): Promise<AgreementImportJobRecord | null> {
    const updated = await this.prisma.agreementImportJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    return updated;
  }

  async findPendingImportJobs(limit: number): Promise<AgreementImportJobRecord[]> {
    return this.prisma.agreementImportJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
