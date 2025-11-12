import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { formatMetricValue, formatTimestampLabel } from '../lib/formatting';
import InstanceSummaryCard from './InstanceSummaryCard.jsx';
import { AlertCircle, History, Inbox, Plus, RefreshCcw, Search } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'connected', label: 'Conectadas' },
  { value: 'attention', label: 'Atenção' },
  { value: 'disconnected', label: 'Desconectadas' },
];

const HEALTH_FILTERS = [
  { value: 'all', label: 'Saúde (todas)' },
  { value: 'alta', label: 'Saúde alta' },
  { value: 'media', label: 'Saúde média' },
  { value: 'baixa', label: 'Saúde baixa' },
];

const SORT_OPTIONS = [
  { value: 'health', label: 'Saúde (default)' },
  { value: 'name', label: 'Nome' },
  { value: 'updated', label: 'Última atualização' },
  { value: 'load', label: 'Carga (fila/15min)' },
];

const CONNECTION_STATUS_MAP = {
  success: 'connected',
  info: 'attention',
  warning: 'attention',
  destructive: 'attention',
  secondary: 'disconnected',
  default: 'disconnected',
};

const resolveConnectionState = (statusInfo) => {
  if (!statusInfo) {
    return 'disconnected';
  }
  return CONNECTION_STATUS_MAP[statusInfo.variant] ?? CONNECTION_STATUS_MAP.default;
};

const computeLoadLevel = (metrics = {}, ratePercentage = 0) => {
  const queued = Number(metrics.queued ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const usage = Number(ratePercentage ?? 0);

  if (queued > 50 || failed > 10 || usage >= 90) {
    return 'alta';
  }

  if (queued > 10 || failed > 0 || usage >= 75) {
    return 'media';
  }

  return 'baixa';
};

const computeHealthScore = (connectionState, metrics = {}, ratePercentage = 0) => {
  let score = 100;
  const queued = Number(metrics.queued ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const usage = Number(ratePercentage ?? 0);

  if (connectionState === 'attention') {
    score -= 25;
  }

  if (connectionState === 'disconnected') {
    score -= 60;
  }

  score -= Math.min(queued, 150) * 0.3;
  score -= Math.min(failed, 60) * 1.2;
  score -= Math.max(usage - 85, 0) * 1.5;

  return Math.max(0, Math.min(100, Math.round(score)));
};

const categorizeHealth = (score) => {
  if (score >= 70) return 'alta';
  if (score >= 40) return 'media';
  return 'baixa';
};

const resolveProvider = (instance) => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const record = instance;
  const metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  const providerCandidates = [
    record.provider,
    record.providerName,
    record.vendor,
    metadata.provider,
    metadata.providerName,
    metadata.vendor,
  ];

  for (const candidate of providerCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const resolveTimestamp = (instance) => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const candidates = [
    instance.syncedAt,
    instance.updatedAt,
    instance.lastSeen,
    instance.connectedAt,
    instance.createdAt,
  ];

  const timestamps = candidates
    .map((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter(Boolean);

  if (!timestamps.length) {
    return null;
  }

  return timestamps.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
};

const formatRelativeTime = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR });
  } catch {
    return formatTimestampLabel(date);
  }
};

