import { getEnvVar } from '@/lib/runtime-env.js';

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return fallback;
    }
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
};

const resolveFlagValue = (keys, fallback = false) => {
  for (const key of keys) {
    const raw = getEnvVar(key, undefined);
    if (typeof raw !== 'undefined') {
      return normalizeBoolean(raw, fallback);
    }
  }
  return fallback;
};

const WHATSAPP_DEBUG_FLAG_KEYS = [
  'VITE_FEATURE_WHATSAPP_DEBUG',
  'VITE_FLAG_WHATSAPP_DEBUG',
  'FEATURE_WHATSAPP_DEBUG',
];

let cachedWhatsAppDebugFlag;

export const isWhatsAppDebugEnabled = () => {
  if (typeof cachedWhatsAppDebugFlag === 'boolean') {
    return cachedWhatsAppDebugFlag;
  }

  cachedWhatsAppDebugFlag = resolveFlagValue(WHATSAPP_DEBUG_FLAG_KEYS, false);
  return cachedWhatsAppDebugFlag;
};

export const debugFeatureFlags = {
  get whatsappDebug() {
    return isWhatsAppDebugEnabled();
  },
};
