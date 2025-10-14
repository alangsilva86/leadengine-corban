import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPatch } from '@/lib/api.js';
import { computeBackoffDelay, parseRetryAfterMs } from '@/lib/rate-limit.js';
import useRateLimitBanner from '@/hooks/useRateLimitBanner.js';
import usePlayfulLogger from '@/features/shared/usePlayfulLogger.js';

const AUTO_REFRESH_INTERVAL_MS = 15000;

const initialSummary = { total: 0, contacted: 0, won: 0, lost: 0 };
const FALLBACK_WARNING_MESSAGE =
  'Sincronizando leads diretamente pela instância conectada. Vincule uma campanha apenas se precisar de roteamento avançado ou relatórios segmentados.';
const MISSING_CONTEXT_WARNING =
  'Conecte uma instância ativa do WhatsApp para começar a receber leads automaticamente.';

const computeContextKey = ({ agreementId, campaignId, instanceId }) =>
  instanceId ?? campaignId ?? agreementId ?? 'no-context';

export const useLeadAllocations = ({ agreementId, campaignId, instanceId }) => {
  const { log, warn, error: logError } = usePlayfulLogger('✨ LeadEngine • Inbox');
  const rateLimitInfo = useRateLimitBanner();

  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warningMessage, setWarningMessage] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(null);

  const loadingRef = useRef({ active: false, contextKey: null });
  const retryStateRef = useRef({ attempts: 0, timeoutId: null, contextKey: null });
  const loadAllocationsRef = useRef(async () => {});
  const contextKeyRef = useRef('no-context');
  const requestSequenceRef = useRef(0);

  const propsContextKey = useMemo(
    () => computeContextKey({ agreementId, campaignId, instanceId }),
    [agreementId, campaignId, instanceId]
  );

  const clearScheduledReload = useCallback(() => {
    const { timeoutId } = retryStateRef.current;
    if (timeoutId) {
      clearTimeout(timeoutId);
      retryStateRef.current.timeoutId = null;
    }
  }, []);

  const scheduleNextLoad = useCallback(
    (delayMs, mode = 'success', contextKey = contextKeyRef.current) => {
      clearScheduledReload();

      if (retryStateRef.current.contextKey !== contextKey) {
        retryStateRef.current.contextKey = contextKey;
        retryStateRef.current.attempts = 0;
      }

      let attempts = retryStateRef.current.attempts;
      if (mode === 'success') {
        attempts = 0;
        retryStateRef.current.attempts = 0;
      } else {
        attempts += 1;
        retryStateRef.current.attempts = attempts;
      }

      let waitMs;
      if (typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs >= 0) {
        waitMs = delayMs;
      } else if (mode === 'success') {
        waitMs = AUTO_REFRESH_INTERVAL_MS;
      } else {
        waitMs = computeBackoffDelay(attempts);
      }

      retryStateRef.current.timeoutId = setTimeout(() => {
        if (retryStateRef.current.contextKey !== contextKey) {
          retryStateRef.current.timeoutId = null;
          return;
        }

        retryStateRef.current.timeoutId = null;
        loadAllocationsRef.current?.();
      }, waitMs);

      setNextRefreshAt(Date.now() + waitMs);
      return waitMs;
    },
    [clearScheduledReload]
  );

  const computeSummary = useCallback((items) => {
    if (!Array.isArray(items)) {
      return initialSummary;
    }
    const counts = items.reduce(
      (acc, allocation) => {
        acc.total += 1;
        if (allocation.status === 'contacted') acc.contacted += 1;
        if (allocation.status === 'won') acc.won += 1;
        if (allocation.status === 'lost') acc.lost += 1;
        return acc;
      },
      { ...initialSummary }
    );
    return counts;
  }, []);

  const fetchAllocations = useCallback(async () => {
    const context = {
      agreementId: agreementId ?? null,
      campaignId: campaignId ?? null,
      instanceId: instanceId ?? null,
    };

    const contextKey = computeContextKey(context);
    contextKeyRef.current = contextKey;

    if (!context.agreementId && !context.campaignId && !context.instanceId) {
      clearScheduledReload();
      setWarningMessage(MISSING_CONTEXT_WARNING);
      setError(null);
      setNextRefreshAt(null);
      return;
    }

    if (loadingRef.current.active && loadingRef.current.contextKey === contextKey) {
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    loadingRef.current = { active: true, contextKey };

    try {
      setLoading(true);
      clearScheduledReload();

      log('📮 Sincronizando leads', {
        campaignId: context.campaignId,
        agreementId: context.agreementId,
        instanceId: context.instanceId,
      });

      const params = new URLSearchParams();
      if (context.instanceId) params.set('instanceId', context.instanceId);
      else if (context.campaignId) params.set('campaignId', context.campaignId);
      else if (context.agreementId) params.set('agreementId', context.agreementId);

      const payload = await apiGet(`/api/lead-engine/allocations?${params.toString()}`);
      const items = Array.isArray(payload?.data) ? payload.data : [];

      if (items.length === 0) {
        warn('Nenhum lead disponível no momento', {
          campaignId: context.campaignId,
          agreementId: context.agreementId,
          instanceId: context.instanceId,
        });
      }

      if (requestSequenceRef.current === requestId) {
        setAllocations(items);
        setSummary(computeSummary(items));
        const apiWarning =
          Array.isArray(payload?.meta?.warnings) && payload.meta.warnings.length
            ? payload.meta.warnings[0]
            : null;
        const fallbackWarning =
          !context.campaignId && !context.agreementId && context.instanceId
            ? FALLBACK_WARNING_MESSAGE
            : null;
        setWarningMessage(apiWarning ?? fallbackWarning);
        setError(null);
        setLastUpdatedAt(new Date());
        scheduleNextLoad(undefined, 'success', contextKey);

        log('✅ Leads sincronizados', {
          total: items.length,
          campaignId: context.campaignId,
          agreementId: context.agreementId,
          instanceId: context.instanceId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar leads';
      const status = err?.status ?? err?.statusCode;
      const retryAfterMs = parseRetryAfterMs(err?.retryAfter ?? err?.payload?.retryAfter ?? err?.rateLimitDelayMs);

      if (requestSequenceRef.current === requestId) {
        if (status === 429 || status === 503 || (typeof status === 'number' && status >= 500)) {
          const waitMs = scheduleNextLoad(retryAfterMs, 'retry', contextKey);
          const seconds = Math.ceil(waitMs / 1000);
          setError(`Muitas requisições. Nova tentativa em ${seconds}s.`);
          warn('Broker sinalizou limite ao carregar leads', {
            campaignId: context.campaignId,
            agreementId: context.agreementId,
            instanceId: context.instanceId,
            status,
            retryAfterMs,
          });
        } else {
          setWarningMessage(null);
          setError(message);
          scheduleNextLoad(undefined, 'success', contextKey);
        }

        logError('Falha ao sincronizar leads', err);
      }
    } finally {
      if (requestSequenceRef.current === requestId) {
        loadingRef.current = { active: false, contextKey };
        setLoading(false);
      }
    }
  }, [agreementId, campaignId, instanceId, clearScheduledReload, computeSummary, log, logError, scheduleNextLoad, warn]);

  const refresh = useCallback(() => {
    scheduleNextLoad(undefined, 'success', propsContextKey);
    return fetchAllocations();
  }, [fetchAllocations, propsContextKey, scheduleNextLoad]);

  const updateAllocationStatus = useCallback(
    async (allocationId, status) => {
      try {
        const payload = await apiPatch(`/api/lead-engine/allocations/${allocationId}`, { status });
        setAllocations((current) => {
          const next = current.map((item) =>
            item.allocationId === allocationId ? payload.data : item
          );
          setSummary(computeSummary(next));
          setLastUpdatedAt(new Date());
          return next;
        });
        log('✏️ Lead atualizado', {
          allocationId,
          status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não foi possível atualizar o lead';
        setError(message);
        logError('Falha ao atualizar lead', err);
        throw err;
      }
    },
    [computeSummary, log, logError]
  );

  useEffect(() => {
    loadAllocationsRef.current = fetchAllocations;
  }, [fetchAllocations]);

  useEffect(() => {
    loadAllocationsRef.current?.();
    return () => {
      clearScheduledReload();
    };
  }, [agreementId, campaignId, instanceId, clearScheduledReload]);

  const previousContextKeyRef = useRef(propsContextKey);
  useEffect(() => {
    if (previousContextKeyRef.current === propsContextKey) {
      return;
    }

    previousContextKeyRef.current = propsContextKey;
    clearScheduledReload();
    retryStateRef.current.attempts = 0;
    retryStateRef.current.contextKey = propsContextKey;
    loadingRef.current = { active: false, contextKey: propsContextKey };
    setNextRefreshAt(null);
  }, [propsContextKey, clearScheduledReload]);

  const filtered = useMemo(() => allocations, [allocations]);

  return {
    allocations: filtered,
    summary,
    loading,
    error,
    warningMessage,
    rateLimitInfo,
    refresh,
    updateAllocationStatus,
    lastUpdatedAt,
    nextRefreshAt,
  };
};

export default useLeadAllocations;
