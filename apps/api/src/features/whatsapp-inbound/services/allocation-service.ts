import { logger as defaultLogger } from '../../../config/logger';
import { maskPhone as defaultMaskPhone } from '../../../lib/pii';
import { addAllocations as addAllocationsStore } from '../../../data/lead-allocation-store';
import { emitToAgreement as emitAgreementRealtime, emitToTenant as emitTenantRealtime } from '../../../lib/socket-registry';
import type { BrokerLeadRecord } from '../../../config/lead-engine';
import type { Campaign } from '@prisma/client';
import type { InboundWhatsAppEvent } from './inbound-lead-service';

type InboundContactDetails = InboundWhatsAppEvent['contact'];
type InboundMessageDetails = InboundWhatsAppEvent['message'];

type AllocationTargetBase = {
  campaign: Campaign | null;
  target: { campaignId?: string; instanceId?: string };
};

export type AllocationTarget = AllocationTargetBase;

export interface BuildAllocationTargetsArgs {
  campaigns: Campaign[];
  instanceId: string;
}

export const buildAllocationTargets = ({ campaigns, instanceId }: BuildAllocationTargetsArgs): AllocationTarget[] => {
  if (!campaigns.length) {
    return [{ campaign: null, target: { instanceId } }];
  }

  return campaigns.map((campaign) => ({
    campaign,
    target: { campaignId: campaign.id, instanceId },
  }));
};

export interface ProcessAllocationTargetsArgs {
  tenantId: string;
  instanceId: string;
  allocationTargets: AllocationTarget[];
  leadIdBase: string;
  document?: string | null;
  normalizedPhone?: string | null;
  leadName: string;
  registrations: string[];
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata: Record<string, unknown> | null | undefined;
  timestamp: string | null | undefined;
  requestId?: string | null;
  now: number;
  dedupeTtlMs: number;
}

export interface ProcessAllocationDependencies {
  shouldSkipByDedupe: (key: string, now: number) => Promise<boolean>;
  registerDedupeKey: (key: string, now: number, ttlMs: number) => Promise<void>;
  mapErrorForLog: (error: unknown) => unknown;
  isUniqueViolation: (error: unknown) => boolean;
  addAllocations?: typeof addAllocationsStore;
  emitToTenant?: typeof emitTenantRealtime;
  emitToAgreement?: typeof emitAgreementRealtime;
  logger?: typeof defaultLogger;
  maskPhone?: typeof defaultMaskPhone;
}

const defaultDependencies = {
  addAllocations: addAllocationsStore,
  emitToTenant: emitTenantRealtime,
  emitToAgreement: emitAgreementRealtime,
  logger: defaultLogger,
  maskPhone: defaultMaskPhone,
} satisfies Required<Omit<ProcessAllocationDependencies, 'shouldSkipByDedupe' | 'registerDedupeKey' | 'mapErrorForLog' | 'isUniqueViolation'>>;

const buildBrokerLead = ({
  leadIdBase,
  campaignId,
  leadName,
  document,
  registrations,
  agreementId,
  normalizedPhone,
  contact,
  message,
  metadata,
  timestamp,
  now,
  instanceId,
}: {
  leadIdBase: string;
  campaignId: string | null;
  leadName: string;
  document?: string | null;
  registrations: string[];
  agreementId: string;
  normalizedPhone?: string | null;
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata: Record<string, unknown> | null | undefined;
  timestamp: string | null | undefined;
  now: number;
  instanceId: string;
}): BrokerLeadRecord & {
  raw: {
    from: InboundContactDetails;
    message: InboundMessageDetails;
    metadata: Record<string, unknown>;
    receivedAt: string;
  };
} => {
  const leadId = campaignId ? `${leadIdBase}:${campaignId}` : `${leadIdBase}:instance:${instanceId}`;
  const receivedAt = timestamp ?? new Date(now).toISOString();
  const normalizedMetadata = (metadata ?? {}) as Record<string, unknown>;

  return {
    id: leadId,
    fullName: leadName,
    document: document ?? '',
    registrations,
    agreementId,
    phone: normalizedPhone ?? undefined,
    margin: undefined,
    netMargin: undefined,
    score: undefined,
    tags: ['inbound-whatsapp'],
    raw: {
      from: contact,
      message,
      metadata: normalizedMetadata,
      receivedAt,
    },
  };
};

