import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../config/logger';
import {
  getBankIntegrationSettings,
  listBankIntegrationSettings,
} from '../services/integrations/banks';
import {
  getProviderStatus,
  listProviderStatuses,
  runAgreementsSync,
  type AgreementsSyncOptions,
} from '../workers/agreements-sync';
import type { BankProviderId } from '../config/bank-integrations';

const router = Router();
const LOG_PREFIX = '[AgreementsAPI]';

const buildMeta = (traceId?: string) => {
  const trimmed = typeof traceId === 'string' ? traceId.trim() : '';
  const resolvedTraceId = trimmed.length > 0 ? trimmed : randomUUID();
  return {
    traceId: resolvedTraceId,
    timestamp: new Date().toISOString(),
  } satisfies { traceId: string; timestamp: string };
};

const respondError = (
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  status: number,
  code: string,
  message: string,
  meta: { traceId: string; timestamp: string },
  details?: unknown
) => {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta,
  });
};

const applyDeprecationHeaders = (
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  settings: ReturnType<typeof getBankIntegrationSettings>
) => {
  if (settings?.deprecated) {
    res.setHeader('Deprecation', settings.sunsetAt ?? 'true');
    if (settings.sunsetAt) {
      res.setHeader('Sunset', settings.sunsetAt);
    }
  }
};

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    const meta = buildMeta();
    const settingsList = listBankIntegrationSettings();
    const statuses = listProviderStatuses();

    logger.info(`${LOG_PREFIX} 📄 Listando provedores de convênios`, {
      traceId: meta.traceId,
      providers: settingsList.map((settings) => settings.id),
    });

    const payload = settingsList.map((settings) => {
      const status = statuses.find((candidate) => candidate.providerId === settings.id);
      return {
        id: settings.id,
        name: settings.name,
        tags: settings.tags ?? [],
        enabled: status?.enabled ?? settings.enabled,
        deprecated: status?.deprecated ?? settings.deprecated ?? false,
        sunsetAt: status?.sunsetAt ?? settings.sunsetAt ?? null,
        status: status?.status ?? 'idle',
        stats: status?.stats ?? null,
        lastSuccessAt: status?.lastSuccessAt ?? null,
        error: status?.error ?? null,
        meta: status?.meta ?? { traceId: 'unknown', timestamp: new Date(0).toISOString() },
      };
    });

    if (payload.some((provider) => provider.deprecated)) {
      const sunsetDates = payload
        .map((provider) => provider.sunsetAt)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .sort();
      res.setHeader('Deprecation', sunsetDates[0] ?? 'true');
      if (sunsetDates[0]) {
        res.setHeader('Sunset', sunsetDates[0]);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        providers: payload,
      },
      meta,
    });
  })
);

router.get(
  '/providers/:providerId/status',
  asyncHandler(async (req, res) => {
    const rawProviderId = req.params.providerId;
    const providerId = rawProviderId as BankProviderId;
    const meta = buildMeta();

    const settings = getBankIntegrationSettings(providerId);
    if (!settings) {
      respondError(res, 404, 'PROVIDER_NOT_FOUND', 'Provedor de convênios não encontrado.', meta);
      return;
    }

    const status = getProviderStatus(providerId);
    if (!status) {
      respondError(res, 404, 'STATUS_NOT_AVAILABLE', 'Status ainda não disponível para o provedor informado.', meta);
      return;
    }

    logger.info(`${LOG_PREFIX} 📊 Consultando status de provedor`, {
      providerId,
      traceId: meta.traceId,
    });

    applyDeprecationHeaders(res, settings);

    res.status(200).json({
      success: true,
      data: status,
      meta,
    });
  })
);

router.post(
  '/providers/:providerId/sync',
  asyncHandler(async (req, res) => {
    const rawProviderId = req.params.providerId;
    const providerId = rawProviderId as BankProviderId;
    const meta = buildMeta();

    const settings = getBankIntegrationSettings(providerId);
    if (!settings) {
      respondError(res, 404, 'PROVIDER_NOT_FOUND', 'Provedor de convênios não encontrado.', meta);
      return;
    }

    const currentStatus = getProviderStatus(providerId);
    if (currentStatus?.status === 'running') {
      respondError(
        res,
        409,
        'SYNC_ALREADY_RUNNING',
        'Uma sincronização já está em andamento para este provedor.',
        meta,
        { providerId }
      );
      return;
    }

    const syncOptions: AgreementsSyncOptions = {
      providerId,
      traceId: meta.traceId,
      force: true,
    };

    logger.info(`${LOG_PREFIX} 🚀 Sincronização manual solicitada`, {
      providerId,
      traceId: meta.traceId,
    });

    const results = await runAgreementsSync(syncOptions);
    const result = results.find((candidate) => candidate.providerId === providerId) ?? getProviderStatus(providerId);

    applyDeprecationHeaders(res, settings);

    if (!result) {
      respondError(
        res,
        500,
        'SYNC_UNKNOWN_ERROR',
        'Não foi possível obter o resultado da sincronização.',
        meta
      );
      return;
    }

    const statusCode = result.status === 'failed' ? 500 : 202;

    res.status(statusCode).json({
      success: true,
      data: result,
      meta,
    });
  })
);

export const agreementsProvidersRouter = router;

