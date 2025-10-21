import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';

export const sanitizeJsonPayload = (value: unknown): Prisma.InputJsonValue => {
  try {
    const normalized = JSON.parse(JSON.stringify(value ?? null));
    return normalized as Prisma.InputJsonValue;
  } catch (error) {
    logger.warn('⚠️ [Webhook] Falha ao sanitizar payload JSON para debug', { error });
    return null as unknown as Prisma.InputJsonValue;
  }
};

export const logBaileysDebugEvent = async (
  source: string,
  payload: unknown
): Promise<void> => {
  const normalizedSource = source.trim();
  if (!normalizedSource) {
    return;
  }

  try {
    await prisma.processedIntegrationEvent.create({
      data: {
        id: randomUUID(),
        source: normalizedSource,
        payload: sanitizeJsonPayload(payload),
      },
    });
  } catch (error) {
    logger.warn('⚠️ [Webhook] Falha ao registrar payload para debug', {
      source: normalizedSource,
      error,
    });
  }
};
