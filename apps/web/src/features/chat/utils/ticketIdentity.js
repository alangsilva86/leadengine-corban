import { formatPhoneNumber } from '@/lib/utils.js';

const toRecord = (value) => (value && typeof value === 'object' ? value : {});

const normalizeCandidate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

const pickString = (...candidates) => {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCandidate(candidate);
    if (typeof normalizedCandidate !== 'string') continue;
    const trimmed = normalizedCandidate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

const PLACEHOLDER_NAME_PATTERNS = [/^contato (do |via )?whatsapp$/i];

const looksLikeWhatsAppJid = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('@s.whatsapp.net') ||
    normalized.includes('@g.us') ||
    normalized.includes('@broadcast') ||
    normalized.includes('@whatsapp.net') ||
    normalized.includes('@c.us')
  );
};

const isPlaceholderContactLabel = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const isMeaningfulDisplayName = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length === 1) return false;
  if (isPlaceholderContactLabel(trimmed)) return false;
  if (looksLikeWhatsAppJid(trimmed)) return false;

  const lettersOnly = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (lettersOnly.length > 0) {
    return true;
  }

  const compact = trimmed.replace(/[\s\-()[\]{}_+]/g, '');
  if (!compact) {
    return false;
  }

  const digitsOnly = compact.replace(/\D/g, '');
  if (digitsOnly.length >= Math.max(5, compact.length)) {
    return false;
  }

  return true;
};

const sanitizePhone = (value) => {
  const normalizedValue = normalizeCandidate(value);
  if (typeof normalizedValue !== 'string') return null;
  const trimmed = normalizedValue.trim();
  if (!trimmed) return null;
  const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const hasPlus = withoutDomain.trim().startsWith('+');
  const digits = withoutDomain.replace(/\D/g, '');
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
};

export const getTicketIdentity = (ticket) => {
  const metadata = toRecord(ticket?.metadata);
  const contact = toRecord(ticket?.contact);
  const contactMeta = toRecord(contact.metadata);
  const metadataContact = toRecord(metadata.contact);
  const whatsappMeta = toRecord(metadata.whatsapp);
  const metadataLead = toRecord(metadata.lead);
  const timelineMeta = toRecord(ticket?.timeline);

  const remoteJidCandidate =
    pickString(
      metadataContact.remoteJid,
      whatsappMeta.remoteJid,
      metadata.remoteJid,
      timelineMeta.remoteJid,
    ) || null;

  const phoneCandidate = pickString(
    contact.phone,
    contact.primaryPhone,
    contactMeta.phone,
    metadata.contactPhone,
    metadataContact.phone,
    metadataContact.msisdn,
    metadataContact.address,
    whatsappMeta.phone,
    whatsappMeta.msisdn,
    metadataLead.phone,
    remoteJidCandidate,
  );

  const sanitizedPhone = sanitizePhone(phoneCandidate);
  const displayPhone = sanitizedPhone ? formatPhoneNumber(sanitizedPhone) : null;

  const remoteIdentifier =
    remoteJidCandidate && remoteJidCandidate.includes('@')
      ? remoteJidCandidate.split('@')[0]
      : remoteJidCandidate;

  const nameCandidates = [
    metadataContact.pushName,
    whatsappMeta.pushName,
    whatsappMeta.profileName,
    contact.displayName,
    contact.fullName,
    contact.name,
    contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : null,
    contactMeta.name,
    contactMeta.displayName,
    metadataContact.name,
    metadataContact.fullName,
    metadataContact.displayName,
    metadata.contactName,
    metadata.leadName,
    metadataLead.name,
    metadataLead.fullName,
    ticket?.subject,
  ];

  const normalizedNameCandidates = nameCandidates
    .map(normalizeCandidate)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);

  const meaningfulName = normalizedNameCandidates.find(isMeaningfulDisplayName) ?? null;
  const secondaryName =
    meaningfulName ??
    normalizedNameCandidates.find(
      (candidate) => !looksLikeWhatsAppJid(candidate) && !isPlaceholderContactLabel(candidate)
    ) ??
    null;

  const fallbackName =
    secondaryName ??
    (sanitizedPhone ?? null) ??
    normalizedNameCandidates.find((candidate) => !looksLikeWhatsAppJid(candidate)) ??
    remoteIdentifier ??
    null;

  const displayName = fallbackName ?? 'Contato WhatsApp';

  return {
    displayName,
    rawPhone: sanitizedPhone,
    displayPhone,
    remoteJid: remoteIdentifier ?? null,
  };
};

export default getTicketIdentity;
