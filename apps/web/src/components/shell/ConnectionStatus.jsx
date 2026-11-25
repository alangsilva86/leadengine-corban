import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api.js';
import { TONE_DOT_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { useInstancesStore } from '@/features/whatsapp/state/store/index.ts';
import { resolveNormalizedInstanceStatus } from '@/features/whatsapp/lib/instances.ts';

const isHealthyPayload = (payload) => {
  const raw = typeof payload === 'string' ? payload : payload?.status ?? payload?.state ?? payload?.health;
  if (payload?.success === true) return true;
  return typeof raw === 'string' && ['ok', 'healthy', 'up'].includes(raw.trim().toLowerCase());
};

const useApiHealth = () =>
  useQuery({
    queryKey: ['shell', 'api-health'],
    queryFn: async () => isHealthyPayload(await apiGet('/health')),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 30_000,
  });

const useWhatsAppNumbersSummary = () => {
  const instances = useInstancesStore((state) => state.instances);
  const ready = useInstancesStore((state) => state.instancesReady);
  return useMemo(() => {
    const list = Array.isArray(instances) ? instances : [];
    const connected = list.filter((instance) => resolveNormalizedInstanceStatus(instance) === 'connected').length;
    return { total: list.length, connected, ready: Boolean(ready) };
  }, [instances, ready]);
};

/**
 * Um único indicador do que importa para quem atende: o servidor responde e os números estão conectados?
 * Antes mostrava "Serviço operacional" mesmo com o WhatsApp desconectado.
 */
export function ConnectionStatus({ canManageChannels = false }) {
  const health = useApiHealth();
  const numbers = useWhatsAppNumbersSummary();

  const apiState = health.isPending ? 'pending' : health.isError || health.data === false ? 'down' : 'up';

  const summary = (() => {
    if (apiState === 'down') {
      return { tone: 'danger', label: 'Sem conexão com o servidor' };
    }
    if (!numbers.ready || apiState === 'pending') {
      return { tone: 'pending', label: 'Verificando conexão…' };
    }
    if (numbers.total === 0) {
      return { tone: 'warning', label: 'Nenhum número conectado' };
    }
    const offline = numbers.total - numbers.connected;
    if (offline > 0) {
      return {
        tone: numbers.connected === 0 ? 'danger' : 'warning',
        label: offline === 1 ? '1 número desconectado' : `${offline} números desconectados`,
      };
    }
    return { tone: 'success', label: 'Tudo funcionando' };
  })();

  const numbersLine =
    numbers.total === 0
      ? 'Nenhum número cadastrado'
      : `${numbers.connected} de ${numbers.total} ${numbers.total === 1 ? 'número conectado' : 'números conectados'}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Status da conexão: ${summary.label}`}
        >
          {summary.tone === 'pending' ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <span className={cn('size-2 rounded-full', TONE_DOT_CLASSES[summary.tone])} aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{summary.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Status da conexão</p>
          <p className="text-xs text-muted-foreground">Atualizado automaticamente a cada minuto.</p>
        </div>
        <dl className="space-y-3 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Servidor</dt>
            <dd className="flex items-center gap-2 font-medium text-foreground">
              <span
                className={cn('size-2 rounded-full', apiState === 'up' ? 'bg-success' : apiState === 'down' ? 'bg-danger' : 'bg-subtle-foreground')}
                aria-hidden="true"
              />
              {apiState === 'up' ? 'Funcionando' : apiState === 'down' ? 'Indisponível' : 'Verificando…'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd className="flex items-center gap-2 font-medium text-foreground">
              <span
                className={cn(
                  'size-2 rounded-full',
                  numbers.total > 0 && numbers.connected === numbers.total
                    ? 'bg-success'
                    : numbers.connected > 0
                      ? 'bg-warning'
                      : 'bg-danger',
                )}
                aria-hidden="true"
              />
              {numbersLine}
            </dd>
          </div>
        </dl>
        {canManageChannels ? (
          <div className="border-t border-border p-2">
            <Link
              to="/channels"
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-surface-hover"
            >
              Gerenciar números
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export default ConnectionStatus;
