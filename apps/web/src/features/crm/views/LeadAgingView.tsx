// @ts-nocheck
import { useMemo } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import useCrmAging from '../hooks/useCrmAging';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import type { LeadAgingBucket } from '../state/leads';
import emitCrmTelemetry from '../utils/telemetry';

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

const LeadAgingView = () => {
  const { filters } = useCrmViewState();
  const { selectIds, clearSelection, openLeadDrawer } = useCrmViewContext();
  const { summary, isLoading } = useCrmAging(filters);

  const { stages, buckets, maxCount, totalLeads } = useMemo(() => buildMatrix(summary.buckets), [summary.buckets]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/60 bg-background/80 p-4">
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Envelhecimento por etapa</h2>
          <Badge variant="secondary">{totalLeads} lead(s) analisados</Badge>
          <Badge variant="outline">Atualizado em {new Date(summary.generatedAt).toLocaleString('pt-BR')}</Badge>
        </header>
        <p className="mt-2 text-sm text-muted-foreground">
          Utilize o mapa para identificar gargalos. Clique em "puxar para frente" para criar uma tarefa de retomada no lead.
        </p>
      </Card>

      <ScrollArea className="w-full overflow-auto rounded-xl border border-border/60 bg-background/60">
        <table className="min-w-[680px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Etapa</th>
              {buckets.map((bucket) => (
                <th key={bucket.bucketId} className="px-4 py-3 text-center">
                  {bucket.bucketLabel}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.stageId} className="border-b border-border/40">
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="flex flex-col">
                    <span>{stage.stageName}</span>
                    <span className="text-xs text-muted-foreground">{stage.total} lead(s)</span>
                  </div>
                </td>
                {buckets.map((bucket) => {
                  const cell = stage.buckets[bucket.bucketId];
                  const intensity = cell ? Math.min(1, cell.leadCount / Math.max(1, maxCount)) : 0;
                  return (
                    <td key={bucket.bucketId} className="px-2 py-2 text-center">
                      <div
                        className="relative flex flex-col items-center justify-center rounded-lg border border-border/40 px-3 py-2"
                        style={{
                          backgroundColor: `rgba(30, 64, 175, ${intensity * 0.18})`,
                        }}
                      >
                        <span className="text-sm font-semibold text-foreground">{cell?.leadCount ?? 0}</span>
                        <span className="text-[0.7rem] text-muted-foreground">{formatCurrency(cell?.potentialValue ?? null)}</span>
                        {cell && cell.leadCount > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 px-2 text-[0.65rem]"
                            onClick={() => {
                              if (!cell.sampleLeadId) {
                                return;
                              }
                              clearSelection();
                              selectIds([cell.sampleLeadId]);
                              openLeadDrawer(cell.sampleLeadId);
                              emitCrmTelemetry('crm.lead.pull_forward', {
                                stageId: stage.stageId,
                                bucketId: bucket.bucketId,
                                leadId: cell.sampleLeadId,
                              });
                            }}
                          >
                            Puxar para frente
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right font-semibold text-foreground">{stage.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando envelhecimento…</p> : null}
    </div>
  );
};

const buildMatrix = (buckets: LeadAgingBucket[]) => {
  const stageMap = new Map<string, { stageId: string; stageName: string; buckets: Record<string, LeadAgingBucket>; total: number }>();
  const bucketOrder: Record<string, LeadAgingBucket> = {};
  let maxCount = 0;
  let totalLeads = 0;

  buckets.forEach((entry) => {
    if (!bucketOrder[entry.bucketId]) {
      bucketOrder[entry.bucketId] = entry;
    }
    if (!stageMap.has(entry.stageId)) {
      stageMap.set(entry.stageId, { stageId: entry.stageId, stageName: entry.stageName, buckets: {}, total: 0 });
    }
    const stage = stageMap.get(entry.stageId)!;
    stage.buckets[entry.bucketId] = entry;
    stage.total += entry.leadCount;
    maxCount = Math.max(maxCount, entry.leadCount);
    totalLeads += entry.leadCount;
  });

  const orderedBuckets = Object.values(bucketOrder).sort((a, b) => a.bucketLabel.localeCompare(b.bucketLabel));
  const orderedStages = Array.from(stageMap.values());

  return {
    stages: orderedStages,
    buckets: orderedBuckets,
    maxCount,
    totalLeads,
  };
};

export default LeadAgingView;
