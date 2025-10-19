import type { Prisma } from '@prisma/client';

import { readNestedString, readString } from './identifiers';

const toRecord = (
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

export const resolveTicketAgreementId = (ticket: unknown): string | null => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const ticketRecord = ticket as Record<string, unknown> & {
    metadata?: Prisma.JsonValue | null;
  };

  const directAgreement = readString(ticketRecord['agreementId']);
  if (directAgreement) {
    return directAgreement;
  }

  const metadataRecord = toRecord(ticketRecord.metadata ?? null);
  return (
    readString(metadataRecord.agreementId) ??
    readString(metadataRecord.agreement_id) ??
    readNestedString(metadataRecord, ['agreement', 'id']) ??
    readNestedString(metadataRecord, ['agreement', 'agreementId']) ??
    null
  );
};
