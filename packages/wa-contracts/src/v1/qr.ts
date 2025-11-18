export type NormalizedQrReason = 'UNAVAILABLE' | 'EXPIRED' | null;

export type NormalizedQrPayload = {
  qr: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  expiresAt: string | null;
  available: boolean;
  reason: NormalizedQrReason;
};

type PartialQrPayload = {
  qr?: string | null;
  qrCode?: string | null;
  qrExpiresAt?: string | null;
  expiresAt?: string | null;
  available?: boolean;
  reason?: NormalizedQrReason;
};

const DEFAULT_QR_PAYLOAD: NormalizedQrPayload = Object.freeze({
  qr: null,
  qrCode: null,
  qrExpiresAt: null,
  expiresAt: null,
  available: false,
  reason: 'UNAVAILABLE',
});

const pickString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
};

const pickBoolean = (...candidates: unknown[]): boolean | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      if (candidate > 0) {
        return true;
      }
      if (candidate === 0) {
        return false;
      }
    }
  }
  return undefined;
};

const normalizeReason = (value: unknown): NormalizedQrReason => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized === 'EXPIRED' || normalized === 'UNAVAILABLE' ? normalized : null;
};

const mergeQrPayloads = (
  primary: PartialQrPayload | null,
  secondary: PartialQrPayload | null
): PartialQrPayload | null => {
  if (!primary) return secondary;
  if (!secondary) return primary;

  return {
    qr: primary.qr ?? secondary.qr ?? null,
    qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
    qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
    expiresAt:
      primary.expiresAt ??
      secondary.expiresAt ??
      primary.qrExpiresAt ??
      secondary.qrExpiresAt ??
      null,
    reason: secondary.reason ?? primary.reason ?? null,
    ...(typeof secondary.available === 'boolean'
      ? { available: secondary.available }
      : typeof primary.available === 'boolean'
        ? { available: primary.available }
        : {}),
  };
};

const parseCandidate = (
  candidate: unknown,
  visited: WeakSet<object>
): PartialQrPayload | null => {
  if (candidate === undefined || candidate === null) {
    return null;
  }

  if (typeof candidate === 'string') {
    const normalized = candidate.trim();
    if (!normalized) {
      return null;
    }
    return { qr: normalized, qrCode: normalized, qrExpiresAt: null, expiresAt: null };
  }

  if (typeof candidate !== 'object') {
    return null;
  }

  if (visited.has(candidate)) {
    return null;
  }

  visited.add(candidate);

  const source = candidate as Record<string, unknown>;

  const directQr = pickString(
    source.qr,
    source.qrCode,
    source.qr_code,
    source.code,
    source.image,
    source.value
  );

  const qrCodeCandidate = pickString(source.qrCode, source.qr_code, source.code);
  const qrExpiresCandidate = pickString(
    source.qrExpiresAt,
    source.qr_expires_at,
    source.expiresAt,
    source.expires_at
  );
  const expiresCandidate = pickString(
    source.expiresAt,
    source.expires_at,
    source.expiration,
    source.expires,
    source.expire_at
  );
  const availableCandidate = pickBoolean(source.available, source.qrAvailable, source.qr_available);
  const reasonCandidate = normalizeReason(
    pickString(source.reason, source.qrReason, source.qr_reason)
  );

  let normalized: PartialQrPayload | null = null;

  if (directQr || qrCodeCandidate || qrExpiresCandidate || expiresCandidate) {
    normalized = {
      qr: directQr ?? qrCodeCandidate ?? null,
      qrCode: qrCodeCandidate ?? directQr ?? null,
      qrExpiresAt: qrExpiresCandidate ?? null,
      expiresAt: expiresCandidate ?? qrExpiresCandidate ?? null,
      ...(availableCandidate !== undefined ? { available: availableCandidate } : {}),
      ...(reasonCandidate ? { reason: reasonCandidate } : {}),
    };
  }

  const nestedCandidates: unknown[] = [
    source.qr,
    source.qrData,
    source.qrPayload,
    source.qr_info,
    source.qrInfo,
    source.data,
    source.payload,
    source.result,
    source.response,
    source.metadata,
    source.meta,
    source.status,
    source.sessionStatus,
    source.session_status,
    source.session,
    source.context,
  ];

  for (const nested of nestedCandidates) {
    const nestedNormalized = parseCandidate(nested, visited);
    if (nestedNormalized) {
      normalized = mergeQrPayloads(normalized, nestedNormalized);
    }
  }

  if (normalized && typeof normalized.available !== 'boolean' && availableCandidate !== undefined) {
    normalized.available = availableCandidate;
  }

  if (normalized && !normalized.reason && reasonCandidate) {
    normalized.reason = reasonCandidate;
  }

  return normalized;
};

const finalizeQrPayload = (payload: PartialQrPayload | null): NormalizedQrPayload => {
  if (!payload) {
    return DEFAULT_QR_PAYLOAD;
  }

  const qr = payload.qr ?? payload.qrCode ?? null;
  const qrCode = payload.qrCode ?? payload.qr ?? null;
  const qrExpiresAt = payload.qrExpiresAt ?? payload.expiresAt ?? null;
  const expiresAt = payload.expiresAt ?? payload.qrExpiresAt ?? null;
  const available =
    typeof payload.available === 'boolean'
      ? payload.available
      : Boolean(qr ?? qrCode);
  const baseReason = payload.reason ?? null;
  const reason: NormalizedQrReason = available
    ? null
    : baseReason ?? (qrExpiresAt || expiresAt ? 'EXPIRED' : 'UNAVAILABLE');

  return { qr, qrCode, qrExpiresAt, expiresAt, available, reason };
};

export const normalizeQrPayload = (value: unknown): NormalizedQrPayload => {
  if (value === undefined || value === null) {
    return DEFAULT_QR_PAYLOAD;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return DEFAULT_QR_PAYLOAD;
    }
    return finalizeQrPayload({ qr: normalized, qrCode: normalized, qrExpiresAt: null, expiresAt: null, available: true });
  }

  const visited = new WeakSet<object>();
  const parsed = parseCandidate(value, visited);
  return finalizeQrPayload(parsed);
};
