import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api.js';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const INSTANCES_ENDPOINT = '/api/integrations/whatsapp/instances?refresh=1';
const BAILEYS_EVENTS_ENDPOINT = '/api/debug/baileys-events?limit=25';

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object');
  }
  return [];
};

const parseInstances = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidateRoots = [payload.data, payload.result, payload];
  for (const root of candidateRoots) {
    if (!root || typeof root !== 'object') {
      continue;
    }
    if (Array.isArray(root.instances)) {
      return toArray(root.instances);
    }
    if (Array.isArray(root.items)) {
      return toArray(root.items);
    }
    if (Array.isArray(root.data)) {
      return toArray(root.data);
    }
  }

  if (Array.isArray(payload)) {
    return toArray(payload);
  }

  return [];
};

const parseEvents = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};

const getInstanceStatus = (instance) => {
  if (!instance || typeof instance !== 'object') {
    return 'unknown';
  }

  if (typeof instance.connected === 'boolean') {
    return instance.connected ? 'connected' : 'disconnected';
  }

  if (typeof instance.status === 'string') {
    return instance.status.toLowerCase();
  }

  return 'unknown';
};

const getStatusTone = (status) => {
  switch (status) {
    case 'connected':
      return 'success';
    case 'connecting':
    case 'qr':
    case 'pending':
      return 'warning';
    case 'disconnected':
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
};

const buildErrorMessage = (error, defaultMessage) => {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error?.message === 'string') {
    return error.message;
  }
  if (typeof error?.status === 'number') {
    return `Falha ao carregar dados (status ${error.status}).`;
  }
  if (typeof error?.response?.status === 'number') {
    return `Falha ao carregar dados (status ${error.response.status}).`;
  }
  return defaultMessage;
};

