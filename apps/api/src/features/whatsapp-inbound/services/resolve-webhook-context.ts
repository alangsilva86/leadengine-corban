import { prisma } from '../../../lib/prisma';
import type { RawBaileysUpsertEvent } from './baileys-raw-normalizer';
import { readString } from '../utils/webhook-parsers';

export type ResolveWebhookContextOptions = {
  eventRecord: RawBaileysUpsertEvent;
  envelopeRecord: Record<string, unknown>;
  defaultInstanceId?: string | null;
};

export type ResolvedWebhookContext = {
  instanceId: string | undefined;
  brokerId: string | undefined;
  tenantId: string | undefined;
  rawInstanceId: string | undefined;
};

const normalizeBrokerId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveWebhookContext = async ({
  eventRecord,
  envelopeRecord,
  defaultInstanceId,
}: ResolveWebhookContextOptions): Promise<ResolvedWebhookContext> => {
  const resolvedDefaultInstanceId = defaultInstanceId ?? null;

  const rawInstanceId =
    readString((eventRecord as { instanceId?: unknown }).instanceId, envelopeRecord.instanceId) ??
    resolvedDefaultInstanceId ??
    undefined;

  let instanceId = rawInstanceId;
  let brokerId: string | undefined;
  let tenantId =
    readString((eventRecord as { tenantId?: unknown }).tenantId, envelopeRecord.tenantId) ?? undefined;

  if (!rawInstanceId) {
    return { instanceId, brokerId, tenantId, rawInstanceId: undefined };
  }

  const directMatch = await prisma.whatsAppInstance.findFirst({
    where: {
      OR: [{ id: rawInstanceId }, { brokerId: rawInstanceId }],
    },
    select: {
      id: true,
      brokerId: true,
      tenantId: true,
    },
  });

  let resolvedInstance = directMatch;

  if (!resolvedInstance && resolvedDefaultInstanceId && resolvedDefaultInstanceId !== rawInstanceId) {
    resolvedInstance = await prisma.whatsAppInstance.findUnique({
      where: { id: resolvedDefaultInstanceId },
      select: {
        id: true,
        brokerId: true,
        tenantId: true,
      },
    });
  }

  if (!resolvedInstance) {
    return { instanceId, brokerId, tenantId, rawInstanceId };
  }

  instanceId = resolvedInstance.id;

  const storedBrokerId = normalizeBrokerId(resolvedInstance.brokerId);

  if (rawInstanceId && storedBrokerId !== rawInstanceId) {
    await prisma.whatsAppInstance.update({
      where: { id: resolvedInstance.id },
      data: { brokerId: rawInstanceId },
    });
  }

  brokerId = rawInstanceId ?? storedBrokerId ?? undefined;

  if (!tenantId && resolvedInstance.tenantId) {
    tenantId = resolvedInstance.tenantId;
  }

  return { instanceId, brokerId, tenantId, rawInstanceId };
};

