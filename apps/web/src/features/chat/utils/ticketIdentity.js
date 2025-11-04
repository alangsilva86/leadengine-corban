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

  const nameCandidate = pickString(
    contact.name,
    contact.fullName,
    contact.displayName,
    contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : null,
    contactMeta.name,
    metadataContact.name,
    metadataContact.fullName,
    metadataContact.displayName,
    metadataContact.pushName,
    whatsappMeta.pushName,
    whatsappMeta.profileName,
    metadata.contactName,
    metadata.leadName,
    metadataLead.name,
    metadataLead.fullName,
    ticket?.subject,
    sanitizedPhone,
    remoteIdentifier,
  );

  const displayName = nameCandidate ?? 'Contato WhatsApp';

  return {
    displayName,
    rawPhone: sanitizedPhone,
    displayPhone,
    remoteJid: remoteIdentifier ?? null,
  };
};

export default getTicketIdentity;
