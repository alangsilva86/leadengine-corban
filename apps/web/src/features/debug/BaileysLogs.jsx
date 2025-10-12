import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { apiGet } from '@/lib/api.js';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const LIMIT_OPTIONS = [20, 50, 100, 150];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
};

const directionTone = {
  inbound: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  outbound: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
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
  const [tenantId, setTenantId] = useState('');
  const [chatId, setChatId] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (direction !== 'all') {
      params.set('direction', direction);
    }
    if (tenantId.trim().length > 0) {
      params.set('tenantId', tenantId.trim());
    }
    if (chatId.trim().length > 0) {
      params.set('chatId', chatId.trim());
    }
    return params.toString();
  }, [chatId, direction, limit, tenantId]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = buildQuery();
      const response = await apiGet(`/api/debug/baileys-events?${query}`);
      const items = Array.isArray(response?.data) ? response.data : [];
      setLogs(items);
    } catch (err) {
      const message =
        err?.message ?? 'Não foi possível carregar os logs do Baileys.';
      setError(message);
      console.error('BaileysLogs: fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLogs();
    return () => controller.abort();
  }, [fetchLogs]);

  const summary = useMemo(() => {
    if (!logs.length) {
      return null;
    }
    const latest = logs[0];
    return {
      lastDirection: latest.direction ?? '—',
      lastTenant: latest.tenantId ?? '—',
      lastInstance: latest.instanceId ?? '—',
      lastChatId: latest.chatId ?? '—',
      lastReceivedAt: formatDateTime(latest.createdAt),
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Logs do Baileys
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize os payloads recebidos do conector Baileys para diagnosticar
            diferenças de formato entre instâncias.
          </p>
        </div>

        <Card className="border border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Limite
                </label>
                <Select
                  value={String(limit)}
                  onValueChange={(value) => setLimit(Number(value))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Limite" />
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
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Direção
                </label>
                <Select
                  value={direction}
                  onValueChange={setDirection}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Direção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Tenant
                </label>
                <Input
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                  placeholder="Ex: demo-tenant"
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Chat / remoteJid
                </label>
                <Input
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
                  setTenantId('');
                  setChatId('');
                }}
                disabled={loading}
              >
                Limpar
              </Button>
              <Button
                type="button"
                onClick={fetchLogs}
                disabled={loading}
              >
                {loading ? 'Atualizando…' : 'Atualizar'}
              </Button>
            </div>
          </div>

          {summary ? (
            <>
              <Separator className="my-4" />
              <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-5">
                <div>
                  <span className="text-xs uppercase text-muted-foreground/70">
                    Última mensagem
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastDirection}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground/70">
                    Tenant
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastTenant}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground/70">
                    Instância
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastInstance}
                  </p>
                </div>
                <div className="truncate">
                  <span className="text-xs uppercase text-muted-foreground/70">
                    Chat
                  </span>
                  <p className="font-medium text-foreground">
                    {summary.lastChatId}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground/70">
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
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!logs.length && !loading ? (
        <div className="rounded-lg border border-border/60 bg-muted/50 p-8 text-center text-sm text-muted-foreground">
          Nenhum payload do Baileys encontrado para os filtros informados.
        </div>
      ) : null}

      <div className="space-y-4">
        {logs.map((entry) => {
          const directionToneClass =
            directionTone[entry.direction] ?? 'bg-muted text-muted-foreground';
          return (
            <Card
              key={entry.id}
              className="border border-border/60 bg-card/80 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className={directionToneClass}>
                  {entry.direction ?? '—'}
                </Badge>
                <Badge variant="outline">
                  tenant: {entry.tenantId ?? '—'}
                </Badge>
                <Badge variant="outline">
                  iid: {entry.instanceId ?? '—'}
                </Badge>
                  <Badge variant="outline">
                    chat: {entry.chatId ?? '—'}
                  </Badge>
                  <Badge variant="outline">
                    msg: {entry.messageId ?? '—'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </p>
              </div>

              <Separator className="my-3" />

              <ScrollArea className="max-h-[320px] rounded-md border border-border/60 bg-muted/40 p-3">
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
