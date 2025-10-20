import {
  Prisma,
  type ContactInteraction as PrismaContactInteraction,
  type ContactTask as PrismaContactTask,
  type Tag as PrismaTag,
  $Enums,
} from '@prisma/client';

import {
  BulkContactsAction,
  Contact,
  ContactDetails,
  ContactFilters,
  ContactInteraction,
  ContactInteractionChannel,
  ContactInteractionDirection,
  ContactListItem,
  ContactStatus,
  ContactTagAggregation,
  ContactTask,
  ContactTaskStatus,
  ContactsPaginatedResult,
  CreateContactDTO,
  CreateContactInteractionDTO,
  CreateContactTaskDTO,
  ListContactInteractionsQuery,
  ListContactTasksQuery,
  MergeContactsDTO,
  UpdateContactDTO,
  UpdateContactTaskDTO,
} from '@ticketz/core';

import { getPrismaClient } from '../prisma-client';

const OPEN_TICKET_STATUSES = [
  $Enums.TicketStatus.OPEN,
  $Enums.TicketStatus.PENDING,
  $Enums.TicketStatus.ASSIGNED,
];

const PENDING_TASK_STATUS = $Enums.ContactTaskStatus.PENDING;

const CONTACT_TAGS_INCLUDE = {
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ContactInclude;

const CONTACT_DETAILS_INCLUDE = {
  ...CONTACT_TAGS_INCLUDE,
  contactInteractions: { orderBy: { occurredAt: 'desc' }, take: 20 },
  contactTasks: { orderBy: { createdAt: 'desc' }, take: 20 },
  _count: {
    select: {
      tickets: { where: { status: { in: OPEN_TICKET_STATUSES } } },
    },
  },
} satisfies Prisma.ContactInclude;

type PrismaContactWithTags = Prisma.ContactGetPayload<{
  include: typeof CONTACT_TAGS_INCLUDE;
}>;

const normalizeTagNames = (tags: string[] | undefined): string[] => {
  if (!tags?.length) {
    return [];
  }

  const unique = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};

const ensureTagsExist = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  tagNames: string[]
): Promise<Map<string, PrismaTag>> => {
  if (!tagNames.length) {
    return new Map();
  }

  const existingTags = await tx.tag.findMany({
    where: { tenantId, name: { in: tagNames } },
  });

  const tagsByName = new Map(existingTags.map((tag) => [tag.name, tag]));
  const missing = tagNames.filter((name) => !tagsByName.has(name));

  if (missing.length) {
    const created = await Promise.all(
      missing.map((name) =>
        tx.tag.create({
          data: {
            tenantId,
            name,
          },
        })
      )
    );

    for (const tag of created) {
      tagsByName.set(tag.name, tag);
    }
  }

  return tagsByName;
};

const syncContactTags = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  contactId: string,
  tagNames: string[]
): Promise<void> => {
  const normalized = normalizeTagNames(tagNames);

  if (!normalized.length) {
    await tx.contactTag.deleteMany({ where: { contactId, tenantId } });
    return;
  }

  const tagsByName = await ensureTagsExist(tx, tenantId, normalized);
  const tagIds = normalized
    .map((name) => tagsByName.get(name)?.id)
    .filter((id): id is string => typeof id === 'string');

  await tx.contactTag.deleteMany({
    where: {
      contactId,
      tenantId,
      tagId: { notIn: tagIds },
    },
  });

  await Promise.all(
    tagIds.map((tagId) =>
      tx.contactTag.upsert({
        where: {
          contactId_tagId: {
            contactId,
            tagId,
          },
        },
        update: {},
        create: {
          tenantId,
          contactId,
          tagId,
        },
      })
    )
  );
};

const CONTACT_SORT_FIELDS: Record<string, keyof Prisma.ContactOrderByWithRelationInput> = {
  name: 'fullName',
  fullName: 'fullName',
  email: 'primaryEmail',
  primaryEmail: 'primaryEmail',
  phone: 'primaryPhone',
  primaryPhone: 'primaryPhone',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  lastInteractionAt: 'lastInteractionAt',
};

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

