import type { Message, Ticket } from '../../types/tickets';

export const resolveWhatsAppInstanceId = (ticket: Ticket | null | undefined): string | null => {
  if (!ticket || !ticket.metadata || typeof ticket.metadata !== 'object') {
    return null;
  }

  const metadata = ticket.metadata as Record<string, unknown>;
  const directCandidates = [metadata['whatsappInstanceId'], metadata['instanceId']];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const whatsappRecord = metadata['whatsapp'];
  if (whatsappRecord && typeof whatsappRecord === 'object') {
    const instanceId = (whatsappRecord as Record<string, unknown>)['instanceId'];
    if (typeof instanceId === 'string' && instanceId.trim().length > 0) {
      return instanceId.trim();
    }
  }

  return null;
};

export const normalizeBrokerStatus = (status: string | undefined): Message['status'] => {
  const normalized = (status || '').trim().toUpperCase();
  switch (normalized) {
    case 'DELIVERED':
      return 'DELIVERED';
    case 'READ':
    case 'SEEN':
      return 'READ';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'SENT';
  }
};

const readCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveProviderMessageId = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const broker = metadataRecord.broker as Record<string, unknown> | undefined;
  const candidates: (string | null | undefined)[] = [
    readCandidate(metadataRecord.providerMessageId),
    readCandidate(metadataRecord.providerId),
    readCandidate(metadataRecord.externalId),
    readCandidate(metadataRecord.messageId),
  ];

  if (broker && typeof broker === 'object') {
    candidates.push(
      readCandidate(broker.providerMessageId),
      readCandidate(broker.messageId),
      readCandidate(broker.wamid),
      readCandidate(broker.id)
    );
  }

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

export const normalizeMessageMetadata = (
  metadata: Record<string, unknown> | null | undefined,
  providerMessageId: string | null
): Record<string, unknown> => {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};

  if (!providerMessageId) {
    return base;
  }

  if (!readCandidate(base.providerMessageId)) {
    base.providerMessageId = providerMessageId;
  }

  const brokerSource =
    base.broker && typeof base.broker === 'object' && !Array.isArray(base.broker)
      ? (base.broker as Record<string, unknown>)
      : {};

  const broker = { ...brokerSource };

  if (!readCandidate(broker.providerMessageId)) {
    broker.providerMessageId = providerMessageId;
  }
  if (!readCandidate(broker.messageId)) {
    broker.messageId = providerMessageId;
  }
  if (!readCandidate(broker.id)) {
    broker.id = providerMessageId;
  }
  if (!readCandidate(broker.wamid)) {
    broker.wamid = providerMessageId;
  }

  base.broker = broker;
  return base;
};
