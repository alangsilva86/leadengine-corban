import type { UseMutationResult } from '@tanstack/react-query';

export interface NotesMutationVariables {
  ticketId?: string | null;
  body: string;
  visibility?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export type NotesMutationResult = any;

declare function useNotesMutation(args?: {
  fallbackTicketId?: string | null;
}): UseMutationResult<NotesMutationResult, unknown, NotesMutationVariables, unknown>;

export default useNotesMutation;
