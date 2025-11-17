import { NotFoundError, PhoneNormalizationError } from '@ticketz/core';
import type { CreateTicketDTO, Message, SendMessageDTO, Ticket, TicketStatus } from '../../types/tickets';
import { prisma } from '../../lib/prisma';
import { findTicketsByContact, findTicketById as storageFindTicketById } from '@ticketz/storage';
import { normalizePhoneNumber } from '../../utils/phone';
import { getIdempotentValue, hashIdempotentPayload, rememberIdempotency } from '../../utils/idempotency';
import { assertWithinRateLimit } from '../../utils/rate-limit';
import { assertCircuitClosed, buildCircuitBreakerKey } from '../../utils/circuit-breaker';
import {
  whatsappOutboundMetrics,
  whatsappOutboundDeliverySuccessCounter,
} from '../../lib/metrics';
import type { WhatsAppTransport } from '../../features/whatsapp-transport';
import type { NormalizedMessagePayload, OutboundMessageError, OutboundMessageResponse } from '@ticketz/contracts';

type EmitMessageUpdatedEventsFn = (
  tenantId: string,
  ticketId: string,
  message: Message,
  userId?: string | null,
  ticket?: Ticket | null
) => Promise<void>;

type SendMessageFn = (
  tenantId: string,
  userId: string | undefined,
  input: SendMessageDTO,
  dependencies?: WhatsAppTransportDependencies
) => Promise<Message>;

type CreateTicketFn = (input: CreateTicketDTO) => Promise<Ticket>;

type ResolveWhatsAppInstanceIdFn = (ticket: Ticket | null | undefined) => string | null;

type WhatsAppSendModuleDeps = {
  sendMessage: SendMessageFn;
  resolveWhatsAppInstanceId: ResolveWhatsAppInstanceIdFn;
  createTicket: CreateTicketFn;
  openStatuses: ReadonlySet<TicketStatus | string>;
};

const normalizeNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const syncContactPrimaryPhone = async (
  tenantId: string,
  contactId: string,
  phone: string | null | undefined
): Promise<void> => {
  const normalized = normalizeNullableString(phone);

  await prisma.contactPhone.updateMany({
    where: { tenantId, contactId, isPrimary: true },
    data: { isPrimary: false },
  });

  if (!normalized) {
    return;
  }

  await prisma.contactPhone.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber: normalized,
      },
    },
    update: {
      contactId,
      isPrimary: true,
    },
    create: {
      tenantId,
      contactId,
      phoneNumber: normalized,
      type: 'MOBILE',
      label: 'Principal',
      isPrimary: true,
    },
  });
};

const OUTBOUND_TPS_DEFAULT = (() => {
  const raw = process.env.OUTBOUND_TPS_DEFAULT;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
})();

const OUTBOUND_TPS_OVERRIDES = (() => {
  const map = new Map<string, number>();
  const raw = process.env.OUTBOUND_TPS_BY_INSTANCE;
  if (!raw) {
    return map;
  }

  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      const [id, limitRaw] = entry.split(':').map((value) => value.trim());
      const parsed = Number.parseInt(limitRaw ?? '', 10);
      if (id && Number.isFinite(parsed) && parsed > 0) {
        map.set(id, parsed);
      }
    });

  return map;
})();

const IDEMPOTENCY_TTL_MS = (() => {
  const raw = process.env.OUTBOUND_IDEMPOTENCY_TTL_MS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24 * 60 * 60 * 1000;
})();

type WhatsAppInstanceForDispatch = {
  id: string;
  brokerId: string | null;
};

type DispatchInstanceResolution = {
  dispatchInstanceId: string | null;
  brokerId: string | null;
};

export const resolveDispatchInstanceId = async (
  instanceId: string | null | undefined,
  instance?: WhatsAppInstanceForDispatch | null
): Promise<DispatchInstanceResolution> => {
  if (!instanceId) {
    return { dispatchInstanceId: null, brokerId: null };
  }

  const record =
    instance ??
    (await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        brokerId: true,
      },
    }));

  if (!record) {
    throw new NotFoundError('WhatsAppInstance', instanceId);
  }

  return {
    dispatchInstanceId: record.brokerId ?? record.id,
    brokerId: record.brokerId,
  };
};

