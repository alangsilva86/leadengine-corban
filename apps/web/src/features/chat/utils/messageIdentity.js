const isRecord = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

export const resolveProviderMessageId = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const topLevelCandidate =
    typeof entry.providerMessageId === 'string' && entry.providerMessageId.trim().length > 0
      ? entry.providerMessageId.trim()
      : null;
  if (topLevelCandidate) {
    return topLevelCandidate;
  }

  const metadata = isRecord(entry.metadata);
  if (!metadata) {
    return null;
  }

  const broker = isRecord(metadata.broker);
  if (!broker) {
    return null;
  }

  const candidate = [broker.messageId, broker.id, broker.wamid].find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );

  return candidate ? candidate.trim() : null;
};

export const resolveMessageKey = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const providerId = resolveProviderMessageId(entry);
  if (providerId) {
    return providerId;
  }

  const storageId = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id.trim() : null;
  if (storageId) {
    return storageId;
  }

  const externalId = typeof entry.externalId === 'string' && entry.externalId.trim().length > 0 ? entry.externalId.trim() : null;
  if (externalId) {
    return externalId;
  }

  return null;
};

export default resolveMessageKey;
