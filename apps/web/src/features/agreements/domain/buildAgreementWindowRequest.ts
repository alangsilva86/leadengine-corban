import type { AgreementWindowRequest } from '@/lib/agreements-client.ts';
import type { WindowPayload } from '@/features/agreements/hooks/types.ts';

const toIsoString = (value: Date | null | undefined): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

type BuildAgreementWindowRequestParams = {
  window: WindowPayload;
  actor: string;
  actorRole: string;
  note?: string;
  meta?: AgreementWindowRequest['meta'];
};

export const buildAgreementWindowRequest = ({
  window,
  actor,
  actorRole,
  note,
  meta,
}: BuildAgreementWindowRequestParams): AgreementWindowRequest => ({
  data: {
    id: window.id,
    tableId: null,
    label: window.label,
    startsAt: toIsoString(window.start),
    endsAt: toIsoString(window.end),
    isActive: true,
    metadata: (() => {
      const firstDueDate = toIsoString(window.firstDueDate);
      return firstDueDate ? { firstDueDate } : {};
    })(),
  },
  meta: {
    ...(meta ?? {}),
    audit: {
      actor,
      actorRole,
      note,
    },
  },
});

export default buildAgreementWindowRequest;
