import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPatch } from '@/lib/api.js';
import { computeBackoffDelay, parseRetryAfterMs } from '@/lib/rate-limit.js';
import useRateLimitBanner from '@/hooks/useRateLimitBanner.js';
import usePlayfulLogger from '../../../shared/usePlayfulLogger.js';

const AUTO_REFRESH_INTERVAL_MS = 15000;

const initialSummary = { total: 0, contacted: 0, won: 0, lost: 0 };

export const useLeadAllocations = ({ agreementId, campaignId }) => {
  const { log, warn, error: logError } = usePlayfulLogger('✨ LeadEngine • Inbox');
  const rateLimitInfo = useRateLimitBanner();

  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warningMessage, setWarningMessage] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(null);

  const loadingRef = useRef(false);
  const retryStateRef = useRef({ attempts: 0, timeoutId: null });
  const loadAllocationsRef = useRef(async () => {});

  const clearScheduledReload = useCallback(() => {
    if (retryStateRef.current.timeoutId) {
      clearTimeout(retryStateRef.current.timeoutId);
      retryStateRef.current.timeoutId = null;
    }
  }, []);

  const scheduleNextLoad = useCallback(
    (delayMs, mode = 'success') => {
      clearScheduledReload();

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
    if (!agreementId && !campaignId) {
      setAllocations([]);
      setSummary(initialSummary);
      setWarningMessage(null);
      setError(null);
      setNextRefreshAt(null);
      return;
    }
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      setLoading(true);
      clearScheduledReload();

      log('📮 Sincronizando leads', {
        campaignId,
        agreementId,
      });

      const params = new URLSearchParams();
      if (campaignId) params.set('campaignId', campaignId);
      else if (agreementId) params.set('agreementId', agreementId);

      const payload = await apiGet(`/api/lead-engine/allocations?${params.toString()}`);
      const items = Array.isArray(payload?.data) ? payload.data : [];

      if (items.length === 0) {
        warn('Nenhum lead disponível no momento', {
          campaignId,
          agreementId,
        });
      }

      setAllocations(items);
      setSummary(computeSummary(items));
      setWarningMessage(Array.isArray(payload?.meta?.warnings) && payload.meta.warnings.length ? payload.meta.warnings[0] : null);
      setError(null);
      setLastUpdatedAt(new Date());
      scheduleNextLoad(undefined, 'success');

      log('✅ Leads sincronizados', {
        total: items.length,
        campaignId,
        agreementId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar leads';
      const status = err?.status ?? err?.statusCode;
      const retryAfterMs = parseRetryAfterMs(err?.retryAfter ?? err?.payload?.retryAfter ?? err?.rateLimitDelayMs);

      if (status === 429 || status === 503 || (typeof status === 'number' && status >= 500)) {
        const waitMs = scheduleNextLoad(retryAfterMs, 'retry');
        const seconds = Math.ceil(waitMs / 1000);
        setError(`Muitas requisições. Nova tentativa em ${seconds}s.`);
        warn('Broker sinalizou limite ao carregar leads', {
          campaignId,
          agreementId,
          status,
          retryAfterMs,
        });
      } else {
        setWarningMessage(null);
        setError(message);
        scheduleNextLoad(undefined, 'success');
      }

      logError('Falha ao sincronizar leads', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agreementId, campaignId, clearScheduledReload, computeSummary, log, logError, scheduleNextLoad, warn]);

  const refresh = useCallback(() => {
    scheduleNextLoad(undefined, 'success');
    return fetchAllocations();
  }, [fetchAllocations, scheduleNextLoad]);

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
    fetchAllocations();
    return () => {
      clearScheduledReload();
    };
  }, [fetchAllocations, clearScheduledReload]);

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
