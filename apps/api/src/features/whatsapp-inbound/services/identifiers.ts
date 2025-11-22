import { randomUUID } from 'node:crypto';

import { sanitizePhone } from '@ticketz/shared';

export { sanitizePhone };

export const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const readNestedString = (
  source: Record<string, unknown>,
  path: string[]
): string | null => {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readString(current);
};

export const composeDeterministicId = (
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

  return `wa-${randomUUID()}`;
};

export const uniqueStringList = (values?: string[] | null): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
};

export const pickPreferredName = (
  ...values: Array<unknown>
): string | null => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

const pushUnique = (collection: string[], candidate: string | null): void => {
  if (!candidate) {
    return;
  }

  if (!collection.includes(candidate)) {
    collection.push(candidate);
  }
};

export const resolveTenantIdentifiersFromMetadata = (
  metadata: Record<string, unknown>
): string[] => {
  const identifiers: string[] = [];

  const directKeys = ['tenantId', 'tenant_id', 'tenantSlug', 'tenant'];
  directKeys.forEach((key) => pushUnique(identifiers, readString(metadata[key])));

  const nestedPaths: string[][] = [
    ['tenant', 'id'],
    ['tenant', 'tenantId'],
    ['tenant', 'slug'],
    ['tenant', 'code'],
    ['tenant', 'slugId'],
    ['context', 'tenantId'],
    ['context', 'tenant', 'id'],
    ['context', 'tenant', 'slug'],
    ['context', 'tenant', 'tenantId'],
    ['context', 'tenantSlug'],
    ['broker', 'tenantId'],
    ['integration', 'tenantId'],
    ['integration', 'tenant', 'id'],
    ['integration', 'tenant', 'slug'],
    ['integration', 'tenant', 'tenantId'],
    ['session', 'tenantId'],
  ];

  nestedPaths.forEach((path) => pushUnique(identifiers, readNestedString(metadata, path)));

  return identifiers;
};

export const resolveSessionIdFromMetadata = (
  metadata: Record<string, unknown>
): string | null => {
  const candidates: Array<string | null> = [
    readString(metadata['sessionId']),
    readString(metadata['session_id']),
    readNestedString(metadata, ['session', 'id']),
    readNestedString(metadata, ['session', 'sessionId']),
    readNestedString(metadata, ['connection', 'sessionId']),
    readNestedString(metadata, ['broker', 'sessionId']),
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? null;
};

export const resolveBrokerIdFromMetadata = (
  metadata: Record<string, unknown>
): string | null => {
  const candidates: Array<string | null> = [
    readString(metadata['brokerId']),
    readString(metadata['broker_id']),
    readNestedString(metadata, ['broker', 'id']),
    readNestedString(metadata, ['broker', 'sessionId']),
    readString(metadata['instanceId']),
    readString(metadata['instance_id']),
    readNestedString(metadata, ['broker', 'instanceId']),
    readNestedString(metadata, ['instance', 'id']),
    readNestedString(metadata, ['instance', 'instanceId']),
    resolveSessionIdFromMetadata(metadata),
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? null;
};

export const resolveInstanceDisplayNameFromMetadata = (
  metadata: Record<string, unknown>,
  tenantName: string | null | undefined,
  instanceId: string
): string => {
  const candidates: Array<string | null> = [
    readString(metadata['instanceName']),
    readString(metadata['instanceFriendlyName']),
    readString(metadata['instanceDisplayName']),
    readNestedString(metadata, ['instance', 'name']),
    readNestedString(metadata, ['instance', 'displayName']),
    readNestedString(metadata, ['instance', 'friendlyName']),
    readNestedString(metadata, ['connection', 'name']),
    readNestedString(metadata, ['session', 'name']),
    readString(metadata['connectionName']),
    tenantName ? `WhatsApp • ${tenantName}` : null,
    `WhatsApp • ${instanceId}`,
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? `WhatsApp • ${instanceId}`;
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
  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;

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

  const normalizedExternalId =
    typeof externalId === 'string' && externalId.trim().length > 0 ? externalId.trim() : null;

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
