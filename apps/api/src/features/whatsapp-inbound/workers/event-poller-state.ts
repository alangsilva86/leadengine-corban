import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';

const STATE_KEY = 'whatsapp:event-poller:cursor';

const readCursor = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if ('cursor' in record) {
      return readCursor(record.cursor);
    }

    if ('value' in record) {
      return readCursor(record.value);
    }
  }

  return null;
};

export const loadPollerCursor = async (): Promise<string | null> => {
  try {
    const record = await prisma.integrationState.findUnique({ where: { key: STATE_KEY } });
    if (!record) {
      return null;
    }

    return readCursor(record.value ?? null);
  } catch (error) {
    logger.warn('Failed to load WhatsApp poller cursor from integration state', { error });
    return null;
  }
};

export const savePollerCursor = async (cursor: string | null): Promise<void> => {
  try {
    const payload = cursor ? { cursor } : null;

    await prisma.integrationState.upsert({
      where: { key: STATE_KEY },
      update: { value: payload },
      create: { key: STATE_KEY, value: payload },
    });
  } catch (error) {
    logger.error('Failed to persist WhatsApp poller cursor to integration state', { error, cursor });
    throw error;
  }
};

export const __private = {
  readCursor,
  STATE_KEY,
};
