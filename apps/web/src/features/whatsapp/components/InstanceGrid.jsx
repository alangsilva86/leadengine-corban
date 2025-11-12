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
    );
  }

  return (
    <div className="space-y-4">
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

      {hasRenderableInstances ? (
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
          <Button size="sm" className="mt-4" onClick={onCreateInstance}>
            Nova instância
          </Button>
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
