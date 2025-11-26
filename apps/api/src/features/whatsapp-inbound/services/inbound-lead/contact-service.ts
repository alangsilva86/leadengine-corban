import type { Prisma } from '@prisma/client';

import { prisma } from '../../../../lib/prisma';
import { pickPreferredName, readString } from '../identifiers';

const CONTACT_RELATIONS_INCLUDE = {
  tags: { include: { tag: true } },
  phones: true,
} satisfies Prisma.ContactInclude;

type PrismaContactWithRelations = Prisma.ContactGetPayload<{
  include: typeof CONTACT_RELATIONS_INCLUDE;
}>;

const normalizeTagNames = (values: string[] | undefined): string[] => {
  if (!values?.length) return [];
  const unique = new Set<string>();
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0) unique.add(trimmed);
  }
  return Array.from(unique);
};

const extractTagNames = (contact: PrismaContactWithRelations | null): string[] => {
  if (!contact?.tags?.length) return [];
  return contact.tags
    .map((assignment: Prisma.ContactTagGetPayload<{ include: { tag: true } }>) => assignment.tag?.name ?? null)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
};

const ensureTagsExist = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  tagNames: string[]
): Promise<Map<string, string>> => {
  if (!tagNames.length) return new Map();
  const existing = await tx.tag.findMany({ where: { tenantId, name: { in: tagNames } } });
  const tags = new Map<string, string>(existing.map((tag) => [tag.name, tag.id]));
  const missing = tagNames.filter((name) => !tags.has(name));
  if (missing.length > 0) {
    const created = await Promise.all(
      missing.map((name) => tx.tag.create({ data: { tenantId, name }, select: { id: true, name: true } }))
    );
    for (const tag of created) tags.set(tag.name, tag.id);
  }
  return tags;
};

const syncContactTags = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  contactId: string,
  tags: string[]
) => {
  const normalized = normalizeTagNames(tags);
  if (!normalized.length) {
    await tx.contactTag.deleteMany({ where: { tenantId, contactId } });
    return;
  }

  const tagsByName = await ensureTagsExist(tx, tenantId, normalized);
  const tagIds = normalized
    .map((name) => tagsByName.get(name))
    .filter((id): id is string => typeof id === 'string');

  await tx.contactTag.deleteMany({ where: { tenantId, contactId, tagId: { notIn: tagIds } } });
  await Promise.all(
    tagIds.map((tagId) =>
      tx.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId } },
        update: {},
        create: { tenantId, contactId, tagId },
      })
    )
  );
};

const upsertPrimaryPhone = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  contactId: string,
  phone: string | null | undefined
) => {
  if (!phone) return;
  const trimmed = phone.trim();
  if (!trimmed) return;

  await tx.contactPhone.upsert({
    where: { tenantId_phoneNumber: { tenantId, phoneNumber: trimmed } },
    update: { contactId, isPrimary: true, updatedAt: new Date() },
    create: { tenantId, contactId, phoneNumber: trimmed, isPrimary: true },
  });

  await tx.contactPhone.updateMany({
    where: { tenantId, contactId, phoneNumber: { not: trimmed }, isPrimary: true },
    data: { isPrimary: false },
  });
};

const findContactByPhoneOrDocument = async (
  tenantId: string,
  phone?: string | null,
  document?: string | null
): Promise<PrismaContactWithRelations | null> => {
  const conditions: Prisma.ContactWhereInput[] = [];
  if (phone?.trim()) {
    conditions.push({ primaryPhone: phone.trim() });
    conditions.push({ phones: { some: { phoneNumber: phone.trim() } } });
  }
  if (document?.trim()) {
    conditions.push({ document: document.trim() });
  }
  if (!conditions.length) return null;

  return prisma.contact.findFirst({
    where: { tenantId, OR: conditions },
    include: CONTACT_RELATIONS_INCLUDE,
  });
};

export type EnsureContactInput = {
  phone?: string | null | undefined;
  name?: string | null | undefined;
  document?: string | null | undefined;
  registrations?: string[] | null | undefined;
  timestamp?: string | null | undefined;
  avatar?: string | null | undefined;
};

export const ensureContact = async (
  tenantId: string,
  input: EnsureContactInput
): Promise<PrismaContactWithRelations> => {
  const { phone, name, document, registrations, timestamp, avatar } = input;
  const interactionDate = timestamp ? new Date(timestamp) : new Date();
  const interactionTimestamp = interactionDate.getTime();
  const interactionIso = interactionDate.toISOString();

  const existing = await findContactByPhoneOrDocument(tenantId, phone ?? null, document ?? null);
  const existingTags = extractTagNames(existing);
  const tags = normalizeTagNames([...existingTags, 'whatsapp', 'inbound']);

  const customFieldsSource =
    existing?.customFields && typeof existing.customFields === 'object'
      ? (existing.customFields as Record<string, unknown>)
      : {};

  const customFields: Record<string, unknown> = {
    ...customFieldsSource,
    source: 'whatsapp',
    lastInboundChannel: 'whatsapp',
  };

  if (registrations && registrations.length > 0) {
    customFields.registrations = registrations;
  } else if (!('registrations' in customFields)) {
    customFields.registrations = [];
  }

  if (!('consent' in customFields)) {
    customFields.consent = { granted: true, base: 'legitimate_interest', grantedAt: interactionIso };
  }

  const parseTimestamp = (value: unknown): number | null => {
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  };

  const currentFirst = parseTimestamp(customFields['firstInboundAt']);
  if (currentFirst === null || interactionTimestamp < currentFirst) {
    customFields['firstInboundAt'] = interactionIso;
  }

  const currentLast = parseTimestamp(customFields['lastInboundAt']);
  if (currentLast === null || interactionTimestamp >= currentLast) {
    customFields['lastInboundAt'] = interactionIso;
  }

  const derivedName =
    pickPreferredName(
      name,
      readString(existing?.fullName),
      readString(existing?.displayName),
      phone,
      'Contato WhatsApp'
    ) ?? 'Contato WhatsApp';

  const normalizedPhone = phone?.trim() ?? existing?.primaryPhone ?? null;

  const contactData: Prisma.ContactUpdateInput = {
    fullName: derivedName,
    displayName: derivedName,
    ...(normalizedPhone ? { primaryPhone: normalizedPhone } : {}),
    ...(document ? { document } : {}),
    ...(avatar ? { avatar } : {}),
    customFields: customFields as Prisma.InputJsonValue,
    lastInteractionAt: interactionDate,
    lastActivityAt: interactionDate,
  };

  const persisted = await prisma.$transaction(async (tx) => {
    const target: PrismaContactWithRelations =
      existing !== null
        ? await tx.contact.update({
            where: { id: existing.id },
            data: contactData,
            include: CONTACT_RELATIONS_INCLUDE,
          })
        : await tx.contact.create({
            data: {
              tenantId,
              fullName: derivedName,
              displayName: derivedName,
              ...(normalizedPhone ? { primaryPhone: normalizedPhone } : {}),
              ...(document ? { document } : {}),
              ...(avatar ? { avatar } : {}),
              customFields: customFields as Prisma.InputJsonValue,
              lastInteractionAt: interactionDate,
              lastActivityAt: interactionDate,
            },
            include: CONTACT_RELATIONS_INCLUDE,
          });

    await upsertPrimaryPhone(tx, tenantId, target.id, normalizedPhone ?? undefined);
    await syncContactTags(tx, tenantId, target.id, tags);

    return target;
  });

  return persisted;
};
