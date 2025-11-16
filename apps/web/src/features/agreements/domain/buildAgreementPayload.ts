import type { AgreementCreateRequest, AgreementUpdateRequest } from '@/lib/agreements-client.ts';
import type { Agreement } from '../useConvenioCatalog.ts';
import { serializeAgreement } from '../useConvenioCatalog.ts';

type AgreementPayload = AgreementCreateRequest & AgreementUpdateRequest;

type BuildAgreementPayloadParams = {
  agreement: Agreement;
  actor: string;
  actorRole: string;
  note?: string;
  meta?: AgreementPayload['meta'];
};

export const buildAgreementPayload = ({
  agreement,
  actor,
  actorRole,
  note,
  meta,
}: BuildAgreementPayloadParams): AgreementPayload => ({
  data: serializeAgreement(agreement),
  meta: {
    ...(meta ?? {}),
    audit: {
      actor,
      actorRole,
      note,
    },
  },
});

export default buildAgreementPayload;
