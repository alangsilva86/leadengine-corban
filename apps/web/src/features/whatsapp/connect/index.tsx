import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';

import { ErrorState, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';

import useWhatsAppNumbers, { type WhatsAppNumber } from '../hooks/useWhatsAppNumbers';
import ConnectNumberSheet from '../components/numbers/ConnectNumberSheet';
import NumberDetailsSheet from '../components/numbers/NumberDetailsSheet';
import NumbersEmptyState from '../components/numbers/NumbersEmptyState';
import NumbersList from '../components/numbers/NumbersList';
import RemoveNumberDialog, { type RemoveMode } from '../components/numbers/RemoveNumberDialog';
import type { NumberAction } from '../components/numbers/NumberActionsMenu';

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

/** Próximo nome livre no padrão "Comercial N". */
export const suggestNumberName = (numbers: Array<{ name: string }>) => {
  const taken = new Set(numbers.map((item) => item.name.trim().toLowerCase()));
  let index = 1;
  while (taken.has(`comercial ${index}`)) index += 1;
  return `Comercial ${index}`;
};

const ListSkeleton = () => (
  <div aria-busy="true" aria-label="Carregando números" className="rounded-xl border border-border bg-surface shadow-xs">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="flex items-center gap-6 border-b border-border px-5 py-4 last:border-b-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="hidden h-4 w-36 sm:block" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="ml-auto h-8 w-24" />
      </div>
    ))}
  </div>
);

const WhatsAppConnect = () => {
  const numbers = useWhatsAppNumbers();
  const [searchParams, setSearchParams] = useSearchParams();

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState<WhatsAppNumber | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ number: WhatsAppNumber; mode: RemoveMode } | null>(null);

  const { counts } = numbers;
  const hasNumbers = numbers.numbers.length > 0;
  const detailsNumber = useMemo(
    () => (detailsId ? numbers.numbers.find((item) => item.id === detailsId) ?? null : null),
    [detailsId, numbers.numbers],
  );
  const suggestedName = useMemo(() => suggestNumberName(numbers.numbers), [numbers.numbers]);

  const openConnect = useCallback((target: WhatsAppNumber | null = null) => {
    setDetailsId(null);
    setConnectTarget(target);
    setConnectOpen(true);
  }, []);

  // Atalho vindo de outras telas: /channels?connect=1 abre o assistente.
  useEffect(() => {
    if (searchParams.get('connect') !== '1' || !numbers.ready) return;
    if (numbers.canCreate) openConnect(null);
    const next = new URLSearchParams(searchParams);
    next.delete('connect');
    setSearchParams(next, { replace: true });
  }, [numbers.canCreate, numbers.ready, openConnect, searchParams, setSearchParams]);

  const handleAction = useCallback(
    (action: NumberAction, number: WhatsAppNumber) => {
      switch (action) {
        case 'details':
          setDetailsId(number.id);
          break;
        case 'connect':
          openConnect(number);
          break;
        case 'disconnect':
        case 'delete':
          setRemoval({ number, mode: action });
          break;
        default:
          break;
      }
    },
    [openConnect],
  );

  const handleRemove = useCallback(
    async (number: WhatsAppNumber, mode: RemoveMode) => {
      if (mode === 'delete') {
        await numbers.removeNumber(number);
        setDetailsId((current) => (current === number.id ? null : current));
      } else {
        await numbers.disconnectNumber(number);
      }
    },
    [numbers.disconnectNumber, numbers.removeNumber],
  );

  const meta = hasNumbers ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('size-2 rounded-full', counts.connected > 0 ? 'bg-success' : 'bg-subtle-foreground')} />
        {counts.connected > 0 ? plural(counts.connected, 'conectado', 'conectados') : 'Nenhum conectado'}
      </span>
      {counts.connecting > 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{plural(counts.connecting, 'conectando', 'conectando')}</span>
        </>
      ) : null}
      {counts.needsAttention > 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 text-warning-soft-foreground">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            {counts.needsAttention === 1 ? '1 precisa de atenção' : `${counts.needsAttention} precisam de atenção`}
          </span>
        </>
      ) : null}
    </span>
  ) : null;

  const actions = hasNumbers ? (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Atualizar lista"
            onClick={() => void numbers.refresh()}
            disabled={numbers.loading}
          >
            <RefreshCw aria-hidden="true" className={cn(numbers.loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Atualizar lista</TooltipContent>
      </Tooltip>
      <Button type="button" onClick={() => openConnect(null)} disabled={!numbers.canCreate}>
        <Plus aria-hidden="true" />
        Conectar número
      </Button>
    </>
  ) : null;

  let content: ReactNode;
  if (!numbers.ready) {
    content = <ListSkeleton />;
  } else if (numbers.error && !hasNumbers) {
    content = (
      <div className="rounded-xl border border-border bg-surface shadow-xs">
        <ErrorState
          title={numbers.error.title}
          description={numbers.error.message}
          onRetry={() => void numbers.refresh()}
        />
      </div>
    );
  } else if (!hasNumbers) {
    content = <NumbersEmptyState onConnect={() => openConnect(null)} canCreate={numbers.canCreate} />;
  } else {
    content = (
      <div className="space-y-3">
        {numbers.error ? (
          <div role="alert" className="flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{numbers.error.message} Mostrando a última lista carregada.</p>
            <Button type="button" variant="link" size="sm" onClick={() => void numbers.refresh()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}
        <NumbersList numbers={numbers.numbers} busyNumberId={numbers.busyNumberId} onAction={handleAction} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Conecte os números que recebem seus leads."
        meta={meta}
        actions={actions}
      />

      {content}

      <ConnectNumberSheet
        open={connectOpen}
        onOpenChange={(value) => {
          setConnectOpen(value);
          if (!value) setConnectTarget(null);
        }}
        target={connectTarget}
        numbers={numbers}
        suggestedName={suggestedName}
      />

      <NumberDetailsSheet
        number={detailsNumber}
        onOpenChange={(value) => {
          if (!value) setDetailsId(null);
        }}
        onAction={handleAction}
      />

      <RemoveNumberDialog
        number={removal?.number ?? null}
        mode={removal?.mode ?? 'delete'}
        onOpenChange={(value) => {
          if (!value) setRemoval(null);
        }}
        onConfirm={handleRemove}
      />
    </div>
  );
};

export default WhatsAppConnect;
