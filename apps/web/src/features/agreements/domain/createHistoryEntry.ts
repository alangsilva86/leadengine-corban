import { generateId } from '../convenioSettings.utils.ts';
import type { AgreementHistoryEntry } from '../useConvenioCatalog.ts';

type CreateHistoryEntryParams = {
  author: string;
  message: string;
  createdAt?: Date;
  metadata?: AgreementHistoryEntry['metadata'];
  idFactory?: () => string;
};

export const createHistoryEntry = ({
  author,
  message,
  createdAt = new Date(),
  metadata = {},
  idFactory = generateId,
}: CreateHistoryEntryParams): AgreementHistoryEntry => ({
  id: idFactory(),
  author,
  message,
  createdAt,
  metadata,
});

export default createHistoryEntry;
