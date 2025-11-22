import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import InstanceSummaryCard from './InstanceSummaryCard.jsx';

const InstanceGrid = ({
  instancesReady,
  filteredInstances,
  statusCodeMeta,
  isBusy,
  isAuthenticated,
  deletingInstanceId,
  hasRenderableInstances,
  hasHiddenInstances,
  zeroInstances,
  onShowAll,
  onCreateInstance,
  createInstanceDisabled = false,
  createInstanceWarning = null,
  onSelectInstance,
  onViewQr,
  onRequestDelete,
  onOpenStatusDrawer,
  onOpenHealthDrawer,
  onRenameInstance,
  onViewLogs,
  highQueue,
  allDisconnected,
  onClearFilters,
}) => {
  if (!instancesReady) {
    return (
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4 shadow-inner">
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
    );
  }

  return (
    <div className="space-y-4">
      {highQueue || allDisconnected ? (
        <div className="flex flex-wrap items-center gap-2">
          {highQueue ? (
            <Badge className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-[0.65rem] text-indigo-100">
              Fila elevada nas últimas 2h
            </Badge>
          ) : null}
          {allDisconnected ? (
            <Badge className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[0.65rem] text-amber-100">
              Nenhum canal conectado
            </Badge>
          ) : null}
        </div>
      ) : null}

      {hasRenderableInstances ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
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
              onOpenStatusDrawer={onOpenStatusDrawer}
              onOpenHealthDrawer={onOpenHealthDrawer}
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
          <Button
            size="sm"
            className="mt-4"
            onClick={onCreateInstance}
            disabled={isBusy || createInstanceDisabled}
          >
            Nova instância
          </Button>
          {createInstanceWarning ? (
            <p className="mt-2 text-xs text-amber-200">{createInstanceWarning}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 p-6 text-center text-sm text-muted-foreground">
          <p>Nenhuma instância encontrada para os filtros aplicados.</p>
          <Button size="sm" className="mt-4" variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
};

export default InstanceGrid;
