import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const STATUS_PAGE_URL = 'https://status.leadengine.com.br';

const extractStatusCode = (error) => {
  if (!error || typeof error !== 'object') return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.response?.status === 'number') return error.response.status;
  if (typeof error.statusCode === 'number') return error.statusCode;
  if (typeof error.response?.statusCode === 'number') {
    return error.response.statusCode;
  }
  return null;
};

const getActionableStatusMessage = (status) => {
  switch (status) {
    case 401:
    case 403:
      return 'Sessão expirada (Fase 1) – faça login novamente.';
    case 429:
      return 'Muitas requisições (Fase 2) – aguarde um instante e tente novamente.';
    case 500:
      return 'Erro interno do conector (Fase 3) – tente novamente em alguns instantes ou acione o time responsável.';
    case 502:
    case 503:
    case 504:
      return 'Conector de debug indisponível (Fase 3) – tente novamente em alguns minutos.';
    default:
      return null;
  }
};

const buildErrorState = (error, previousState) => {
  const status = extractStatusCode(error);
  const fallbackMessage =
    (error instanceof Error && error.message) ||
    (typeof error?.message === 'string' ? error.message : null) ||
    'Não foi possível carregar os logs do Baileys.';
  const message = getActionableStatusMessage(status) ?? fallbackMessage;
  const payload =
    error?.response?.data ?? error?.data ?? previousState?.payload ?? null;
  const requestId =
    typeof error?.response?.data?.error?.requestId === 'string'
      ? error.response.data.error.requestId
      : typeof error?.data?.error?.requestId === 'string'
        ? error.data.error.requestId
        : typeof payload?.error?.requestId === 'string'
          ? payload.error.requestId
          : null;
  const recoveryHint =
    typeof error?.response?.data?.error?.recoveryHint === 'string'
      ? error.response.data.error.recoveryHint
      : typeof error?.data?.error?.recoveryHint === 'string'
        ? error.data.error.recoveryHint
        : null;

  return {
    message,
    status,
    fallbackMessage,
    payload,
    timestamp: new Date().toISOString(),
    requestId,
    recoveryHint,
  };
};

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
  const [degradedMode, setDegradedMode] = useState(false);
  const controllerRef = useRef(null);

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

  const fetchLogs = useCallback(async (signal) => {
    if (signal?.aborted) {
      return;
    }

    setLoading(true);

    try {
      const query = buildQuery();
      const response = await apiGet(`/api/debug/baileys-events?${query}`, {
        signal,
      });
      const items = Array.isArray(response?.data) ? response.data : [];
      setLogs(items);
      setError(null);
      setDegradedMode(false);
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }

      setError((previous) => buildErrorState(err, previous));
      setDegradedMode(true);
      console.error('BaileysLogs: fetch failed', err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [buildQuery]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void fetchLogs(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchLogs]);

  const handleManualRefresh = useCallback(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void fetchLogs(controller.signal);
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
    <div className="space-y-6" data-degraded-mode={degradedMode ? 'true' : 'false'}>
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
        <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-amber-100">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <Badge
                  variant="outline"
                  className="border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-200 dark:bg-amber-200/10 dark:text-amber-50"
                >
                  Modo degradado ativo
                </Badge>
                {typeof error.status === 'number' ? (
                  <span className="text-amber-800/80 dark:text-amber-100/80">
                    Código {error.status}
                  </span>
                ) : null}
              </div>
              <p className="text-base font-medium text-amber-900 dark:text-amber-100">
                {error.message}
              </p>
              {error.fallbackMessage && error.fallbackMessage !== error.message ? (
                <p className="text-xs text-amber-800/70 dark:text-amber-100/70">
                  Detalhes técnicos: {error.fallbackMessage}
                </p>
              ) : null}
              {error.requestId ? (
                <p className="text-xs text-amber-800/70 dark:text-amber-100/70">
                  ID da falha: <code>{error.requestId}</code>
                </p>
              ) : null}
              {error.recoveryHint ? (
                <p className="text-xs text-amber-800/70 dark:text-amber-100/70">{error.recoveryHint}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={fetchLogs} disabled={loading}>
                {loading ? 'Recarregando…' : 'Tentar novamente'}
              </Button>
              <Button asChild variant="outline">
                <a
                  href={STATUS_PAGE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir status page
                </a>
              </Button>
            </div>
          </div>

          {error.payload ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:border-amber-200/30 dark:bg-amber-200/5 dark:text-amber-50">
              <p className="mb-2 font-semibold uppercase tracking-wide">
                Último payload recebido
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
                {stringifyJson(error.payload)}
              </pre>
            </div>
          ) : null}
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

              <ScrollArea
                className="rounded-md border border-border/60 bg-muted/40 p-3"
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
