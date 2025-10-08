import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, apiGet } from '@/lib/api.js';

const STATUS_COLORS = {
  ok: { dot: '#22c55e', bg: 'rgba(34,197,94,0.12)', fg: '#14532d' },
  unhealthy: { dot: '#ef4444', bg: 'rgba(239,68,68,0.12)', fg: '#7f1d1d' },
  unknown: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', fg: '#7c2d12' },
};

export default function HealthIndicator({ intervalMs = 30000 }) {
  const [status, setStatus] = useState('unknown');
  const [details, setDetails] = useState({});
  const fallbackOrigins = useMemo(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const origins = new Set();
    const normalizedBase = typeof API_BASE_URL === 'string' ? API_BASE_URL.trim() : '';
    if (normalizedBase) {
      origins.add(normalizedBase.replace(/\/$/, ''));
    }

    origins.add(window.location.origin.replace(/\/$/, ''));

    return Array.from(origins, (origin) => `${origin}/health`);
  }, []);

  const normalizeStatus = useCallback((value) => {
    if (typeof value !== 'string') {
      return 'unknown';
    }

    const normalized = value.trim().toLowerCase();
    if (['ok', 'healthy', 'up'].includes(normalized)) {
      return 'ok';
    }
    if (['down', 'unhealthy', 'error'].includes(normalized)) {
      return 'unhealthy';
    }
    return normalized || 'unknown';
  }, []);

  const normalizePayload = useCallback(
    (payload) => {
      if (!payload) {
        return { status: 'unknown', details: {} };
      }

      if (typeof payload === 'string') {
        return {
          status: normalizeStatus(payload),
          details: { message: payload },
        };
      }

      const candidateStatus =
        typeof payload.status === 'string'
          ? payload.status
          : typeof payload.state === 'string'
          ? payload.state
          : typeof payload.health === 'string'
          ? payload.health
          : payload.success === true
          ? 'ok'
          : 'unknown';

      return {
        status: normalizeStatus(candidateStatus),
        details: payload,
      };
    },
    [normalizeStatus]
  );

  const parseResponse = useCallback(async (response) => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json().catch(() => ({}));
    }

    const text = await response.text().catch(() => '');
    if (!text) {
      return {};
    }

    return { status: text, message: text };
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchHealth = async () => {
      try {
        const payload = await apiGet('/health');
        if (!alive) return;
        const normalized = normalizePayload(payload);
        setStatus(normalized.status);
        setDetails(normalized.details);
      } catch (err) {
        if (!alive) return;

        for (const url of fallbackOrigins) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              credentials: 'omit',
              cache: 'no-store',
              headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
              continue;
            }

            const payload = await parseResponse(response);
            if (!alive) return;

            const normalized = normalizePayload({ ...payload, source: url });
            setStatus(normalized.status);
            setDetails(normalized.details);
            return;
          } catch (fallbackError) {
            console.debug('Health check fallback failed', url, fallbackError);
          }
        }

        if (!alive) return;
        const errorPayload = {
          error: err instanceof Error ? err.message : String(err),
          status: err?.status ?? err?.statusCode ?? null,
          timestamp: new Date().toISOString(),
        };
        setStatus('unhealthy');
        setDetails(errorPayload);
      }
    };

    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [fallbackOrigins, intervalMs, normalizePayload, parseResponse]);

  const palette = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const title = status === 'ok' ? 'Serviço operacional' : status === 'unhealthy' ? 'Indisponível' : 'Desconhecido';

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
      style={{ background: palette.bg, color: palette.fg }}
      title={JSON.stringify(details)}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: palette.dot }}
        className="inline-block h-2.5 w-2.5 rounded-full"
      />
      <span>{title}</span>
    </div>
  );
}