const resolveDedupeSeed = (document?: string | null, normalizedPhone?: string | null, leadIdBase?: string) =>
  document || normalizedPhone || leadIdBase || 'unknown';

export const processAllocationTargets = async (
  {
    tenantId,
    instanceId,
    allocationTargets,
    leadIdBase,
    document,
    normalizedPhone,
    leadName,
    registrations,
    contact,
    message,
    metadata,
    timestamp,
    requestId,
    now,
    dedupeTtlMs,
  }: ProcessAllocationTargetsArgs,
  dependencies: ProcessAllocationDependencies
): Promise<void> => {
  const {
    shouldSkipByDedupe,
    registerDedupeKey,
    mapErrorForLog,
    isUniqueViolation,
    addAllocations = defaultDependencies.addAllocations,
    emitToTenant = defaultDependencies.emitToTenant,
    emitToAgreement = defaultDependencies.emitToAgreement,
    logger = defaultDependencies.logger,
    maskPhone = defaultDependencies.maskPhone,
  } = dependencies;

  for (const { campaign, target } of allocationTargets) {
    const campaignId = campaign?.id ?? null;
    const agreementId = campaign?.agreementId || 'unknown';
    const dedupeSeed = resolveDedupeSeed(document, normalizedPhone, leadIdBase);
    const allocationDedupeKey = campaignId
      ? `${tenantId}:${campaignId}:${dedupeSeed}`
      : `${tenantId}:${instanceId}:${dedupeSeed}`;

    if (campaignId && (await shouldSkipByDedupe(allocationDedupeKey, now))) {
      logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
        requestId,
        tenantId,
        campaignId,
        instanceId,
        messageId: message.id ?? null,
        phone: maskPhone(normalizedPhone ?? null),
        dedupeKey: allocationDedupeKey,
      });
      continue;
    }

    const brokerLead = buildBrokerLead({
      leadIdBase,
      campaignId,
      leadName,
      document,
      registrations,
      agreementId,
      normalizedPhone,
      contact,
      message,
      metadata,
      timestamp,
      now,
      instanceId,
    });

    try {
      const { newlyAllocated, summary } = await addAllocations(tenantId, target, [brokerLead]);
      await registerDedupeKey(allocationDedupeKey, now, dedupeTtlMs);

      if (newlyAllocated.length > 0) {
        const allocation = newlyAllocated[0];
        logger.info('🎯 LeadEngine • WhatsApp :: 🎯 Lead inbound alocado com sucesso', {
          tenantId,
          campaignId: allocation.campaignId ?? campaignId,
          instanceId,
          allocationId: allocation.allocationId,
          phone: maskPhone(normalizedPhone ?? null),
          leadId: allocation.leadId,
        });

        const realtimePayload = {
          tenantId,
          campaignId: allocation.campaignId ?? null,
          agreementId: allocation.agreementId ?? null,
          instanceId: allocation.instanceId,
          allocation,
          summary,
        };

        emitToTenant(tenantId, 'leadAllocations.new', realtimePayload);
        if (allocation.agreementId && allocation.agreementId !== 'unknown') {
          emitToAgreement(allocation.agreementId, 'leadAllocations.new', realtimePayload);
        }
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        logger.debug('🎯 LeadEngine • WhatsApp :: ⛔ Lead inbound já alocado recentemente — ignorando duplicidade', {
          tenantId,
          campaignId: campaignId ?? undefined,
          instanceId,
          phone: maskPhone(normalizedPhone ?? null),
        });
        await registerDedupeKey(allocationDedupeKey, now, dedupeTtlMs);
        continue;
      }

      logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
        error: mapErrorForLog(error),
        tenantId,
        campaignId: campaignId ?? undefined,
        instanceId,
        phone: maskPhone(normalizedPhone ?? null),
      });
    }
  }
};
