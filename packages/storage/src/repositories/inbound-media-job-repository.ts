import { Prisma } from '@prisma/client';

import { getPrismaClient } from '../prisma-client';

export type InboundMediaJobStatus = Prisma.InboundMediaJobStatus;

export interface InboundMediaJob {
  id: string;
  tenantId: string;
  messageId: string;
  messageExternalId: string | null;
  instanceId: string | null;
  brokerId: string | null;
  mediaType: string | null;
  mediaKey: string | null;
  directPath: string | null;
  status: InboundMediaJobStatus;
  attempts: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const coerceMetadata = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
};

const mapInboundMediaJob = (record: Prisma.InboundMediaJob): InboundMediaJob => ({
  id: record.id,
  tenantId: record.tenantId,
  messageId: record.messageId,
  messageExternalId: record.messageExternalId ?? null,
  instanceId: record.instanceId ?? null,
  brokerId: record.brokerId ?? null,
  mediaType: record.mediaType ?? null,
  mediaKey: record.mediaKey ?? null,
  directPath: record.directPath ?? null,
  status: record.status,
  attempts: record.attempts,
  nextRetryAt: record.nextRetryAt ?? null,
  lastError: record.lastError ?? null,
  metadata: coerceMetadata(record.metadata),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const truncateError = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 1000 ? `${trimmed.slice(0, 997)}...` : trimmed;
};

export interface EnqueueInboundMediaJobInput {
  tenantId: string;
  messageId: string;
  messageExternalId?: string | null;
  instanceId?: string | null;
  brokerId?: string | null;
  mediaType?: string | null;
  mediaKey?: string | null;
  directPath?: string | null;
  metadata?: Record<string, unknown> | null;
  nextRetryAt?: Date | null;
}

export const enqueueInboundMediaJob = async (input: EnqueueInboundMediaJobInput): Promise<InboundMediaJob> => {
  const prisma = getPrismaClient();
  const now = new Date();

  const upsertArgs: Prisma.InboundMediaJobUpsertArgs = {
    where: { messageId: input.messageId },
    update: {
      tenantId: input.tenantId,
      status: 'PENDING',
      nextRetryAt: input.nextRetryAt ?? now,
      lastError: null,
    },
    create: {
      tenantId: input.tenantId,
      message: { connect: { id: input.messageId } },
      status: 'PENDING',
      nextRetryAt: input.nextRetryAt ?? now,
    },
  };

  const { update, create } = upsertArgs;

  if (input.messageExternalId !== undefined) {
    update.messageExternalId = input.messageExternalId ?? null;
    create.messageExternalId = input.messageExternalId ?? null;
  }

  if (input.instanceId !== undefined) {
    update.instanceId = input.instanceId ?? null;
    create.instanceId = input.instanceId ?? null;
  }

  if (input.brokerId !== undefined) {
    update.brokerId = input.brokerId ?? null;
    create.brokerId = input.brokerId ?? null;
  }

  if (input.mediaType !== undefined) {
    update.mediaType = input.mediaType ?? null;
    create.mediaType = input.mediaType ?? null;
  }

  if (input.mediaKey !== undefined) {
    update.mediaKey = input.mediaKey ?? null;
    create.mediaKey = input.mediaKey ?? null;
  }

  if (input.directPath !== undefined) {
    update.directPath = input.directPath ?? null;
    create.directPath = input.directPath ?? null;
  }

  if (input.metadata !== undefined) {
    const payload = (input.metadata ?? {}) as Prisma.InputJsonValue;
    update.metadata = payload;
    create.metadata = payload;
  }

  const job = await prisma.inboundMediaJob.upsert(upsertArgs);
  return mapInboundMediaJob(job);
};

export const findPendingInboundMediaJobs = async (
  limit: number,
  referenceDate: Date = new Date()
): Promise<InboundMediaJob[]> => {
  const prisma = getPrismaClient();

  const records = await prisma.inboundMediaJob.findMany({
    where: {
      status: 'PENDING',
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: referenceDate } }],
    },
    orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(limit, 1),
  });

  return records.map(mapInboundMediaJob);
};

export const markInboundMediaJobProcessing = async (jobId: string): Promise<InboundMediaJob | null> => {
  const prisma = getPrismaClient();

  const updated = await prisma.inboundMediaJob.updateMany({
    where: { id: jobId, status: 'PENDING' },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
  });

  if (updated.count === 0) {
    return null;
  }

  const record = await prisma.inboundMediaJob.findUnique({ where: { id: jobId } });
  return record ? mapInboundMediaJob(record) : null;
};

export const completeInboundMediaJob = async (jobId: string): Promise<InboundMediaJob | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.inboundMediaJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', nextRetryAt: null, lastError: null },
  });

  return mapInboundMediaJob(record);
};

export const rescheduleInboundMediaJob = async (
  jobId: string,
  nextRetryAt: Date,
  lastError?: string | null
): Promise<InboundMediaJob | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.inboundMediaJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      nextRetryAt,
      lastError: truncateError(lastError ?? null),
    },
  });

  return mapInboundMediaJob(record);
};

export const failInboundMediaJob = async (jobId: string, lastError?: string | null): Promise<InboundMediaJob | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.inboundMediaJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      nextRetryAt: null,
      lastError: truncateError(lastError ?? null),
    },
  });

  return mapInboundMediaJob(record);
};
