import type { AgreementHistoryEntry } from '@/features/agreements/useConvenioCatalog.ts';
import { createHistoryEntry } from './createHistoryEntry.ts';

export type BuildHistoryEntry = (message: string) => AgreementHistoryEntry;

export const createHistoryEntryBuilder = (author: string): BuildHistoryEntry =>
  (message) =>
    createHistoryEntry({
      author,
      message,
    });

export default createHistoryEntryBuilder;