const toRecord = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const mapContact = (record: PrismaContactWithTags): Contact => {
  const tags = record.tags
    .map((assignment) => assignment.tag?.name ?? null)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);

  return {
    id: record.id,
    tenantId: record.tenantId,
    name: record.fullName,
    phone: record.primaryPhone ?? undefined,
    email: record.primaryEmail ?? undefined,
    document: record.document ?? undefined,
    avatar: record.avatar ?? undefined,
    status: record.status as ContactStatus,
    isBlocked: record.isBlocked,
    tags,
    customFields: toRecord(record.customFields),
    lastInteractionAt: record.lastInteractionAt ?? undefined,
    notes: record.notes ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const mapInteraction = (record: PrismaContactInteraction): ContactInteraction => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  channel: record.channel as ContactInteractionChannel,
  direction: record.direction as ContactInteractionDirection,
  summary: record.summary,
  payload: toRecord(record.payload),
  occurredAt: record.occurredAt,
  createdAt: record.createdAt,
});

const mapTask = (record: PrismaContactTask): ContactTask => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  title: record.title,
  description: record.description ?? undefined,
  dueAt: record.dueAt ?? undefined,
  status: record.status as ContactTaskStatus,
  assigneeId: record.assigneeId ?? undefined,
  metadata: toRecord(record.metadata),
  completedAt: record.completedAt ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): Pick<ContactsPaginatedResult, 'total' | 'page' | 'limit' | 'totalPages' | 'hasNext' | 'hasPrev'> => {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

const normalizeStatusFilter = (status: ContactStatus[] | undefined): $Enums.ContactStatus[] => {
  if (!status?.length) {
    return [];
  }

  const valid = new Set(Object.values($Enums.ContactStatus));
  return status
    .map((value) => (valid.has(value as $Enums.ContactStatus) ? (value as $Enums.ContactStatus) : null))
    .filter((value): value is $Enums.ContactStatus => value !== null);
};

const buildContactWhere = (
  tenantId: string,
  filters?: ContactFilters
): Prisma.ContactWhereInput => {
  const where: Prisma.ContactWhereInput = { tenantId };

  if (!filters) {
    return where;
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { primaryEmail: { contains: term, mode: 'insensitive' } },
        { primaryPhone: { contains: term, mode: 'insensitive' } },
        { document: { contains: term, mode: 'insensitive' } },
      ];
    }
  }

  const normalizedStatuses = normalizeStatusFilter(filters.status);
  if (normalizedStatuses.length) {
    where.status = { in: normalizedStatuses };
  }

  if (filters.tags?.length) {
    where.tags = {
      some: {
        tag: {
          name: { in: filters.tags },
        },
      },
    };
  }

  if (typeof filters.isBlocked === 'boolean') {
    where.isBlocked = filters.isBlocked;
  }

  if (filters.lastInteractionFrom || filters.lastInteractionTo) {
    where.lastInteractionAt = {
      ...(filters.lastInteractionFrom ? { gte: filters.lastInteractionFrom } : {}),
      ...(filters.lastInteractionTo ? { lte: filters.lastInteractionTo } : {}),
    };
  }

  if (typeof filters.hasOpenTickets === 'boolean') {
    where.tickets = filters.hasOpenTickets
      ? {
          some: {
            status: { in: OPEN_TICKET_STATUSES },
          },
        }
      : {
          none: {
            status: { in: OPEN_TICKET_STATUSES },
          },
        };
  }

  if (typeof filters.hasWhatsapp === 'boolean') {
    where.phones = filters.hasWhatsapp
      ? {
          some: {
            waId: {
              not: null,
            },
          },
        }
      : {
          none: {
            waId: {
              not: null,
            },
          },
        };
  }

  return where;
};

