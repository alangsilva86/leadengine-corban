import { normalizeQrPayload as normalizeQrPayloadContract } from '@ticketz/wa-contracts';

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

const hasMeaningfulQrData = (qr) => {
  if (!qr) return false;
  return Boolean(
    qr.available === true ||
      qr.qr ||
      qr.qrCode ||
      qr.expiresAt ||
      qr.qrExpiresAt ||
      qr.reason === 'EXPIRED'
  );
};

export const extractQrPayload = (payload) => {
  const normalized = normalizeQrPayloadContract(payload);
  return hasMeaningfulQrData(normalized) ? normalized : null;
};

export const getQrImageSrc = (payload) => {
  const normalized = normalizeQrPayloadContract(payload);
  const available = normalized.available;
  const reason = normalized.reason ?? null;

  if (!available) {
    return {
      code: null,
      immediate: null,
      needsGeneration: false,
      isBaileys: false,
      available,
      reason,
    };
  }

  const codeCandidate = normalized.qrCode ?? normalized.qr ?? null;
  const normalizedCode = typeof codeCandidate === 'string' ? codeCandidate.trim() : '';

  if (!normalizedCode) {
    return {
      code: null,
      immediate: null,
      needsGeneration: false,
      isBaileys: false,
      available: false,
      reason: reason ?? 'UNAVAILABLE',
    };
  }

  if (isDataUrl(normalizedCode) || isHttpUrl(normalizedCode)) {
    return {
      code: normalizedCode,
      immediate: normalizedCode,
      needsGeneration: false,
      isBaileys: false,
      available: true,
      reason: null,
    };
  }

  if (isLikelyBase64(normalizedCode)) {
    return {
      code: normalizedCode,
      immediate: `data:image/png;base64,${normalizedCode}`,
      needsGeneration: false,
      isBaileys: false,
      available: true,
      reason: null,
    };
  }

  const isBaileys = isLikelyBaileysString(normalizedCode);

  return {
    code: normalizedCode,
    immediate: null,
    needsGeneration: true,
    isBaileys,
    available: true,
    reason: null,
  };
};

export const isLikelyBaileysPayload = (value) => {
  if (!value) return false;
  const normalized = normalizeQrPayloadContract(value);
  const candidate = normalized.qrCode ?? normalized.qr ?? null;
  return typeof candidate === 'string' ? isLikelyBaileysString(candidate) : false;
};

export { isDataUrl, isHttpUrl };
export { normalizeQrPayloadContract as normalizeQrPayload };
