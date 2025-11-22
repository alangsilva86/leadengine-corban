import crypto from 'node:crypto';

import { logger } from './logger';

type PollEncryptionConfig = {
  key: Buffer;
  source: 'POLL_METADATA_ENCRYPTION_KEY' | 'APP_ENCRYPTION_KEY';
  rawKeyFingerprint: string;
  usingFallbackSource: boolean;
};

const normalizeKey = (value: string | undefined | null): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const buildPollEncryptionConfig = (): PollEncryptionConfig => {
  const pollKey = normalizeKey(process.env.POLL_METADATA_ENCRYPTION_KEY);
  const appKey = normalizeKey(process.env.APP_ENCRYPTION_KEY);

  const rawKey = pollKey || appKey;
  const source: PollEncryptionConfig['source'] = pollKey ? 'POLL_METADATA_ENCRYPTION_KEY' : 'APP_ENCRYPTION_KEY';

  if (!rawKey) {
    const message =
      'POLL_METADATA_ENCRYPTION_KEY (ou APP_ENCRYPTION_KEY) deve estar configurada para inicializar o serviço de enquetes.';
    logger.error(message);
    throw new Error(message);
  }

  return {
    key: crypto.createHash('sha256').update(rawKey).digest(),
    source,
    rawKeyFingerprint: crypto.createHash('sha256').update(rawKey).digest('hex'),
    usingFallbackSource: !pollKey,
  };
};

let cachedPollEncryptionConfig: PollEncryptionConfig | null = null;

export const getPollEncryptionConfig = (): PollEncryptionConfig => {
  if (!cachedPollEncryptionConfig) {
    cachedPollEncryptionConfig = buildPollEncryptionConfig();
  }

  return cachedPollEncryptionConfig;
};

export const refreshPollEncryptionConfig = (): PollEncryptionConfig => {
  cachedPollEncryptionConfig = buildPollEncryptionConfig();
  return cachedPollEncryptionConfig;
};

export type { PollEncryptionConfig };