const WhatsAppDebug = () => {
  const [instancesState, setInstancesState] = useState({
    loading: true,
    error: null,
    items: [],
    updatedAt: null,
  });
  const [eventsState, setEventsState] = useState({
    loading: true,
    error: null,
    items: [],
    updatedAt: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const controllerRef = useRef(null);

  const refreshData = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setRefreshing(true);
    setInstancesState((prev) => ({ ...prev, loading: true, error: null }));
    setEventsState((prev) => ({ ...prev, loading: true, error: null }));

    const [instancesResult, eventsResult] = await Promise.allSettled([
      apiGet(INSTANCES_ENDPOINT, { signal: controller.signal }),
      apiGet(BAILEYS_EVENTS_ENDPOINT, { signal: controller.signal }),
    ]);

    if (controller.signal.aborted) {
      return;
    }

    if (instancesResult.status === 'fulfilled') {
      setInstancesState({
        loading: false,
        error: null,
        updatedAt: Date.now(),
        items: parseInstances(instancesResult.value),
      });
    } else {
      setInstancesState({
        loading: false,
        error: buildErrorMessage(instancesResult.reason, 'Não foi possível carregar as instâncias.'),
        updatedAt: Date.now(),
        items: [],
      });
    }

    if (eventsResult.status === 'fulfilled') {
      setEventsState({
        loading: false,
        error: null,
        updatedAt: Date.now(),
        items: parseEvents(eventsResult.value),
      });
    } else {
      setEventsState({
        loading: false,
        error: buildErrorMessage(eventsResult.reason, 'Não foi possível carregar os eventos recentes.'),
        updatedAt: Date.now(),
        items: [],
      });
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refreshData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [refreshData]);

  const summary = useMemo(() => {
    const totalInstances = instancesState.items.length;
    const connectedInstances = instancesState.items.filter(
      (item) => getInstanceStatus(item) === 'connected'
    ).length;
    const disconnectedInstances = instancesState.items.filter((item) => {
      const status = getInstanceStatus(item);
      return status === 'disconnected' || status === 'error';
    }).length;
    const lastEvent = eventsState.items.length > 0 ? eventsState.items[0] : null;

    return {
      totalInstances,
      connectedInstances,
      disconnectedInstances,
      lastEventDirection: lastEvent?.direction ?? '—',
      lastEventTenant: lastEvent?.tenantId ?? lastEvent?.tenant ?? '—',
      lastEventAt: lastEvent?.createdAt ?? lastEvent?.timestamp ?? null,
    };
  }, [eventsState.items, instancesState.items]);

  return (
    <div className="space-y-6" data-testid="whatsapp-debug">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Debug do WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento rápido das instâncias WhatsApp e dos eventos recentes recebidos pelo conector.
          </p>
        </div>
        <Button onClick={refreshData} disabled={refreshing} variant="outline">
          {refreshing ? 'Atualizando…' : 'Atualizar dados'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3" data-columns="whatsapp-debug">
        <Card className="flex flex-col gap-4 p-4" data-column="instances">
          <div>
            <h2 className="text-lg font-semibold">Instâncias configuradas</h2>
            <p className="text-sm text-muted-foreground">
              Lista das instâncias conhecidas pela API e seus estados atuais.
            </p>
          </div>

          {instancesState.loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Carregando instâncias…
            </div>
          ) : instancesState.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {instancesState.error}
            </div>
          ) : instancesState.items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              Nenhuma instância encontrada.
            </div>
          ) : (
            <ScrollArea className="max-h-[420px] pr-3">
              <ul className="space-y-3">
                {instancesState.items.map((instance, index) => {
                  const status = getInstanceStatus(instance);
                  const key = instance.id ?? instance.name ?? `instance-${index}`;
                  return (
                    <li key={key} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium leading-tight">
                            {instance.name ?? instance.id ?? 'Instância sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {instance.id ?? 'ID não informado'}
                          </p>
                        </div>
                        <Badge variant={getStatusTone(status)} className="whitespace-nowrap">
                          {status === 'connected'
                            ? 'Conectada'
                            : status === 'disconnected'
                              ? 'Desconectada'
                              : status === 'qr'
                                ? 'QR code'
                                : status === 'connecting'
                                  ? 'Conectando'
                                  : status === 'error'
                                    ? 'Erro'
                                    : 'Desconhecido'}
                        </Badge>
                      </div>

                      <Separator className="my-3" />

                      <dl className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-foreground">Número</dt>
                          <dd>{instance.phone ?? instance.msisdn ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">Tenant</dt>
                          <dd>{instance.tenantId ?? instance.tenant ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">Atualizado em</dt>
                          <dd>{formatDateTime(instance.updatedAt ?? instance.updated_at)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">Última sessão</dt>
                          <dd>{formatDateTime(instance.lastSeenAt ?? instance.last_seen)}</dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}

          {instancesState.updatedAt ? (
            <p className="text-right text-xs text-muted-foreground">
              Atualizado em {formatDateTime(instancesState.updatedAt)}
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-4 p-4" data-column="events">
          <div>
            <h2 className="text-lg font-semibold">Eventos recentes</h2>
            <p className="text-sm text-muted-foreground">
              Snapshot dos últimos eventos recebidos via conector Baileys para análise rápida.
            </p>
          </div>

          {eventsState.loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Carregando eventos…
            </div>
          ) : eventsState.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {eventsState.error}
            </div>
          ) : eventsState.items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              Nenhum evento recente disponível.
            </div>
          ) : (
            <ScrollArea className="max-h-[420px] pr-3">
              <ul className="space-y-3">
                {eventsState.items.map((event, index) => (
                  <li key={event.id ?? `${event.chatId ?? 'event'}-${index}`} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium leading-tight">
                          {event.type ?? event.eventType ?? 'Evento desconhecido'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.chatId ?? event.keyId ?? 'Sem chatId'}
                        </p>
                      </div>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {event.direction ?? '—'}
                      </Badge>
                    </div>
                    <Separator className="my-3" />
                    <dl className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-foreground">Tenant</dt>
                        <dd>{event.tenantId ?? event.tenant ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Instância</dt>
                        <dd>{event.instanceId ?? event.instance ?? '—'}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-foreground">Recebido em</dt>
                        <dd>{formatDateTime(event.createdAt ?? event.timestamp)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          {eventsState.updatedAt ? (
            <p className="text-right text-xs text-muted-foreground">
              Atualizado em {formatDateTime(eventsState.updatedAt)}
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-4 p-4" data-column="insights">
          <div>
            <h2 className="text-lg font-semibold">Insights operacionais</h2>
            <p className="text-sm text-muted-foreground">
              Indicadores de saúde consolidados para agilizar o diagnóstico de incidentes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-xs uppercase text-muted-foreground">Instâncias monitoradas</p>
              <p className="text-2xl font-semibold">{summary.totalInstances}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
              <p className="text-xs uppercase opacity-80">Instâncias conectadas</p>
              <p className="text-2xl font-semibold">{summary.connectedInstances}</p>
            </div>
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
              <p className="text-xs uppercase opacity-80">Instâncias com atenção</p>
              <p className="text-2xl font-semibold">{summary.disconnectedInstances}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Último evento</p>
              <p className="font-medium text-foreground">
                {summary.lastEventDirection === 'inbound'
                  ? 'Mensagem recebida'
                  : summary.lastEventDirection === 'outbound'
                    ? 'Mensagem enviada'
                    : 'Sem dados recentes'}
              </p>
              <p className="text-xs text-muted-foreground">
                Tenant: {summary.lastEventTenant ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.lastEventAt ? `Registrado em ${formatDateTime(summary.lastEventAt)}` : 'Sem horário registrado'}
              </p>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Ferramentas rápidas</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Validar instâncias na aba <strong>Logs Baileys</strong> para checar payloads brutos.
                </li>
                <li>
                  Confirmar se o broker responde ao health-check <code className="rounded bg-muted px-1 py-0.5">/api/integrations/whatsapp/instances</code>.
                </li>
                <li>
                  Acionar o time responsável quando duas ou mais instâncias estiverem desconectadas simultaneamente.
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppDebug;
