import { randomUUID } from 'node:crypto';

export type TicketNoteVisibility = 'private' | 'team' | 'public';

export type TicketNote = {
  id: string;
  tenantId: string;
  ticketId: string;
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  body: string;
  visibility: TicketNoteVisibility;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type NoteBucket = Map<string, TicketNote[]>; // ticketId -> notes
const notesByTenant = new Map<string, NoteBucket>();

const getTenantBucket = (tenantId: string): NoteBucket => {
  let bucket = notesByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map();
    notesByTenant.set(tenantId, bucket);
  }
  return bucket;
};

export const listTicketNotes = async (tenantId: string, ticketId: string): Promise<TicketNote[]> => {
  const tenantBucket = getTenantBucket(tenantId);
  const notes = tenantBucket.get(ticketId) ?? [];
  return notes
    .slice()
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .map((note) => ({
      ...note,
      ...(note.tags ? { tags: [...note.tags] } : {}),
      ...(note.metadata ? { metadata: { ...note.metadata } } : {}),
    }));
};

type CreateNoteInput = {
  tenantId: string;
  ticketId: string;
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  body: string;
  visibility?: TicketNoteVisibility;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export const createTicketNote = async (input: CreateNoteInput): Promise<TicketNote> => {
  const now = new Date();
  const note: TicketNote = {
    id: randomUUID(),
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    authorId: input.authorId,
    authorName: input.authorName ?? null,
    authorAvatar: input.authorAvatar ?? null,
    body: input.body,
    visibility: input.visibility ?? 'team',
    createdAt: now,
    updatedAt: now,
    ...(input.tags ? { tags: [...input.tags] } : {}),
    ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
  };

  const tenantBucket = getTenantBucket(input.tenantId);
  const list = tenantBucket.get(input.ticketId) ?? [];
  tenantBucket.set(input.ticketId, [...list, note]);

  return {
    ...note,
    ...(note.tags ? { tags: [...note.tags] } : {}),
    ...(note.metadata ? { metadata: { ...note.metadata } } : {}),
  };
};

export const resetTicketNotes = () => {
  notesByTenant.clear();
};
