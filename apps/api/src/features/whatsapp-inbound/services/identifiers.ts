import { Prisma } from '@prisma/client';

export const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

export const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const readNestedString = (source: Record<string, unknown>, path: string[]): string | null => {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readString(current);
};

export const sanitizePhone = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return undefined;
  }
  return `+${digits.replace(/^\+/, '')}`;
};

export const sanitizeDocument = (
  value?: string | null,
  fallbacks: Array<string | null | undefined> = []
): string => {
  const candidateDigits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (candidateDigits.length >= 4) {
    return candidateDigits;
  }

  for (const fallback of fallbacks) {
    if (typeof fallback !== 'string') {
      continue;
    }

    const digits = fallback.replace(/\D/g, '');
    if (digits.length >= 4) {
      return digits;
    }
  }

  for (const fallback of fallbacks) {
    if (typeof fallback !== 'string') {
      continue;
    }

    const trimmed = fallback.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return '';
};

export const pickPreferredName = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const composeDeterministicId = (
  parts: Array<string | null | undefined>,
  { minParts = 1 }: { minParts?: number } = {}
): string | null => {
  const normalizedParts: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (typeof part !== 'string') {
      continue;
    }

    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    normalizedParts.push(trimmed);
    seen.add(trimmed);
  }

  if (normalizedParts.length < minParts) {
    return null;
  }

  return normalizedParts.join(':');
};

export const resolveDeterministicContactIdentifier = ({
  instanceId,
  metadataRecord,
  metadataContact,
  sessionId,
  externalId,
}: {
  instanceId?: string | null;
  metadataRecord: Record<string, unknown>;
  metadataContact: Record<string, unknown>;
  sessionId?: string | null;
  externalId?: string | null;
}): { deterministicId: string | null; contactId: string | null; sessionId: string | null } => {
  const instanceIdentifier = typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;

  const contactIdentifiers: string[] = [];
  const sessionIdentifiers: string[] = [];

  const pushCandidate = (collection: string[], value: unknown) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed || collection.includes(trimmed)) {
      return;
    }

    collection.push(trimmed);
  };

  pushCandidate(contactIdentifiers, (metadataContact as Record<string, unknown>)['id']);
  pushCandidate(contactIdentifiers, (metadataContact as Record<string, unknown>)['contactId']);
  pushCandidate(contactIdentifiers, (metadataContact as Record<string, unknown>)['contact_id']);
  pushCandidate(contactIdentifiers, metadataRecord['contactId']);
  pushCandidate(contactIdentifiers, metadataRecord['contact_id']);
  pushCandidate(contactIdentifiers, metadataRecord['customerId']);
  pushCandidate(contactIdentifiers, metadataRecord['customer_id']);
  pushCandidate(contactIdentifiers, metadataRecord['profileId']);
  pushCandidate(contactIdentifiers, metadataRecord['profile_id']);
  pushCandidate(contactIdentifiers, metadataRecord['contactIdentifier']);
  pushCandidate(contactIdentifiers, metadataRecord['contact_identifier']);
  pushCandidate(contactIdentifiers, metadataRecord['id']);

  pushCandidate(sessionIdentifiers, metadataRecord['sessionId']);
  pushCandidate(sessionIdentifiers, metadataRecord['session_id']);
  pushCandidate(sessionIdentifiers, metadataRecord['threadId']);
  pushCandidate(sessionIdentifiers, metadataRecord['thread_id']);
  pushCandidate(sessionIdentifiers, metadataRecord['conversationId']);
  pushCandidate(sessionIdentifiers, metadataRecord['conversation_id']);
  pushCandidate(sessionIdentifiers, metadataRecord['roomId']);
  pushCandidate(sessionIdentifiers, metadataRecord['room_id']);
  pushCandidate(sessionIdentifiers, metadataRecord['chatId']);
  pushCandidate(sessionIdentifiers, metadataRecord['chat_id']);
  pushCandidate(sessionIdentifiers, sessionId);

  const normalizedExternalId = typeof externalId === 'string' && externalId.trim().length > 0 ? externalId.trim() : null;

  const primaryContactId = contactIdentifiers[0] ?? null;
  const primarySessionId = sessionIdentifiers[0] ?? null;

  let deterministicId: string | null = null;

  if (primaryContactId) {
    deterministicId =
      composeDeterministicId([instanceIdentifier, primaryContactId], {
        minParts: instanceIdentifier ? 2 : 1,
      }) ?? primaryContactId;
  } else if (primarySessionId) {
    deterministicId =
      composeDeterministicId([instanceIdentifier, primarySessionId], {
        minParts: instanceIdentifier ? 2 : 1,
      }) ??
      (sessionIdentifiers.length > 1
        ? composeDeterministicId(sessionIdentifiers, { minParts: 2 })
        : primarySessionId);
  } else if (instanceIdentifier && normalizedExternalId) {
    deterministicId = composeDeterministicId([instanceIdentifier, normalizedExternalId], { minParts: 2 });
  }

  return {
    deterministicId,
    contactId: primaryContactId,
    sessionId: primarySessionId,
  };
};

export const resolveTicketAgreementId = (ticket: unknown): string | null => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const ticketRecord = ticket as Record<string, unknown> & {
    metadata?: Prisma.JsonValue | null;
  };

  const directAgreement = readString(ticketRecord['agreementId']);
  if (directAgreement) {
    return directAgreement;
  }

  const metadataRecord = toRecord(ticketRecord.metadata);
  return (
    readString(metadataRecord.agreementId) ??
    readString(metadataRecord.agreement_id) ??
    readNestedString(metadataRecord, ['agreement', 'id']) ??
    readNestedString(metadataRecord, ['agreement', 'agreementId']) ??
    null
  );
};
