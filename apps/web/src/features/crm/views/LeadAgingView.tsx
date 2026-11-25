import { useMemo } from 'react';
import { Hourglass } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils.js';
import useCrmAging from '../hooks/useCrmAging';
import { useCrmViewState } from '../state/view-context';
import type { LeadAgingBucket } from '../state/leads';
import { formatDateTime } from '../utils/labels';
import { LEAD_STAGE_DEFINITIONS, LEAD_STAGE_TONE_CLASSES, normalizeLeadStage, type LeadStage } from '../utils/lead-stage';

/** Ordem numérica das faixas ("0–1", "2–3", "4–7", "8–14", "15+"), não alfabética. */
const bucketStart = (bucket: LeadAgingBucket) => {
  const match = /\d+/.exec(bucket.bucketId ?? bucket.bucketLabel ?? '');
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
};

/** Intensidade do mapa de calor com tokens da marca (sem cores fixas). */
const HEAT_CLASSES = ['', 'bg-primary/5', 'bg-primary/10', 'bg-primary/20', 'bg-primary/30'];

const heatClass = (count: number, max: number) => {
  if (!count || !max) return HEAT_CLASSES[0];
  const level = Math.min(HEAT_CLASSES.length - 1, Math.max(1, Math.ceil((count / max) * (HEAT_CLASSES.length - 1))));
  return HEAT_CLASSES[level];
};

const LeadAgingView = () => {
  const { filters } = useCrmViewState();
  const { summary, isLoading, error, refetch } = useCrmAging(filters);
  const { stages, buckets, maxCount, totalLeads } = useMemo(() => buildMatrix(summary.buckets), [summary.buckets]);

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <ErrorState title="Não foi possível carregar o envelhecimento" error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-72 w-full rounded-lg" />;
  }

  if (totalLeads === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState icon={Hourglass} title="Nenhum lead para analisar" description="Ajuste os filtros para ver há quanto tempo os leads estão parados." />
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="crm-aging-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="crm-aging-title" className="text-sm font-medium text-foreground">
            Há quanto tempo cada lead está sem atualização
          </h2>
          <p className="text-sm text-muted-foreground">Quanto mais escuro, mais leads na faixa. Olhe primeiro as colunas da direita.</p>
        </div>
        {summary.generatedAt ? (
          <span className="text-xs text-muted-foreground">Atualizado {formatDateTime(summary.generatedAt)}</span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table data-slot="table" className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Leads por etapa e tempo sem atualização</caption>
          <TableHeader className="[&_tr]:border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 bg-surface-sunken pl-4 text-xs font-medium text-muted-foreground">Etapa</TableHead>
              {buckets.map((bucket) => (
                <TableHead key={bucket.bucketId} className="h-10 bg-surface-sunken text-center text-xs font-medium text-muted-foreground">
                  {bucket.bucketLabel}
                </TableHead>
              ))}
              <TableHead className="h-10 bg-surface-sunken pr-4 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((stage) => (
              <TableRow key={stage.stageId} className="border-border hover:bg-transparent">
                <TableCell className="py-2 pl-4 font-medium text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', LEAD_STAGE_TONE_CLASSES[LEAD_STAGE_DEFINITIONS[stage.stageId].tone].dot)} />
                    {stage.stageName}
                  </span>
                </TableCell>
                {buckets.map((bucket) => {
                  const count = stage.buckets[bucket.bucketId]?.leadCount ?? 0;
                  return (
                    <TableCell key={bucket.bucketId} className="p-1 text-center">
                      <span
                        className={cn(
                          'flex h-9 items-center justify-center rounded-md tabular-nums',
                          heatClass(count, maxCount),
                          count ? 'font-medium text-foreground' : 'text-subtle-foreground'
                        )}
                      >
                        {count || '—'}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell className="py-2 pr-4 text-right font-medium tabular-nums text-foreground">{stage.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </section>
  );
};

type StageRow = { stageId: LeadStage; stageName: string; buckets: Record<string, LeadAgingBucket>; total: number };

/** Agrupa por etapa do funil único (valores antigos da API são normalizados e somados). */
const buildMatrix = (buckets: LeadAgingBucket[]) => {
  const stageMap = new Map<LeadStage, StageRow>();
  const bucketOrder: Record<string, LeadAgingBucket> = {};
  let maxCount = 0;
  let totalLeads = 0;

  buckets.forEach((entry) => {
    if (!bucketOrder[entry.bucketId]) {
      bucketOrder[entry.bucketId] = entry;
    }
    const stageId = normalizeLeadStage(entry.stageId);
    if (!stageMap.has(stageId)) {
      stageMap.set(stageId, { stageId, stageName: LEAD_STAGE_DEFINITIONS[stageId].label, buckets: {}, total: 0 });
    }
    const stage = stageMap.get(stageId)!;
    const existing = stage.buckets[entry.bucketId];
    const merged = existing ? { ...existing, leadCount: existing.leadCount + entry.leadCount } : entry;
    stage.buckets[entry.bucketId] = merged;
    stage.total += entry.leadCount;
    maxCount = Math.max(maxCount, merged.leadCount);
    totalLeads += entry.leadCount;
  });

  return {
    stages: Array.from(stageMap.values()).sort(
      (a, b) => LEAD_STAGE_DEFINITIONS[a.stageId].order - LEAD_STAGE_DEFINITIONS[b.stageId].order
    ),
    buckets: Object.values(bucketOrder).sort((a, b) => bucketStart(a) - bucketStart(b)),
    maxCount,
    totalLeads,
  };
};

export default LeadAgingView;
