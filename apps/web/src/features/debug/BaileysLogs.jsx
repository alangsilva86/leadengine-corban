import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Activity, RotateCw } from 'lucide-react';
import { EmptyState } from '@/components/page/EmptyState.jsx';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { formatDateTime, useBaileysEvents } from './hooks/useBaileysEvents.ts';

const LIMIT_OPTIONS = [20, 50, 100, 150];
const STATUS_PAGE_URL = 'https://status.leadengine.com.br';

const DIRECTION_LABEL = { inbound: 'Recebida', outbound: 'Enviada' };
const directionTone = {
  inbound: 'bg-success-soft text-success-soft-foreground',
  outbound: 'bg-info-soft text-info-soft-foreground',
};

const stringifyJson = (value) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return '<< não foi possível serializar o payload >>';
  }
};

const BaileysLogs = () => {
  const [limit, setLimit] = useState(50);
  const [direction, setDirection] = useState('all');
  const [chatId, setChatId] = useState('');

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (direction !== 'all') {
      params.set('direction', direction);
    }
    if (chatId.trim().length > 0) {
      params.set('chatId', chatId.trim());
    }
    return params.toString();
  }, [chatId, direction, limit]);

  const { events: logs, loading, error, degradedMode, refresh } = useBaileysEvents({
    buildQuery,
    dependencies: [buildQuery],
  });

  const handleManualRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    if (!logs.length) {
      return null;
    }
    const latest = logs[0];
    return {
      lastDirection: latest.direction ?? '—',
      lastInstance: latest.instanceId ?? '—',
      lastChatId: latest.chatId ?? '—',
      lastReceivedAt: formatDateTime(latest.createdAt),
    };
  }, [logs]);

  return (
    <div className="space-y-6" data-degraded-mode={degradedMode ? 'true' : 'false'}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Diagnóstico do WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Eventos brutos recebidos dos seus números. Use para investigar mensagens que não chegaram ao Inbox
            ou chegaram com formato inesperado.
          </p>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="diag-limit" className="text-sm font-medium text-foreground">
                  Quantidade
                </label>
                <Select
                  value={String(limit)}
                  onValueChange={(value) => setLimit(Number(value))}
                  disabled={loading}
                >
                  <SelectTrigger id="diag-limit">
                    <SelectValue placeholder="Quantidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="diag-direction" className="text-sm font-medium text-foreground">
                  Direção
                </label>
                <Select
                  value={direction}
                  onValueChange={setDirection}
                  disabled={loading}
                >
                  <SelectTrigger id="diag-direction">
                    <SelectValue placeholder="Direção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="inbound">Recebidas</SelectItem>
                    <SelectItem value="outbound">Enviadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="diag-chat" className="text-sm font-medium text-foreground">
                  Conversa (ID do WhatsApp)
                </label>
                <Input
                  id="diag-chat"
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  placeholder="Ex: 5562...@s.whatsapp.net"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChatId('');
                  setDirection('all');
                }}
                disabled={loading}
              >
                Limpar filtros
              </Button>
              <Button
                type="button"
                onClick={handleManualRefresh}
                disabled={loading}
              >
                {loading ? 'Atualizando…' : 'Atualizar'}
              </Button>
            </div>
          </div>

          {summary ? (
            <>
              <Separator className="my-4" />
              <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Último evento
                  </span>
                  <p className="font-medium text-foreground">
                    {DIRECTION_LABEL[summary.lastDirection] ?? summary.lastDirection}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Número (ID)
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastInstance}
                  </p>
                </div>
                <div className="truncate">
                  <span className="text-xs text-muted-foreground">
                    Conversa
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastChatId}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Recebido em
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastReceivedAt}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-warning-soft-border bg-warning-soft p-4 text-sm text-warning-soft-foreground">
          <div className="space-y-1">
            <p className="font-medium">Não foi possível carregar os eventos.</p>
            <p>
              {error.status === 404
                ? 'O registro de eventos do WhatsApp não está ativado neste ambiente.'
                : getFriendlyErrorMessage(error)}
            </p>
            {error.recoveryHint ? <p className="text-xs">{error.recoveryHint}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RotateCw aria-hidden="true" />
              {loading ? 'Recarregando…' : 'Tentar novamente'}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={STATUS_PAGE_URL} target="_blank" rel="noreferrer">
                Ver status do serviço
              </a>
            </Button>
          </div>
          {typeof error.status === 'number' || error.requestId || error.payload ? (
            <details className="text-xs">
              <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
              <div className="mt-2 space-y-1 font-mono">
                {typeof error.status === 'number' ? <p>HTTP {error.status}</p> : null}
                {error.requestId ? <p>ID da falha: {error.requestId}</p> : null}
                {error.payload ? (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{stringifyJson(error.payload)}</pre>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {!logs.length && !loading && !error ? (
        <Card className="p-0">
          <EmptyState
            icon={Activity}
            title="Nenhum evento encontrado"
            description="Quando seus números receberem ou enviarem mensagens, os eventos aparecem aqui."
          />
        </Card>
      ) : null}

      <div className="space-y-4">
        {logs.map((entry) => {
          const directionToneClass =
            directionTone[entry.direction] ?? 'bg-muted text-muted-foreground';
          return (
            <Card
              key={entry.id}
              className="gap-0 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className={directionToneClass}>
                  {DIRECTION_LABEL[entry.direction] ?? entry.direction ?? '—'}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  número: {entry.instanceId ?? '—'}
                </Badge>
                  <Badge variant="outline" className="font-mono">
                    conversa: {entry.chatId ?? '—'}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    mensagem: {entry.messageId ?? '—'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </p>
              </div>

              <Separator className="my-3" />

              <ScrollArea
                className="rounded-md border border-border bg-surface-sunken p-3"
                viewportProps={{ className: 'max-h-[320px] overflow-auto' }}
              >
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {stringifyJson(entry.payload)}
                </pre>
              </ScrollArea>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BaileysLogs;
