import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api.js';

const STATUS_COLORS = {
  ok: { dot: '#22c55e', bg: 'rgba(34,197,94,0.12)', fg: '#14532d' },
  unhealthy: { dot: '#ef4444', bg: 'rgba(239,68,68,0.12)', fg: '#7f1d1d' },
  unknown: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', fg: '#7c2d12' },
};

export default function HealthIndicator({ intervalMs = 30000 }) {
  const [status, setStatus] = useState('unknown');
  const [details, setDetails] = useState({});

  useEffect(() => {
    let alive = true;
    const fetchHealth = async () => {
      try {
        const payload = await apiGet('/health');
        if (!alive) return;
        const st = payload?.status ?? 'unknown';
        setStatus(st);
        setDetails(payload);
      } catch (err) {
        if (!alive) return;
        setStatus('unhealthy');
        setDetails({ error: err instanceof Error ? err.message : String(err) });
      }
    };

    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

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

