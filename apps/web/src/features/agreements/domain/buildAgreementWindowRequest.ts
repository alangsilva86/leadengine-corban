import type { AgreementWindowRequest } from '@/lib/agreements-client.ts';
import type { WindowPayload } from '@/features/agreements/hooks/types.ts';

const toIsoString = (value: Date | null | undefined): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

const resolveTableId = (window: WindowPayload): string | undefined => {
  const candidate = (window as { tableId?: string | null }).tableId;
  if (typeof candidate !== 'string') {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length ? trimmed : undefined;
};

type BuildAgreementWindowRequestParams = {
  window: WindowPayload;
  actor: string;
  actorRole: string;
  note?: string;
  meta?: AgreementWindowRequest['meta'];
  includeId?: boolean;
};

export const buildAgreementWindowRequest = ({
  window,
  actor,
  actorRole,
  note,
  meta,
  includeId = true,
}: BuildAgreementWindowRequestParams): AgreementWindowRequest => {
  const tableId = resolveTableId(window);
  const metadata = (() => {
    const firstDueDate = toIsoString(window.firstDueDate);
    return firstDueDate ? { firstDueDate } : {};
  })();

  const data: AgreementWindowRequest['data'] = {
    ...(includeId ? { id: window.id } : {}),
    label: window.label,
    startsAt: toIsoString(window.start),
    endsAt: toIsoString(window.end),
    isActive: true,
    metadata,
    ...(tableId ? { tableId } : {}),
  };

  return {
    data,
    meta: {
      ...(meta ?? {}),
      audit: {
        actor,
        actorRole,
        note,
      },
    },
  };
};

export default buildAgreementWindowRequest;