export const listContacts = async (
  tenantId: string,
  {
    page = 1,
    limit = 20,
    sortBy,
    sortOrder = 'desc',
  }: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  filters?: ContactFilters
): Promise<ContactsPaginatedResult> => {
  const prisma = getPrismaClient();
  const where = buildContactWhere(tenantId, filters);
  const skip = (page - 1) * limit;
  const resolvedSortField = sortBy ? CONTACT_SORT_FIELDS[sortBy] : undefined;
  const orderBy: Prisma.ContactOrderByWithRelationInput = resolvedSortField
    ? { [resolvedSortField]: sortOrder }
    : { updatedAt: sortOrder };

  const [records, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: CONTACT_TAGS_INCLUDE,
    }),
    prisma.contact.count({ where }),
  ]);

  const contactIds = records.map((record) => record.id);

  const [openTicketCounts, pendingTaskCounts] = contactIds.length
    ? await Promise.all([
        prisma.ticket.groupBy({
          by: ['contactId'],
          where: { tenantId, contactId: { in: contactIds }, status: { in: OPEN_TICKET_STATUSES } },
          _count: { _all: true },
        }),
        prisma.contactTask.groupBy({
          by: ['contactId'],
          where: { tenantId, contactId: { in: contactIds }, status: PENDING_TASK_STATUS },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const contactItems: ContactListItem[] = records.map((record) => {
    const openTickets = openTicketCounts.find((item) => item.contactId === record.id)?._count._all ?? 0;
    const pendingTasks = pendingTaskCounts.find((item) => item.contactId === record.id)?._count._all ?? 0;

    return {
      ...mapContact(record as PrismaContactWithTags),
      openTickets,
      pendingTasks,
    };
  });

  return {
    items: contactItems,
    ...buildPaginationMeta(total, page, limit),
  };
};

export const getContactById = async (tenantId: string, contactId: string): Promise<ContactDetails | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.contact.findFirst({
    where: { tenantId, id: contactId },
    include: CONTACT_DETAILS_INCLUDE,
  });

  if (!record) {
    return null;
  }

  return {
    ...mapContact(record as PrismaContactWithTags),
    interactions: record.contactInteractions.map(mapInteraction),
    tasks: record.contactTasks.map(mapTask),
    openTickets: record._count?.tickets ?? 0,
  };
};

export const createContact = async ({ tenantId, payload }: CreateContactDTO): Promise<Contact> => {
  const prisma = getPrismaClient();
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        tenantId,
        fullName: payload.name,
        displayName: payload.name,
        primaryPhone: payload.phone ?? null,
        primaryEmail: payload.email ?? null,
        document: payload.document ?? null,
        avatar: payload.avatar ?? null,
        status: (payload.status as $Enums.ContactStatus | undefined) ?? $Enums.ContactStatus.ACTIVE,
        isBlocked: payload.isBlocked ?? false,
        customFields: (payload.customFields ?? {}) as Prisma.InputJsonValue,
        lastInteractionAt: payload.lastInteractionAt ?? null,
        notes: payload.notes ?? null,
      },
    });

    const tags = normalizeTagNames(payload.tags);
    if (tags.length) {
      await syncContactTags(tx, tenantId, created.id, tags);
    }

    const withTags = await tx.contact.findUniqueOrThrow({
      where: { id: created.id },
      include: CONTACT_TAGS_INCLUDE,
    });

    return withTags;
  });

  return mapContact(record as PrismaContactWithTags);
};

export const updateContact = async ({ tenantId, contactId, payload }: UpdateContactDTO): Promise<Contact | null> => {
  const prisma = getPrismaClient();
  try {
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id: contactId, tenantId },
        data: {
          ...(payload.name !== undefined
            ? { fullName: payload.name, displayName: payload.name }
            : {}),
          ...(payload.phone !== undefined ? { primaryPhone: payload.phone ?? null } : {}),
          ...(payload.email !== undefined ? { primaryEmail: payload.email ?? null } : {}),
          ...(payload.document !== undefined ? { document: payload.document ?? null } : {}),
          ...(payload.avatar !== undefined ? { avatar: payload.avatar ?? null } : {}),
          ...(payload.status !== undefined ? { status: payload.status as $Enums.ContactStatus } : {}),
          ...(payload.isBlocked !== undefined ? { isBlocked: payload.isBlocked } : {}),
          ...(payload.customFields !== undefined
            ? { customFields: (payload.customFields ?? {}) as Prisma.InputJsonValue }
            : {}),
          ...(payload.lastInteractionAt !== undefined
            ? { lastInteractionAt: payload.lastInteractionAt ?? null }
            : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes ?? null } : {}),
        },
      });

      if (payload.tags !== undefined) {
        await syncContactTags(tx, tenantId, updated.id, payload.tags);
      }

      const withTags = await tx.contact.findUniqueOrThrow({
        where: { id: contactId },
        include: CONTACT_TAGS_INCLUDE,
      });

      return withTags;
    });

    return mapContact(record as PrismaContactWithTags);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const deleteContacts = async (tenantId: string, contactIds: string[]): Promise<number> => {
  const prisma = getPrismaClient();
  const result = await prisma.contact.deleteMany({ where: { tenantId, id: { in: contactIds } } });
  return result.count;
};

export const listContactTags = async (tenantId: string): Promise<ContactTagAggregation[]> => {
  const prisma = getPrismaClient();
  const assignments = await prisma.contactTag.groupBy({
    by: ['tagId'],
    where: { tenantId },
    _count: { _all: true },
  });

  if (!assignments.length) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: { tenantId, id: { in: assignments.map((assignment) => assignment.tagId) } },
  });

  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));

  return assignments
    .map((assignment) => {
      const name = tagNameById.get(assignment.tagId);
      if (!name) {
        return null;
      }

      return { tag: name, count: assignment._count._all } satisfies ContactTagAggregation;
    })
    .filter((value): value is ContactTagAggregation => value !== null)
    .sort((a, b) => a.tag.localeCompare(b.tag));
};

