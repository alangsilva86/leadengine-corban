import type { Prisma, TicketNote as StoredNote } from '@prisma/client';
import { prisma } from '../lib/prisma';

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

const formatNote = (note: StoredNote): TicketNote => ({
  ...note,
  visibility: note.visibility === 'private' || note.visibility === 'public' ? note.visibility : 'team',
  metadata: note.metadata && typeof note.metadata === 'object' && !Array.isArray(note.metadata)
    ? note.metadata as Record<string, unknown>
    : {},
});

export const listTicketNotes = async (tenantId: string, ticketIds: string[], actorId?: string): Promise<TicketNote[]> => {
  const notes = await prisma.ticketNote.findMany({
    where: { tenantId, ticketId: { in: ticketIds }, ticket: { tenantId },
      OR: [{ visibility: { in: ['team', 'public'] } }, ...(actorId ? [{ visibility: 'private', authorId: actorId }] : [])] },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return notes.map(formatNote);
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
  const { metadata, ...data } = input;
  const note = await prisma.ticketNote.create({ data: { ...data, metadata: metadata as Prisma.InputJsonValue } });
  return formatNote(note);
};
