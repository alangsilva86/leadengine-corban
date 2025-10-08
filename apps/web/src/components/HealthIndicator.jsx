import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api.js';

const STATUS_COLORS = {
  ok: {
    dot: 'var(--success)',
    bg: 'color-mix(in srgb, var(--success) 18%, transparent)',
    fg: 'color-mix(in srgb, var(--success) 38%, var(--foreground))',
    border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)',
  },
  unhealthy: {
    dot: 'var(--error)',
    bg: 'color-mix(in srgb, var(--error) 20%, transparent)',
    fg: 'color-mix(in srgb, var(--error) 40%, var(--foreground))',
    border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
  },
  unknown: {
    dot: 'var(--warning)',
    bg: 'color-mix(in srgb, var(--warning) 20%, transparent)',
    fg: 'color-mix(in srgb, var(--warning) 42%, var(--foreground))',
    border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
  },
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
      style={{ background: palette.bg, color: palette.fg, border: palette.border }}
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

