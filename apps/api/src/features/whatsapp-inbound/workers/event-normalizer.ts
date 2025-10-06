import { NormalizedEventInput } from '../queue/event-queue';

export interface BrokerEventEnvelope {
  ackId: string;
  cursor: string | null;
  instanceId?: string;
  event: NormalizedEventInput;
}

const CURSOR_KEYS = [
  'cursor',
  'nextCursor',
  'next',
  'token',
  'cursorToken',
  'pageToken',
  'offset',
  'position',
  'pointer',
  'index',
  'sequence',
  'seq',
  'cursorId',
  'eventCursor',
  'value',
];

const INSTANCE_KEYS = ['instanceId', 'instance', 'sessionId', 'session'];

const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return null;
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'bigint') {
    return JSON.stringify(value.toString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, val] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(',')}}`;
  }

  return JSON.stringify(String(value));
};

const normalizeIdentifier = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  if (typeof value === 'object') {
    try {
      return stableStringify(value);
    } catch {
      return null;
    }
  }

  return null;
};

const resolveCursorCandidate = (
  value: unknown,
  { allowObjectFallback = true }: { allowObjectFallback?: boolean } = {}
): { cursor: string | null; instanceId: string | null } => {
  if (value === undefined || value === null) {
    return { cursor: null, instanceId: null };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { cursor: null, instanceId: null };
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const candidate = resolveCursorCandidate(parsed, { allowObjectFallback });
        if (candidate.cursor) {
          return candidate;
        }
      } catch {
        // noop: fallback to trimmed string when JSON parsing fails
      }
    }

    return { cursor: trimmed, instanceId: null };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { cursor: value.toString(), instanceId: null };
  }

  if (typeof value === 'bigint') {
    return { cursor: value.toString(), instanceId: null };
  }

  if (typeof value === 'boolean') {
    return { cursor: value ? 'true' : 'false', instanceId: null };
  }

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const candidate = resolveCursorCandidate(value[index], { allowObjectFallback });
      if (candidate.cursor) {
        return candidate;
      }
    }

    return { cursor: null, instanceId: null };
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    let instanceId: string | null = null;
    for (const key of INSTANCE_KEYS) {
      const candidate = readString(record[key]);
      if (candidate) {
        instanceId = candidate;
        break;
      }
    }

    for (const key of CURSOR_KEYS) {
      if (!(key in record)) {
        continue;
      }

      const nested = resolveCursorCandidate(record[key], { allowObjectFallback });
      if (nested.cursor) {
        return {
          cursor: nested.cursor,
          instanceId: nested.instanceId ?? instanceId,
        };
      }
    }

    if (allowObjectFallback) {
      return {
        cursor: stableStringify(record),
        instanceId,
      };
    }

    return { cursor: null, instanceId };
  }

  return { cursor: null, instanceId: null };
};

export const normalizeCursorState = (
  value: unknown
): { cursor: string | null; instanceId: string | null } => resolveCursorCandidate(value);

export const normalizeBrokerEventEnvelope = (
  input: unknown
): BrokerEventEnvelope | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;

  const rawEventCandidate = [record.event, record.payload, record.value, record.data].find(
    (candidate): candidate is Record<string, unknown> =>
      Boolean(candidate && typeof candidate === 'object' && !Array.isArray(candidate))
  );

  const eventSource = rawEventCandidate ?? record;
  if (!eventSource || typeof eventSource !== 'object') {
    return null;
  }

  const event = { ...(eventSource as Record<string, unknown>) } as NormalizedEventInput;

  const ackIdCandidates = [
    record.id,
    record.key,
    (record as Record<string, unknown>).eventId,
    (record as Record<string, unknown>).ackId,
    record.cursor,
  ];

  let ackId: string | null = null;
  for (const candidate of ackIdCandidates) {
    ackId = normalizeIdentifier(candidate);
    if (ackId) {
      break;
    }
  }

  if (!ackId) {
    ackId = normalizeIdentifier(event.id ?? event.cursor ?? null);
  }

  if (!ackId) {
    return null;
  }

  const eventId =
    readString(event.id) ??
    readString((event as Record<string, unknown>).eventId) ??
    readString((event as Record<string, unknown>).messageId) ??
    ackId;

  event.id = eventId;

  const envelopeInstance =
    readString(record.instanceId) ??
    readString((record as Record<string, unknown>).sessionId) ??
    readString((record as Record<string, unknown>).instance) ??
    null;

  const eventInstance =
    readString(event.instanceId) ??
    readString((event as Record<string, unknown>).sessionId) ??
    null;

  const cursorFromRecord = normalizeCursorState(
    (record.cursor ??
      (record as Record<string, unknown>).cursorToken ??
      (record as Record<string, unknown>).nextCursor) ??
      null
  );

  const cursorFromEvent = normalizeCursorState(event.cursor ?? null);

  const cursor = cursorFromEvent.cursor ?? cursorFromRecord.cursor;
  const resolvedInstanceId =
    eventInstance ??
    envelopeInstance ??
    cursorFromEvent.instanceId ??
    cursorFromRecord.instanceId ??
    null;

  if (resolvedInstanceId) {
    event.instanceId = resolvedInstanceId;
    if (!event.sessionId) {
      event.sessionId = resolvedInstanceId;
    }
  }

  if (cursor && !event.cursor) {
    event.cursor = cursor;
  }

  return {
    ackId,
    cursor,
    instanceId: resolvedInstanceId ?? undefined,
    event,
  };
};

export const __private = {
  normalizeIdentifier,
  resolveCursorCandidate,
  stableStringify,
  readString,
};
