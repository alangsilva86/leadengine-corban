const isDataUrl = (value) => typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const isLikelyBase64 = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length < 16 || normalized.length % 4 !== 0) {
    return false;
  }
  return /^[A-Za-z0-9+/=]+$/.test(normalized);
};

const isLikelyBaileysString = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  const commaCount = (normalized.match(/,/g) || []).length;
  return normalized.includes('@') || commaCount >= 3 || /::/.test(normalized);
};

export const getQrImageSrc = (qrPayload) => {
  const availableFlag =
    typeof qrPayload?.available === 'boolean'
      ? qrPayload.available
      : typeof qrPayload?.qrAvailable === 'boolean'
        ? qrPayload.qrAvailable
        : undefined;

  const reason =
    typeof qrPayload?.reason === 'string'
      ? qrPayload.reason
      : typeof qrPayload?.qrReason === 'string'
        ? qrPayload.qrReason
        : null;

  if (!qrPayload || availableFlag === false) {
    return {
      code: null,
      immediate: null,
      needsGeneration: false,
      isBaileys: false,
      available: availableFlag ?? false,
      reason,
    };
  }

  const codeCandidate =
    qrPayload.qrCode ||
    qrPayload.image ||
    (typeof qrPayload === 'string' ? qrPayload : null) ||
    null;

  if (!codeCandidate) {
    return {
      code: null,
      immediate: null,
      needsGeneration: false,
      isBaileys: false,
      available: availableFlag,
      reason,
    };
  }

  const normalized = `${codeCandidate}`.trim();

  if (isDataUrl(normalized) || isHttpUrl(normalized)) {
    return {
      code: normalized,
      immediate: normalized,
      needsGeneration: false,
      isBaileys: false,
      available: true,
      reason: null,
    };
  }

  if (isLikelyBase64(normalized)) {
    return {
      code: normalized,
      immediate: `data:image/png;base64,${normalized}`,
      needsGeneration: false,
      isBaileys: false,
      available: true,
      reason: null,
    };
  }

  const isBaileys = isLikelyBaileysString(normalized);

  return {
    code: normalized,
    immediate: null,
    needsGeneration: true,
    isBaileys,
    available: true,
    reason: null,
  };
};

const mergeQr = (primary, secondary) => {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const merged = {
    qr: primary.qr ?? secondary.qr ?? null,
    qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
    qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
    expiresAt:
      primary.expiresAt ??
      secondary.expiresAt ??
      primary.qrExpiresAt ??
      secondary.qrExpiresAt ??
      null,
    available:
      typeof secondary.available === 'boolean'
        ? secondary.available
        : typeof primary.available === 'boolean'
          ? primary.available
          : undefined,
    reason: secondary.reason ?? primary.reason ?? null,
  };
  return merged;
};

export const extractQrPayload = (payload) => {
  if (!payload) return null;

  const parseCandidate = (candidate) => {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
      return { qr: candidate, qrCode: candidate, qrExpiresAt: null, expiresAt: null };
    }

    if (typeof candidate !== 'object') {
      return null;
    }

    const source = candidate;

    const directQr =
      typeof source.qr === 'string'
        ? source.qr
        : typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : typeof source.code === 'string'
        ? source.code
        : typeof source.image === 'string'
        ? source.image
        : typeof source.value === 'string'
        ? source.value
        : null;

    const qrCodeCandidate =
      typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : null;

    const qrExpiresCandidate =
      typeof source.qrExpiresAt === 'string'
        ? source.qrExpiresAt
        : typeof source.qr_expires_at === 'string'
        ? source.qr_expires_at
        : null;

    const expiresCandidate =
      typeof source.expiresAt === 'string'
        ? source.expiresAt
        : typeof source.expiration === 'string'
        ? source.expiration
        : typeof source.expires === 'string'
        ? source.expires
        : null;

    const availableCandidate =
      typeof source.available === 'boolean'
        ? source.available
        : typeof source.qrAvailable === 'boolean'
          ? source.qrAvailable
          : undefined;

    const reasonCandidate =
      typeof source.reason === 'string'
        ? source.reason
        : typeof source.qrReason === 'string'
          ? source.qrReason
          : null;

    let normalized = null;

    if (directQr || qrCodeCandidate || qrExpiresCandidate || expiresCandidate) {
      normalized = {
        qr: directQr ?? qrCodeCandidate ?? null,
        qrCode: qrCodeCandidate ?? directQr ?? null,
        qrExpiresAt: qrExpiresCandidate ?? null,
        expiresAt: expiresCandidate ?? qrExpiresCandidate ?? null,
        available: availableCandidate,
        reason: reasonCandidate,
      };
    }

    const nestedCandidates = [
      source.qr,
      source.qrData,
      source.qrPayload,
      source.qr_info,
      source.data,
      source.payload,
      source.result,
      source.response,
    ];

    for (const nestedSource of nestedCandidates) {
      const nested = parseCandidate(nestedSource);
      if (nested) {
        normalized = mergeQr(normalized, nested);
        break;
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

  const normalized = parseCandidate(payload);

  if (!normalized) {
    return null;
  }

  const finalPayload = { ...normalized };
  if (!finalPayload.qr && finalPayload.qrCode) {
    finalPayload.qr = finalPayload.qrCode;
  }
  if (!finalPayload.qrCode && finalPayload.qr) {
    finalPayload.qrCode = finalPayload.qr;
  }
  if (!finalPayload.expiresAt && finalPayload.qrExpiresAt) {
    finalPayload.expiresAt = finalPayload.qrExpiresAt;
  }
  if (!finalPayload.qrExpiresAt && finalPayload.expiresAt) {
    finalPayload.qrExpiresAt = finalPayload.expiresAt;
  }
  if (typeof finalPayload.available !== 'boolean') {
    finalPayload.available =
      typeof payload?.available === 'boolean'
        ? payload.available
        : typeof payload?.qrAvailable === 'boolean'
          ? payload.qrAvailable
          : undefined;
  }
  if (!finalPayload.reason && typeof payload?.reason === 'string') {
    finalPayload.reason = payload.reason;
  }
  if (!finalPayload.reason && typeof payload?.qrReason === 'string') {
    finalPayload.reason = payload.qrReason;
  }

  return finalPayload;
};

export const isLikelyBaileysPayload = (value) => {
  if (!value) return false;
  if (typeof value === 'string') {
    return isLikelyBaileysString(value);
  }
  if (typeof value === 'object' && value !== null) {
    const candidate = value.qr || value.qrCode || value.code || value.image || null;
    return typeof candidate === 'string' ? isLikelyBaileysString(candidate) : false;
  }
  return false;
};

export { isDataUrl, isHttpUrl };