export const resolveInstanceRateLimit = (instanceId: string | null | undefined): number => {
  if (!instanceId) {
    return OUTBOUND_TPS_DEFAULT;
  }

  return OUTBOUND_TPS_OVERRIDES.get(instanceId) ?? OUTBOUND_TPS_DEFAULT;
};

export const rateKeyForInstance = (tenantId: string, instanceId: string): string =>
  `whatsapp:${tenantId}:${instanceId}`;

const defaultQueueCache = new Map<string, string>();

const resolveDefaultQueueId = async (tenantId: string): Promise<string> => {
  if (defaultQueueCache.has(tenantId)) {
    return defaultQueueCache.get(tenantId) as string;
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  if (!queue) {
    const fallbackName = 'Atendimento Geral';
    const fallbackQueue = await prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: fallbackName,
        },
      },
      update: {},
      create: {
        tenantId,
        name: fallbackName,
        description: 'Fila criada automaticamente para envios de WhatsApp.',
        color: '#3B82F6',
        orderIndex: 0,
      },
    });

    defaultQueueCache.set(tenantId, fallbackQueue.id);
    return fallbackQueue.id;
  }

  defaultQueueCache.set(tenantId, queue.id);
  return queue.id;
};

export const getDefaultQueueIdForTenant = async (tenantId: string): Promise<string> =>
  resolveDefaultQueueId(tenantId);

const toMessageType = (type: NormalizedMessagePayload['type']): Message['type'] => {
  switch (type) {
    case 'image':
      return 'IMAGE';
    case 'audio':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    case 'document':
      return 'DOCUMENT';
    case 'location':
      return 'LOCATION';
    case 'contact':
      return 'CONTACT';
    case 'template':
      return 'TEMPLATE';
    case 'poll':
      return 'TEXT';
    default:
      return 'TEXT';
  }
};

const buildOutboundResponse = (message: Message): OutboundMessageResponse => {
  const brokerMeta =
    message.metadata && typeof message.metadata === 'object'
      ? ((message.metadata as Record<string, unknown>).broker as Record<string, unknown> | undefined)
      : undefined;

  let error: OutboundMessageError | null = null;

  if (brokerMeta?.error && typeof brokerMeta.error === 'object') {
    const rawError = brokerMeta.error as Record<string, unknown>;
    const normalizedError: OutboundMessageError = {
      message: typeof rawError.message === 'string' ? rawError.message : 'unknown_error',
    };

    if (typeof rawError.code === 'string') {
      normalizedError.code = rawError.code;
    }

    if (typeof rawError.status === 'number') {
      normalizedError.status = rawError.status;
    }

    if (typeof rawError.requestId === 'string') {
      normalizedError.requestId = rawError.requestId;
    }

    error = normalizedError;
  } else if (typeof brokerMeta?.error === 'string' && brokerMeta.error.length > 0) {
    error = { message: brokerMeta.error };
  }

  return {
    queued: true,
    ticketId: message.ticketId,
    messageId: message.id,
    status: message.status,
    externalId: message.externalId ?? null,
    error,
  } satisfies OutboundMessageResponse;
};