export const logContactInteraction = async ({
  tenantId,
  contactId,
  payload,
}: CreateContactInteractionDTO): Promise<ContactInteraction> => {
  const prisma = getPrismaClient();
  const record = await prisma.contactInteraction.create({
    data: {
      tenantId,
      contactId,
      channel: payload.channel as $Enums.ContactInteractionChannel,
      direction: payload.direction as $Enums.ContactInteractionDirection,
      summary: payload.summary,
      payload: (payload.payload ?? {}) as Prisma.InputJsonValue,
      occurredAt: payload.occurredAt ?? new Date(),
    },
  });

  await prisma.contact.update({
    where: { id: contactId, tenantId },
    data: { lastInteractionAt: record.occurredAt },
  });

  return mapInteraction(record);
};

export const listContactInteractions = async ({
  tenantId,
  contactId,
  page = 1,
  limit = 20,
  sortBy,
  sortOrder = 'desc',
}: ListContactInteractionsQuery & { tenantId: string }): Promise<PaginatedResult<ContactInteraction>> => {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.contactInteraction.findMany({
      where: { tenantId, contactId },
      orderBy: sortBy ? { [sortBy]: sortOrder } : { occurredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contactInteraction.count({ where: { tenantId, contactId } }),
  ]);

  return {
    items: records.map(mapInteraction),
    ...buildPaginationMeta(total, page, limit),
  };
};

export const createContactTask = async ({
  tenantId,
  contactId,
  payload,
}: CreateContactTaskDTO): Promise<ContactTask> => {
  const prisma = getPrismaClient();
  const record = await prisma.contactTask.create({
    data: {
      tenantId,
      contactId,
      title: payload.title,
      description: payload.description ?? null,
      dueAt: payload.dueAt ?? null,
      status: PENDING_TASK_STATUS,
      assigneeId: payload.assigneeId ?? null,
      metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return mapTask(record);
};

export const listContactTasks = async ({
  tenantId,
  contactId,
  page = 1,
  limit = 20,
  status,
  sortBy,
  sortOrder = 'desc',
}: ListContactTasksQuery & { tenantId: string }): Promise<PaginatedResult<ContactTask>> => {
  const prisma = getPrismaClient();
  const skip = (page - 1) * limit;

  const where: Prisma.ContactTaskWhereInput = {
    tenantId,
    contactId,
    ...(status?.length ? { status: { in: status as $Enums.ContactTaskStatus[] } } : {}),
  };

  const [records, total] = await Promise.all([
    prisma.contactTask.findMany({
      where,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contactTask.count({ where }),
  ]);

  return {
    items: records.map(mapTask),
    ...buildPaginationMeta(total, page, limit),
  };
};

export const updateContactTask = async ({
  tenantId,
  taskId,
  payload,
}: UpdateContactTaskDTO): Promise<ContactTask | null> => {
  const prisma = getPrismaClient();
  try {
    const record = await prisma.contactTask.update({
      where: { id: taskId, tenantId },
      data: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description ?? null } : {}),
        ...(payload.dueAt !== undefined ? { dueAt: payload.dueAt ?? null } : {}),
        ...(payload.status ? { status: payload.status as $Enums.ContactTaskStatus } : {}),
        ...(payload.assigneeId !== undefined ? { assigneeId: payload.assigneeId ?? null } : {}),
        ...(payload.metadata !== undefined
          ? { metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue }
          : {}),
        ...(payload.completedAt !== undefined ? { completedAt: payload.completedAt ?? null } : {}),
      },
    });

    return mapTask(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

export const mergeContacts = async ({ tenantId, targetId, sourceIds, preserve }: MergeContactsDTO): Promise<Contact | null> => {
  const prisma = getPrismaClient();
  const uniqueSourceIds = Array.from(new Set(sourceIds.filter((id) => id !== targetId)));
  if (!uniqueSourceIds.length) {
    return getContactById(tenantId, targetId);
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.contact.findFirst({
      where: { tenantId, id: targetId },
      include: CONTACT_TAGS_INCLUDE,
    });
    if (!target) {
      return null;
    }

    const sources = await tx.contact.findMany({
      where: { tenantId, id: { in: uniqueSourceIds } },
      include: CONTACT_TAGS_INCLUDE,
    });

    if (!sources.length) {
      return mapContact(target as PrismaContactWithTags);
    }

    const targetTagNames = target.tags
      .map((assignment) => assignment.tag?.name ?? null)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    const sourceTagNames = sources.flatMap((source) =>
      source.tags
        .map((assignment) => assignment.tag?.name ?? null)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
    );

    const mergedTags =
      preserve?.tags === false
        ? targetTagNames
        : normalizeTagNames([...targetTagNames, ...sourceTagNames]);

    const baseCustomFields = toRecord(target.customFields);
    const mergedCustomFields =
      preserve?.customFields === false
        ? baseCustomFields
        : sources.reduce<Record<string, unknown>>((acc, source) => ({
            ...acc,
            ...toRecord(source.customFields),
          }), baseCustomFields);

    const mergedNotes = (() => {
      if (preserve?.notes === false) {
        return target.notes ?? null;
      }

      const notes = [target.notes, ...sources.map((source) => source.notes)]
        .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
        .map((note) => note.trim());

      return notes.length > 0 ? notes.join('\n') : target.notes ?? null;
    })();

    await Promise.all([
      tx.ticket.updateMany({
        where: { tenantId, contactId: { in: uniqueSourceIds } },
        data: { contactId: targetId },
      }),
      tx.lead.updateMany({
        where: { tenantId, contactId: { in: uniqueSourceIds } },
        data: { contactId: targetId },
      }),
      tx.message.updateMany({
        where: { tenantId, contactId: { in: uniqueSourceIds } },
        data: { contactId: targetId },
      }),
      tx.contactTask.updateMany({
        where: { tenantId, contactId: { in: uniqueSourceIds } },
        data: { contactId: targetId },
      }),
      tx.contactInteraction.updateMany({
        where: { tenantId, contactId: { in: uniqueSourceIds } },
        data: { contactId: targetId },
      }),
    ]);

    await tx.contact.update({
      where: { id: targetId, tenantId },
      data: {
        customFields: mergedCustomFields as Prisma.InputJsonValue,
        notes: mergedNotes,
      },
    });

    await syncContactTags(tx, tenantId, targetId, mergedTags);

    await tx.contact.deleteMany({ where: { tenantId, id: { in: uniqueSourceIds } } });

    const updated = await tx.contact.findFirst({
      where: { tenantId, id: targetId },
      include: CONTACT_TAGS_INCLUDE,
    });

    return updated ? mapContact(updated as PrismaContactWithTags) : null;
  });
};

export const applyBulkContactsAction = async ({
  tenantId,
  contactIds,
  status,
  addTags,
  removeTags,
  block,
}: BulkContactsAction): Promise<Contact[]> => {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const contacts = await tx.contact.findMany({
      where: { tenantId, id: { in: contactIds } },
      include: CONTACT_TAGS_INCLUDE,
    });

    const tagsToAdd = normalizeTagNames(addTags);
    const tagsToRemove = new Set(normalizeTagNames(removeTags));

    const updated = await Promise.all(
      contacts.map(async (contact) => {
        const currentTags = contact.tags
          .map((assignment) => assignment.tag?.name ?? null)
          .filter((name): name is string => typeof name === 'string' && name.length > 0);

        let nextTags = currentTags.filter((tag) => !tagsToRemove.has(tag));

        if (tagsToAdd.length) {
          nextTags = normalizeTagNames([...nextTags, ...tagsToAdd]);
        }

        const shouldSyncTags = tagsToAdd.length > 0 || tagsToRemove.size > 0;

        await tx.contact.update({
          where: { id: contact.id, tenantId },
          data: {
            ...(status ? { status: status as $Enums.ContactStatus } : {}),
            ...(block !== undefined ? { isBlocked: block } : {}),
          },
        });

        if (shouldSyncTags) {
          await syncContactTags(tx, tenantId, contact.id, nextTags);
        }

        const refreshed = await tx.contact.findUniqueOrThrow({
          where: { id: contact.id },
          include: CONTACT_TAGS_INCLUDE,
        });

        return mapContact(refreshed as PrismaContactWithTags);
      })
    );

    return updated;
  });
};

export const findContactsByIds = async (tenantId: string, contactIds: string[]): Promise<Contact[]> => {
  if (!contactIds.length) {
    return [];
  }

  const prisma = getPrismaClient();
  const records = await prisma.contact.findMany({
    where: { tenantId, id: { in: contactIds } },
    include: CONTACT_TAGS_INCLUDE,
  });
  return records.map((record) => mapContact(record as PrismaContactWithTags));
};