const buildSearchBlob = (viewModel, provider) => {
  const blob = [
    viewModel.displayName,
    viewModel.formattedPhone,
    viewModel.phoneLabel,
    viewModel.instance?.id,
    viewModel.instance?.name,
    provider,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return blob;
};

const InstancesPanel = ({
  surfaceStyles,
  agreementDisplayName,
  selectedAgreementRegion,
  selectedAgreementId,
  selectedInstance,
  selectedInstanceStatusInfo,
  selectedInstancePhone,
  hasCampaign,
  campaign,
  instancesReady,
  hasHiddenInstances,
  hasRenderableInstances,
  instanceViewModels,
  instanceHealth,
  showFilterNotice,
  showAllInstances,
  instancesCountLabel,
  errorState,
  isBusy,
  isAuthenticated,
  loadingInstances,
  copy,
  localStatus,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onMarkConnected,
  onRefresh,
  onCreateInstance,
  onToggleShowAll,
  onShowAll,
  onRetry,
  onSelectInstance,
  onViewQr,
  onRequestDelete,
  deletingInstanceId,
  statusCodeMeta,
  onViewLogs,
  onRenameInstance,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('health');
  const [statusDrawerTarget, setStatusDrawerTarget] = useState(null);
  const [healthDrawerTarget, setHealthDrawerTarget] = useState(null);

  const normalizedStatusMeta = Array.isArray(statusCodeMeta) ? statusCodeMeta : [];

  const enrichedInstances = useMemo(() => {
    return instanceViewModels.map((viewModel) => {
      const connectionState = resolveConnectionState(viewModel.statusInfo);
      const loadLevel = computeLoadLevel(viewModel.metrics, viewModel.ratePercentage);
      const healthScore = computeHealthScore(connectionState, viewModel.metrics, viewModel.ratePercentage);
      const provider = resolveProvider(viewModel.instance);
      const lastTimestamp = resolveTimestamp(viewModel.instance);

      return {
        ...viewModel,
        connectionState,
        loadLevel,
        provider,
        healthScore,
        healthCategory: categorizeHealth(healthScore),
        queueSize: Number(viewModel.metrics?.queued ?? 0),
        failureCount: Number(viewModel.metrics?.failed ?? 0),
        usagePercentage: Number(viewModel.ratePercentage ?? 0),
        lastTimestamp,
        relativeUpdated: formatRelativeTime(lastTimestamp),
        searchBlob: buildSearchBlob(viewModel, provider),
      };
    });
  }, [instanceViewModels]);

  const providerOptions = useMemo(() => {
    const providers = new Set();
    enrichedInstances.forEach((item) => {
      if (item.provider) {
        providers.add(item.provider);
      }
    });
    return Array.from(providers).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedInstances]);

  const filteredInstances = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return enrichedInstances
      .filter((item) => {
        if (normalizedSearch && !item.searchBlob.includes(normalizedSearch)) {
          return false;
        }

        if (statusFilter !== 'all' && item.connectionState !== statusFilter) {
          return false;
        }

        if (healthFilter !== 'all' && item.healthCategory !== healthFilter) {
          return false;
        }

        if (providerFilter !== 'all') {
          if (!item.provider) {
            return false;
          }
          if (item.provider !== providerFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.displayName.localeCompare(b.displayName, 'pt-BR');
          case 'updated':
            return (b.lastTimestamp?.getTime() ?? 0) - (a.lastTimestamp?.getTime() ?? 0);
          case 'load':
            return b.queueSize - a.queueSize;
          case 'health':
          default:
            return b.healthScore - a.healthScore;
        }
      });
  }, [enrichedInstances, healthFilter, providerFilter, searchTerm, sortBy, statusFilter]);

  const summary = useMemo(() => {
    if (!instancesReady) {
      return { state: 'loading', totals: { connected: 0, attention: 0, disconnected: 0 }, queueTotal: 0, failureTotal: 0, usageAverage: 0, lastSyncLabel: '—', healthScore: 0, total: instanceViewModels.length };
    }

    if (enrichedInstances.length === 0) {
      return { state: 'empty', totals: { connected: 0, attention: 0, disconnected: 0 }, queueTotal: 0, failureTotal: 0, usageAverage: 0, lastSyncLabel: '—', healthScore: 0, total: 0 };
    }

    const totals = { connected: 0, attention: 0, disconnected: 0 };
    let queueTotal = 0;
    let failureTotal = 0;
    let usageAccumulator = 0;
    let usageCount = 0;
    let healthAccumulator = 0;
    let lastSyncDate = null;

    enrichedInstances.forEach((item) => {
      totals[item.connectionState] = (totals[item.connectionState] ?? 0) + 1;
      queueTotal += item.queueSize;
      failureTotal += item.failureCount;
      if (Number.isFinite(item.usagePercentage)) {
        usageAccumulator += item.usagePercentage;
        usageCount += 1;
      }
      healthAccumulator += item.healthScore;
      if (item.lastTimestamp) {
        if (!lastSyncDate || item.lastTimestamp.getTime() > lastSyncDate.getTime()) {
          lastSyncDate = item.lastTimestamp;
        }
      }
    });

    const usageAverage = usageCount ? Math.round(usageAccumulator / usageCount) : 0;
    const channelHealth = Math.round(healthAccumulator / enrichedInstances.length);
    const lastSyncLabel = formatRelativeTime(lastSyncDate);

    return {
      state: 'ready',
      totals,
      queueTotal,
      failureTotal,
      usageAverage,
      lastSyncLabel,
      healthScore: channelHealth,
      total: enrichedInstances.length,
    };
  }, [enrichedInstances, instanceViewModels.length, instancesReady]);

  const zeroInstances = summary.state === 'empty';
  const allDisconnected = summary.total > 0 && summary.totals.connected === 0;
  const highQueue = summary.queueTotal > 100;

  const activeInstances = filteredInstances.length;

  const statusDrawerData = statusDrawerTarget
    ? {
        meta: normalizedStatusMeta,
        metrics: statusDrawerTarget.statusValues ?? {},
        displayName: statusDrawerTarget.displayName,
      }
    : null;

  const healthDrawerData = healthDrawerTarget
    ? {
        displayName: healthDrawerTarget.displayName,
        metrics: healthDrawerTarget.metrics,
        queueSize: healthDrawerTarget.queueSize,
        failureCount: healthDrawerTarget.failureCount,
        usagePercentage: healthDrawerTarget.usagePercentage,
        relativeUpdated: healthDrawerTarget.relativeUpdated,
        healthScore: healthDrawerTarget.healthScore,
      }
    : null;

  return (
    <section className="space-y-6">
      <Card className="sticky top-16 z-10 space-y-6 border border-slate-800/60 bg-slate-950/80 p-6 backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-foreground">Instâncias &amp; Canais</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Conecte, monitore e mantenha saudáveis seus números de WhatsApp. Campanhas são configuradas em <strong>Campanhas</strong>.
              </p>
            </div>
            {summary.state === 'ready' ? (
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-wide">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-emerald-300">
                  Instâncias: {summary.totals.connected} ativas / {summary.totals.disconnected} desconectadas
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-200">
                  Fila total: {formatMetricValue(summary.queueTotal)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-200">
                  Falhas 24h: {formatMetricValue(summary.failureTotal)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-indigo-200">
                  Uso médio do limite: {summary.usageAverage}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-300">
                  Última sync: {summary.lastSyncLabel}
                </span>
              </div>
            ) : summary.state === 'loading' ? (
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-wide text-slate-400">
                <Badge variant="status" tone="info">Sincronizando instâncias…</Badge>
                <span>{instancesCountLabel}</span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma instância cadastrada.</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={loadingInstances || !isAuthenticated}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar lista
            </Button>
            <Button size="sm" onClick={onCreateInstance}>
              <Plus className="mr-2 h-4 w-4" /> Nova instância
            </Button>
            <Button size="sm" variant="outline" onClick={() => onViewLogs?.()} disabled={!onViewLogs}>
              <History className="mr-2 h-4 w-4" /> Ver logs de eventos
            </Button>
            {onConfirm ? (
              <Button size="sm" variant="ghost" onClick={onConfirm} disabled={confirmDisabled}>
                <Inbox className="mr-2 h-4 w-4" /> {confirmLabel || 'Ir para a Inbox'}
              </Button>
            ) : null}
          </div>
        </div>
        <Separator className="border-slate-800/60" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar instância por nome ou telefone"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Saúde" />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os provedores</SelectItem>
                {providerOptions.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="px-3 py-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {activeInstances} de {summary.total} exibidas
            </Badge>
          </div>
        </div>
        {showFilterNotice ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Mostrando apenas instâncias conectadas. Utilize os filtros para incluir sessões desconectadas.
          </div>
        ) : null}
      </Card>

      {highQueue ? (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">
          <strong>Fila elevada nas últimas 2h.</strong> Revise a distribuição por instância para equilibrar o tráfego.
        </div>
      ) : null}

      {allDisconnected ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Nenhum canal conectado. Gere um QR Code a partir do card da instância para ativar novamente.
        </div>
      ) : null}

      {!instancesReady ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="mt-4 h-16 w-full" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : hasRenderableInstances ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredInstances.map((viewModel) => (
            <InstanceSummaryCard
              key={viewModel.key}
              viewModel={viewModel}
              statusCodeMeta={statusCodeMeta}
              isBusy={isBusy}
              isAuthenticated={isAuthenticated}
              deletingInstanceId={deletingInstanceId}
              onSelectInstance={onSelectInstance}
              onViewQr={onViewQr}
              onRequestDelete={onRequestDelete}
              onOpenStatusDrawer={(instance) => setStatusDrawerTarget(instance)}
              onOpenHealthDrawer={(instance) => setHealthDrawerTarget(instance)}
              onRenameInstance={onRenameInstance}
              onViewLogs={(instance) => onViewLogs?.(instance.instance ?? instance)}
            />
          ))}
        </div>
      ) : hasHiddenInstances ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-6 text-center text-sm text-muted-foreground">
          <p>Nenhuma instância conectada no momento. Ajuste os filtros para gerenciar sessões desconectadas.</p>
          <Button size="sm" className="mt-4" onClick={onShowAll} disabled={isBusy}>
            Mostrar todas
          </Button>
        </div>
      ) : zeroInstances ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground">Crie sua primeira instância</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure um canal do WhatsApp para começar a operar com o Lead Engine.
          </p>
          <Button size="sm" className="mt-4" onClick={onCreateInstance}>
            Nova instância
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-6 text-center text-sm text-muted-foreground">
          <p>Nenhuma instância encontrada para os filtros aplicados.</p>
          <Button size="sm" className="mt-4" variant="outline" onClick={() => setSearchTerm('')}>
            Limpar filtros
          </Button>
        </div>
      )}

      {errorState ? (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{errorState.title ?? 'Algo deu errado'}</p>
            <p className="text-rose-100/80">{errorState.message}</p>
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      <Drawer
        open={Boolean(statusDrawerTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDrawerTarget(null);
          }
        }}
        direction="right"
      >
        <DrawerContent className="w-full bg-slate-950 text-slate-100 sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Status da instância</DrawerTitle>
            <DrawerDescription>Códigos recentes para {statusDrawerData?.displayName}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            {statusDrawerData ? (
              statusDrawerData.meta.map((meta) => {
                const value = statusDrawerData.metrics?.[meta.code] ?? 0;
                return (
                  <div key={meta.code} className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-sm font-semibold">Código {meta.label}</p>
                        <p className="text-xs text-slate-400">{meta.description}</p>
                      </div>
                      <span className="text-lg font-semibold text-foreground">{formatMetricValue(value)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-3 h-8 px-2 text-xs uppercase"
                      onClick={() => {
                        onViewLogs?.(statusDrawerTarget?.instance ?? statusDrawerTarget);
                      }}
                    >
                      Ver no log
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado de status disponível.</p>
            )}
          </div>
          <div className="px-4 pb-4">
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="w-full">
                Fechar
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(healthDrawerTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setHealthDrawerTarget(null);
          }
        }}
        direction="right"
      >
        <DrawerContent className="w-full bg-slate-950 text-slate-100 sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Saúde do canal</DrawerTitle>
            <DrawerDescription>{healthDrawerData?.displayName}</DrawerDescription>
          </DrawerHeader>
          {healthDrawerData ? (
            <div className="space-y-4 px-4 pb-6">
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Health score</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{healthDrawerData.healthScore}</p>
                <p className="mt-1 text-xs text-slate-400">Atualizado {healthDrawerData.relativeUpdated}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Fila</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatMetricValue(healthDrawerData.queueSize)}</p>
                </div>
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Falhas 24h</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatMetricValue(healthDrawerData.failureCount)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Utilização do limite</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      healthDrawerData.usagePercentage >= 80 ? 'bg-rose-500' : 'bg-indigo-500',
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, healthDrawerData.usagePercentage))}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-300">Uso atual: {healthDrawerData.usagePercentage}%</p>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Ações rápidas</p>
                <div className="mt-3 grid gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onRefresh?.()}>
                    Forçar sync
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onViewLogs?.(healthDrawerTarget?.instance ?? healthDrawerTarget)}>
                    Ver mensagens recentes
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-6 text-sm text-muted-foreground">Nenhum dado disponível.</div>
          )}
          <div className="px-4 pb-4">
            <DrawerClose asChild>
              <Button variant="outline" size="sm" className="w-full">
                Fechar
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default InstancesPanel;