type SendOnTicketParams = {
  tenantId?: string;
  operatorId?: string;
  ticketId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

type SendToContactParams = {
  tenantId?: string;
  operatorId?: string;
  contactId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  to?: string;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

type SendAdHocParams = {
  operatorId?: string;
  instanceId: string;
  tenantId?: string;
  to: string;
  payload: NormalizedMessagePayload;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

export type WhatsAppTransportDependencies = {
  transport?: WhatsAppTransport;
  emitMessageUpdatedEvents?: EmitMessageUpdatedEventsFn;
};

export const createWhatsAppSendModule = (deps: WhatsAppSendModuleDeps) => {
  const sendOnTicket = async (
    {
      tenantId,
      operatorId,
      ticketId,
      payload,
      instanceId,
      idempotencyKey,
      rateLimitConsumed = false,
    }: SendOnTicketParams,
    dependencies: WhatsAppTransportDependencies = {}
  ): Promise<OutboundMessageResponse> => {
    let resolvedTenantId = tenantId ?? null;
    let ticket: Ticket | null = null;

    if (resolvedTenantId) {
      ticket = await storageFindTicketById(resolvedTenantId, ticketId);
    } else {
      const ticketRecord = await prisma.ticket.findUnique({ where: { id: ticketId } });

      if (!ticketRecord) {
        throw new NotFoundError('Ticket', ticketId);
      }

      resolvedTenantId = ticketRecord.tenantId;
      ticket = await storageFindTicketById(resolvedTenantId, ticketId);
    }

    if (!ticket) {
      throw new NotFoundError('Ticket', ticketId);
    }

    const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });

    if (!contact) {
      throw new NotFoundError('Contact', ticket.contactId);
    }

    const phone = (contact.primaryPhone ?? '').trim();

    if (!phone) {
      throw new PhoneNormalizationError('Contato não possui telefone cadastrado.');
    }

    const targetInstanceId = instanceId ?? deps.resolveWhatsAppInstanceId(ticket);

    if (!targetInstanceId) {
      throw new Error('WHATSAPP_INSTANCE_REQUIRED');
    }

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: targetInstanceId } });

    if (!instance) {
      throw new NotFoundError('WhatsAppInstance', targetInstanceId);
    }

    if (!resolvedTenantId) {
      throw new NotFoundError('Ticket', ticketId);
    }

    const tenantForOperations = resolvedTenantId;
    let payloadHash: string | null = null;
    if (idempotencyKey) {
      payloadHash = hashIdempotentPayload({
        tenantId: tenantForOperations,
        ticketId,
        instanceId: targetInstanceId,
        payload,
      });

      const cached = getIdempotentValue<OutboundMessageResponse>(tenantForOperations, idempotencyKey);
      if (cached && cached.payloadHash === payloadHash) {
        return cached.value;
      }
    }

    const circuitKey = buildCircuitBreakerKey(tenantForOperations, targetInstanceId);
    assertCircuitClosed(circuitKey);

    if (!rateLimitConsumed) {
      const rateLimit = resolveInstanceRateLimit(targetInstanceId);
      assertWithinRateLimit(rateKeyForInstance(tenantForOperations, targetInstanceId), rateLimit);
    }

    const metadata: Record<string, unknown> = {};
    if (typeof payload.previewUrl === 'boolean') {
      metadata.previewUrl = payload.previewUrl;
    }
    if (payload.location) {
      metadata.location = payload.location;
    }
    if (payload.contact) {
      metadata.contact = payload.contact;
    }
    if (payload.template) {
      metadata.template = payload.template;
    }
    if (payload.poll) {
      metadata.poll = payload.poll;
    }
    if (idempotencyKey) {
      metadata.idempotencyKey = idempotencyKey;
    }

    const messageInput: SendMessageDTO = {
      ticketId,
      type: toMessageType(payload.type),
      instanceId: targetInstanceId,
      direction: 'OUTBOUND',
      content: payload.content,
      caption: payload.caption,
      mediaUrl: payload.mediaUrl,
      mediaFileName: payload.mediaFileName,
      mediaMimeType: payload.mediaMimeType,
      metadata,
      idempotencyKey,
    };

    const startedAt = Date.now();
    const message = await deps.sendMessage(tenantForOperations, operatorId, messageInput, dependencies);
    const latencyMs = Date.now() - startedAt;
    const metricsInstanceId = (message.instanceId ?? targetInstanceId) ?? 'unknown';
    const outboundMetricBase = {
      origin: 'ticket-service',
      tenantId: tenantForOperations,
      instanceId: metricsInstanceId,
    } as const;

    whatsappOutboundMetrics.incTotal({
      ...outboundMetricBase,
      status: message.status,
    });
    whatsappOutboundMetrics.observeLatency(outboundMetricBase, latencyMs);

    if (message.status === 'DELIVERED' || message.status === 'READ') {
      const normalizedType =
        typeof message.type === 'string' && message.type.trim().length > 0
          ? message.type.trim().toLowerCase()
          : 'unknown';
      whatsappOutboundDeliverySuccessCounter.inc({
        ...outboundMetricBase,
        status: message.status,
        messageType: normalizedType,
      });
    }

    const response = buildOutboundResponse(message);

    if (idempotencyKey && payloadHash) {
      rememberIdempotency(tenantForOperations, idempotencyKey, payloadHash, response, IDEMPOTENCY_TTL_MS);
    }

    return response;
  };

  const sendToContact = async (
    {
      tenantId,
      operatorId,
      contactId,
      payload,
      instanceId,
      to,
      idempotencyKey,
      rateLimitConsumed = false,
    }: SendToContactParams,
    dependencies: WhatsAppTransportDependencies = {}
  ): Promise<OutboundMessageResponse> => {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });

    if (!contact) {
      throw new NotFoundError('Contact', contactId);
    }

    const resolvedTenantId = tenantId ?? contact.tenantId;

    if (!resolvedTenantId) {
      throw new NotFoundError('Contact', contactId);
    }

    if (instanceId) {
      await resolveDispatchInstanceId(instanceId);
    }

    let normalizedPhone = contact.primaryPhone?.trim() ?? null;

    if (to) {
      const normalized = normalizePhoneNumber(to);
      normalizedPhone = normalized.e164;

      if ((contact.primaryPhone ?? null) !== normalizedPhone) {
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            primaryPhone: normalizedPhone,
            lastInteractionAt: new Date(),
          },
        });
        await syncContactPrimaryPhone(resolvedTenantId, contactId, normalizedPhone);
      }
    }

    if (!normalizedPhone) {
      throw new PhoneNormalizationError('Contato sem telefone válido para envio.');
    }

    const existingTickets = await findTicketsByContact(resolvedTenantId, contactId);
    let activeTicket = existingTickets.find((ticketRecord) => deps.openStatuses.has(ticketRecord.status));

    if (!activeTicket) {
      const queueId = await resolveDefaultQueueId(resolvedTenantId);
      activeTicket = await deps.createTicket({
        tenantId: resolvedTenantId,
        contactId,
        queueId,
        channel: 'WHATSAPP',
        metadata: {
          whatsappInstanceId: instanceId ?? null,
          phone: normalizedPhone,
        },
      });
    }

    const sendParams: SendOnTicketParams = {
      tenantId: resolvedTenantId,
      ticketId: activeTicket.id,
      payload,
      rateLimitConsumed,
    };

    if (instanceId) {
      sendParams.instanceId = instanceId;
    }

    if (idempotencyKey) {
      sendParams.idempotencyKey = idempotencyKey;
    }

    if (operatorId) {
      sendParams.operatorId = operatorId;
    }

    return sendOnTicket(sendParams, dependencies);
  };

  const sendAdHoc = async (
    {
      operatorId,
      instanceId,
      tenantId: callerTenantId,
      to,
      payload,
      idempotencyKey,
      rateLimitConsumed = false,
    }: SendAdHocParams,
    dependencies: WhatsAppTransportDependencies = {}
  ): Promise<OutboundMessageResponse> => {
    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance) {
      throw new NotFoundError('WhatsAppInstance', instanceId);
    }

    if (callerTenantId && callerTenantId !== instance.tenantId) {
      throw new NotFoundError('WhatsAppInstance', instanceId);
    }

    await resolveDispatchInstanceId(instanceId, instance);

    const tenantId = instance.tenantId;

    const normalized = normalizePhoneNumber(to);

    let contact = await prisma.contact.findUnique({
      where: {
        tenantId_primaryPhone: {
          tenantId,
          primaryPhone: normalized.e164,
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          fullName: normalized.e164,
          displayName: normalized.e164,
          primaryPhone: normalized.e164,
          lastInteractionAt: new Date(),
        },
      });
      await syncContactPrimaryPhone(tenantId, contact.id, normalized.e164);
    } else {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastInteractionAt: new Date(),
          primaryPhone: normalized.e164,
        },
      });
      await syncContactPrimaryPhone(tenantId, contact.id, normalized.e164);
    }

    const sendParams: SendToContactParams = {
      tenantId,
      contactId: contact.id,
      payload,
      to: normalized.e164,
      rateLimitConsumed,
    };

    if (instanceId) {
      sendParams.instanceId = instanceId;
    }

    if (idempotencyKey) {
      sendParams.idempotencyKey = idempotencyKey;
    }

    if (operatorId) {
      sendParams.operatorId = operatorId;
    }

    return sendToContact(sendParams, dependencies);
  };

  return {
    sendOnTicket,
    sendToContact,
    sendAdHoc,
  };
};
