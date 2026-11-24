import { prisma } from '../../../lib/prisma';
import type { RawBaileysUpsertEvent } from './baileys-raw-normalizer';
import { readString } from '../utils/webhook-parsers';

type ResolveWebhookContextOptions = {
  eventRecord: RawBaileysUpsertEvent;
  envelopeRecord: Record<string, unknown>;
  defaultInstanceId?: string | null;
  expectedTenantId?: string | null;
};

export const resolveWebhookContext = async ({
  eventRecord,
  envelopeRecord,
  defaultInstanceId,
  expectedTenantId,
}: ResolveWebhookContextOptions) => {
  const rawInstanceId = readString(eventRecord.instanceId, envelopeRecord.instanceId, defaultInstanceId) ?? undefined;
  const unresolved = { rawInstanceId, instanceId: undefined, brokerId: undefined, tenantId: undefined };
  if (!rawInstanceId) return unresolved;

  const tenantHints = [expectedTenantId, readString(eventRecord.tenantId), readString(envelopeRecord.tenantId)];
  const instances = await prisma.whatsAppInstance.findMany({
    where: { OR: [{ id: rawInstanceId }, { brokerId: rawInstanceId }] },
    select: { id: true, brokerId: true, tenantId: true },
    take: 2,
  });
  const [instance] = instances;
  if (instances.length !== 1 || !instance || tenantHints.some((hint) => hint && hint !== instance.tenantId)) {
    return unresolved;
  }

  const tenant = await prisma.tenant.findFirst({ where: { id: instance.tenantId, isActive: true }, select: { id: true } });
  if (!tenant) return unresolved;

  return { rawInstanceId, instanceId: instance.id, brokerId: instance.brokerId ?? undefined, tenantId: instance.tenantId };
};
